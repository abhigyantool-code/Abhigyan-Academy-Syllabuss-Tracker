import crypto from 'node:crypto';
import net from 'node:net';

interface RateLimitEntry {
  attempts: number;
  inFlight: number;
  lastAttempt: number;
  lockedUntil?: number;
}

// In-memory buckets for sliding-window rate limiting
const ipBuckets = new Map<string, RateLimitEntry>();
const studentBuckets = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000;       // 15 minutes
const MAX_IP_ATTEMPTS = 10;             // Max attempts per IP per 15 min
const MAX_STUDENT_FAILURES = 5;          // Max failed attempts per student before temporary lock
const LOCKOUT_MS = 15 * 60 * 1000;       // 15-minute lockout

// Maximum capacity for in-memory buckets to prevent memory exhaustion (BUG-041)
const MAX_IP_BUCKETS = 10_000;
const MAX_STUDENT_BUCKETS = 10_000;

/**
 * Validates whether a string is a valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const clean = ip.trim().replace(/^\[|\]$/g, '');
  return net.isIP(clean) !== 0;
}

/**
 * Safely extracts client IP address behind reverse proxies (Traefik / Coolify / Cloudflare).
 * Prioritizes headers set/sanitized by trusted proxies and avoids spoofed leftmost X-Forwarded-For entries (BUG-037).
 */
export function getClientIp(
  headersObj?: Headers | Record<string, string | null | undefined> | null
): string {
  if (!headersObj) return '127.0.0.1';

  const getHeader = (name: string): string | null => {
    if (typeof (headersObj as any).get === 'function') {
      return (headersObj as Headers).get(name);
    }
    const target = name.toLowerCase();
    for (const [key, val] of Object.entries(headersObj as Record<string, string | null | undefined>)) {
      if (key.toLowerCase() === target) {
        return val || null;
      }
    }
    return null;
  };

  // 1. Cloudflare connecting IP (if behind Cloudflare)
  const cfIp = getHeader('cf-connecting-ip');
  if (cfIp && isValidIp(cfIp)) {
    return cfIp.trim().replace(/^\[|\]$/g, '');
  }

  // 2. X-Real-IP: Set by Traefik / Nginx reverse proxy to the connecting client's IP
  const realIp = getHeader('x-real-ip');
  if (realIp && isValidIp(realIp)) {
    return realIp.trim().replace(/^\[|\]$/g, '');
  }

  // 3. X-Forwarded-For:
  // When behind a reverse proxy, the proxy appends the remote IP at the END of the list.
  // Leftmost IPs can be spoofed by client headers. We take the rightmost valid IP.
  const forwardedFor = getHeader('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts[i].replace(/^\[|\]$/g, '');
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  return '127.0.0.1';
}

/**
 * Constant-time string equality check to mitigate timing side-channel attacks (BUG-043).
 * Hashes both inputs to SHA-256 (32 bytes) before comparison to eliminate length-dependent timing discrepancies.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Validates that a PIN is between 4 and 8 digits and does not use a trivial or default pattern.
 */
export function validateNewPinStrength(newPin: string, currentPin?: string): { valid: boolean; error?: string } {
  if (!newPin || typeof newPin !== 'string') {
    return { valid: false, error: 'New PIN is required.' };
  }

  const trimmed = newPin.trim();

  if (!/^\d{4,8}$/.test(trimmed)) {
    return { valid: false, error: 'New PIN must be between 4 and 8 numeric digits.' };
  }

  if (currentPin && safeCompare(trimmed, currentPin.trim())) {
    return { valid: false, error: 'New PIN must be different from your current PIN.' };
  }

  // Reject common default/trivial PINs
  const trivialPins = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '12345', '123456'];
  if (trivialPins.includes(trimmed)) {
    return { valid: false, error: 'This PIN is too common or is a default pattern. Please choose a more secure PIN.' };
  }

  return { valid: true };
}

/**
 * Checks whether an IP address is currently locked out or has exceeded rate limits.
 * Call before executing expensive database queries.
 */
export function isIpRateLimited(clientIp: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const ipEntry = ipBuckets.get(clientIp);
  if (ipEntry) {
    if (ipEntry.lockedUntil && ipEntry.lockedUntil > now) {
      const remainingMinutes = Math.ceil((ipEntry.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Too many requests from your network. Please wait ${remainingMinutes} minute(s).`,
      };
    }
    if (now - ipEntry.lastAttempt < WINDOW_MS) {
      if (ipEntry.attempts >= MAX_IP_ATTEMPTS) {
        ipEntry.lockedUntil = now + LOCKOUT_MS;
        return {
          allowed: false,
          error: 'Too many requests from your network. Locked for 15 minutes.',
        };
      }
      const effectiveAttempts = ipEntry.attempts + ipEntry.inFlight;
      if (effectiveAttempts >= MAX_IP_ATTEMPTS) {
        return {
          allowed: false,
          error: 'Too many requests from your network. Please try again in a moment.',
        };
      }
    }
  }
  return { allowed: true };
}

/**
 * Checks rate limits for a PIN authentication / change attempt.
 * Reserves an in-flight attempt to prevent concurrent request race conditions (BUG-038).
 * Returns { allowed: boolean, error?: string }.
 */
export function checkStudentPinRateLimit(
  studentId: string,
  clientIp: string
): { allowed: boolean; error?: string } {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  // 1. Check IP-level rate limit
  let ipEntry = ipBuckets.get(clientIp);
  if (ipEntry) {
    if (ipEntry.lockedUntil && ipEntry.lockedUntil > now) {
      const remainingMinutes = Math.ceil((ipEntry.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Too many authentication requests from your network. Please wait ${remainingMinutes} minute(s).`,
      };
    }

    if (now - ipEntry.lastAttempt < WINDOW_MS) {
      if (ipEntry.attempts >= MAX_IP_ATTEMPTS) {
        ipEntry.lockedUntil = now + LOCKOUT_MS;
        return {
          allowed: false,
          error: 'Too many authentication requests from your network. Locked for 15 minutes.',
        };
      }
      const effectiveIpAttempts = ipEntry.attempts + ipEntry.inFlight;
      if (effectiveIpAttempts >= MAX_IP_ATTEMPTS) {
        return {
          allowed: false,
          error: 'Too many concurrent authentication requests from your network. Please try again in a moment.',
        };
      }
    } else {
      // Window expired, reset
      ipEntry.attempts = 0;
      ipEntry.inFlight = 0;
    }
  }

  // 2. Check student/account-level failure lockout
  let studentEntry = studentBuckets.get(studentId);
  if (studentEntry) {
    if (studentEntry.lockedUntil && studentEntry.lockedUntil > now) {
      const remainingMinutes = Math.ceil((studentEntry.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Account temporarily locked due to multiple failed PIN attempts. Please wait ${remainingMinutes} minute(s) or contact administration.`,
      };
    }

    if (now - studentEntry.lastAttempt < WINDOW_MS) {
      if (studentEntry.attempts >= MAX_STUDENT_FAILURES) {
        studentEntry.lockedUntil = now + LOCKOUT_MS;
        return {
          allowed: false,
          error: 'Account locked for 15 minutes due to repeated failed PIN attempts.',
        };
      }
      const effectiveStudentAttempts = studentEntry.attempts + studentEntry.inFlight;
      if (effectiveStudentAttempts >= MAX_STUDENT_FAILURES) {
        return {
          allowed: false,
          error: 'Too many concurrent authentication attempts for this account. Please wait a moment.',
        };
      }
    } else {
      // Window expired, reset
      studentEntry.attempts = 0;
      studentEntry.inFlight = 0;
    }
  }

  // Atomically reserve attempt slot to eliminate concurrent request race condition (BUG-038)
  enforceCapacity(ipBuckets, MAX_IP_BUCKETS, now);
  if (!ipEntry) {
    ipEntry = { attempts: 0, inFlight: 1, lastAttempt: now };
    ipBuckets.set(clientIp, ipEntry);
  } else {
    ipEntry.inFlight += 1;
    ipEntry.lastAttempt = now;
  }

  enforceCapacity(studentBuckets, MAX_STUDENT_BUCKETS, now);
  if (!studentEntry) {
    studentEntry = { attempts: 0, inFlight: 1, lastAttempt: now };
    studentBuckets.set(studentId, studentEntry);
  } else {
    studentEntry.inFlight += 1;
    studentEntry.lastAttempt = now;
  }

  return { allowed: true };
}

/**
 * Releases reserved in-flight attempt if operation terminates before PIN check.
 */
export function releasePinAttempt(studentId: string, clientIp: string): void {
  const studentEntry = studentBuckets.get(studentId);
  if (studentEntry && studentEntry.inFlight > 0) {
    studentEntry.inFlight -= 1;
  }
  const ipEntry = ipBuckets.get(clientIp);
  if (ipEntry && ipEntry.inFlight > 0) {
    ipEntry.inFlight -= 1;
  }
}

/**
 * Records a failed PIN attempt for rate limiting and lockout.
 */
export function recordPinFailure(studentId: string, clientIp: string): void {
  const now = Date.now();

  // IP bucket
  enforceCapacity(ipBuckets, MAX_IP_BUCKETS, now);
  const ipEntry = ipBuckets.get(clientIp) || { attempts: 0, inFlight: 0, lastAttempt: now };
  if (ipEntry.inFlight > 0) {
    ipEntry.inFlight -= 1;
  }
  if (now - ipEntry.lastAttempt > WINDOW_MS) {
    ipEntry.attempts = 1;
  } else {
    ipEntry.attempts += 1;
  }
  ipEntry.lastAttempt = now;
  if (ipEntry.attempts >= MAX_IP_ATTEMPTS) {
    ipEntry.lockedUntil = now + LOCKOUT_MS;
  }
  ipBuckets.set(clientIp, ipEntry);

  // Student bucket
  enforceCapacity(studentBuckets, MAX_STUDENT_BUCKETS, now);
  const studentEntry = studentBuckets.get(studentId) || { attempts: 0, inFlight: 0, lastAttempt: now };
  if (studentEntry.inFlight > 0) {
    studentEntry.inFlight -= 1;
  }
  if (now - studentEntry.lastAttempt > WINDOW_MS) {
    studentEntry.attempts = 1;
  } else {
    studentEntry.attempts += 1;
  }
  studentEntry.lastAttempt = now;

  if (studentEntry.attempts >= MAX_STUDENT_FAILURES) {
    studentEntry.lockedUntil = now + LOCKOUT_MS;
  }
  studentBuckets.set(studentId, studentEntry);
}

/**
 * Resets the student failure counter upon successful authentication.
 * Releases in-flight IP reservation without penalizing legitimate network users.
 */
export function recordPinSuccess(studentId: string, clientIp: string): void {
  studentBuckets.delete(studentId);

  // Decrement inFlight attempt on the IP bucket without incrementing failed attempts
  const now = Date.now();
  const ipEntry = ipBuckets.get(clientIp);
  if (ipEntry) {
    if (ipEntry.inFlight > 0) {
      ipEntry.inFlight -= 1;
    }
    ipEntry.lastAttempt = now;
  }
}

// In-memory bucket for Admin Director master password protection
const adminBuckets = new Map<string, RateLimitEntry>();
const MAX_ADMIN_FAILURES = 5;

/**
 * Checks whether the client IP has exceeded failed Director login attempts.
 */
export function checkAdminRateLimit(clientIp: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const entry = adminBuckets.get(clientIp);
  if (entry) {
    if (entry.lockedUntil && entry.lockedUntil > now) {
      const remainingMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Too many failed Director login attempts from your network. Please wait ${remainingMinutes} minute(s).`,
      };
    }
    if (now - entry.lastAttempt > WINDOW_MS) {
      entry.attempts = 0;
    }
  }
  return { allowed: true };
}

/**
 * Records a failed Director master password attempt.
 */
export function recordAdminFailure(clientIp: string): void {
  const now = Date.now();
  enforceCapacity(adminBuckets, MAX_IP_BUCKETS, now);
  const entry = adminBuckets.get(clientIp) || { attempts: 0, inFlight: 0, lastAttempt: now };
  if (now - entry.lastAttempt > WINDOW_MS) {
    entry.attempts = 1;
  } else {
    entry.attempts += 1;
  }
  entry.lastAttempt = now;
  if (entry.attempts >= MAX_ADMIN_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  adminBuckets.set(clientIp, entry);
}

/**
 * Clears failed Director login attempts on successful login.
 */
export function recordAdminSuccess(clientIp: string): void {
  adminBuckets.delete(clientIp);
}

/**
 * Periodic eviction of expired in-memory buckets.
 */
function cleanupExpiredBuckets(now: number): void {
  for (const [ip, entry] of ipBuckets.entries()) {
    if (now - entry.lastAttempt > WINDOW_MS && (!entry.lockedUntil || entry.lockedUntil < now) && entry.inFlight === 0) {
      ipBuckets.delete(ip);
    }
  }
  for (const [studentId, entry] of studentBuckets.entries()) {
    if (now - entry.lastAttempt > WINDOW_MS && (!entry.lockedUntil || entry.lockedUntil < now) && entry.inFlight === 0) {
      studentBuckets.delete(studentId);
    }
  }
  for (const [ip, entry] of adminBuckets.entries()) {
    if (now - entry.lastAttempt > WINDOW_MS && (!entry.lockedUntil || entry.lockedUntil < now) && entry.inFlight === 0) {
      adminBuckets.delete(ip);
    }
  }
}

/**
 * Enforces maximum capacity for in-memory buckets using FIFO eviction (BUG-041).
 */
function enforceCapacity(map: Map<string, RateLimitEntry>, maxCapacity: number, now: number): void {
  if (map.size >= maxCapacity) {
    cleanupExpiredBuckets(now);
    while (map.size >= maxCapacity) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) break;
      map.delete(oldestKey);
    }
  }
}

/**
 * Reset helper for testing environments.
 */
export function resetRateLimitsForTesting(): void {
  ipBuckets.clear();
  studentBuckets.clear();
  adminBuckets.clear();
}

/**
 * Internal bucket count inspection for testing environments.
 */
export function getBucketCountsForTesting(): { ipCount: number; studentCount: number; adminCount: number } {
  return { ipCount: ipBuckets.size, studentCount: studentBuckets.size, adminCount: adminBuckets.size };
}
