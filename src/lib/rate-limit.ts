import crypto from 'node:crypto';
import net from 'node:net';

interface RateLimitEntry {
  attempts: number;
  inFlight: number;
  lastAttempt: number;
  lockedUntil?: number;
}

// In-memory buckets for sliding-window rate limiting
// Layer 1: Individual account protection (Student & Faculty accounts)
const studentBuckets = new Map<string, RateLimitEntry>();
const teacherBuckets = new Map<string, RateLimitEntry>();

// Layer 2: Network-level shared IP protection (Classroom Wi-Fi / NAT router)
const ipBuckets = new Map<string, RateLimitEntry>(); // Student IP buckets
const teacherIpBuckets = new Map<string, RateLimitEntry>(); // Teacher IP buckets

// Layer 3: Administrative protection (Director master password)
const adminBuckets = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000;       // 15 minutes
const MAX_STUDENT_FAILURES = 5;          // Max failed attempts per student/teacher account before temporary lock
const MAX_ADMIN_FAILURES = 5;            // Strict max failed attempts for Director admin master password
const LOCKOUT_MS = 15 * 60 * 1000;       // 15-minute lockout

// Maximum capacity for in-memory buckets to prevent memory exhaustion (BUG-041)
const MAX_IP_BUCKETS = 10_000;
const MAX_STUDENT_BUCKETS = 10_000;

/**
 * Returns the effective maximum IP attempts permitted within the sliding window.
 * - In production environments, defaults to 100 to comfortably accommodate dozens of students
 *   and faculty sharing the academy's public NAT/Wi-Fi router without collective lockout contagion.
 * - Can be overridden via MAX_IP_LOGIN_ATTEMPTS environment variable.
 * - In isolated unit test mode (when process.env.NODE_ENV !== 'production' and env is unset),
 *   preserves the historical baseline of 10 for test suite specifications.
 */
export function getMaxIpAttempts(role: 'student' | 'teacher' = 'student'): number {
  if (process.env.MAX_IP_LOGIN_ATTEMPTS) {
    const parsed = parseInt(process.env.MAX_IP_LOGIN_ATTEMPTS, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.NODE_ENV === 'production') {
    return 100;
  }
  return 10;
}

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
export function isIpRateLimited(
  clientIp: string,
  role: 'student' | 'teacher' = 'student'
): { allowed: boolean; error?: string } {
  const now = Date.now();
  const buckets = role === 'teacher' ? teacherIpBuckets : ipBuckets;
  const ipEntry = buckets.get(clientIp);
  const maxAttempts = getMaxIpAttempts(role);

  if (ipEntry) {
    if (ipEntry.lockedUntil && ipEntry.lockedUntil > now) {
      const remainingMinutes = Math.ceil((ipEntry.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Too many requests from your network. Please wait ${remainingMinutes} minute(s).`,
      };
    }
    if (now - ipEntry.lastAttempt < WINDOW_MS) {
      if (ipEntry.attempts >= maxAttempts) {
        ipEntry.lockedUntil = now + LOCKOUT_MS;
        return {
          allowed: false,
          error: 'Too many requests from your network. Locked for 15 minutes.',
        };
      }
      const effectiveAttempts = ipEntry.attempts + ipEntry.inFlight;
      if (effectiveAttempts >= maxAttempts) {
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
 * Checks rate limits for an account PIN authentication / change attempt.
 * Reserves an in-flight attempt to prevent concurrent request race conditions (BUG-038).
 * Layer 1: Account-level failure lockout (5 failed attempts).
 * Layer 2: Network-level shared IP rate limiting (tolerant threshold to prevent classroom lockout).
 * Returns { allowed: boolean, error?: string }.
 */
export function checkStudentPinRateLimit(
  studentId: string,
  clientIp: string,
  role: 'student' | 'teacher' = 'student'
): { allowed: boolean; error?: string } {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const ipMap = role === 'teacher' ? teacherIpBuckets : ipBuckets;
  const accountMap = role === 'teacher' ? teacherBuckets : studentBuckets;
  const maxIpAttempts = getMaxIpAttempts(role);

  // 1. Check IP-level rate limit
  let ipEntry = ipMap.get(clientIp);
  if (ipEntry) {
    if (ipEntry.lockedUntil && ipEntry.lockedUntil > now) {
      const remainingMinutes = Math.ceil((ipEntry.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Too many authentication requests from your network. Please wait ${remainingMinutes} minute(s).`,
      };
    }

    if (now - ipEntry.lastAttempt < WINDOW_MS) {
      if (ipEntry.attempts >= maxIpAttempts) {
        ipEntry.lockedUntil = now + LOCKOUT_MS;
        return {
          allowed: false,
          error: 'Too many authentication requests from your network. Locked for 15 minutes.',
        };
      }
      const effectiveIpAttempts = ipEntry.attempts + ipEntry.inFlight;
      if (effectiveIpAttempts >= maxIpAttempts) {
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
  let accountEntry = accountMap.get(studentId);
  if (accountEntry) {
    if (accountEntry.lockedUntil && accountEntry.lockedUntil > now) {
      const remainingMinutes = Math.ceil((accountEntry.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Account temporarily locked due to multiple failed PIN attempts. Please wait ${remainingMinutes} minute(s) or contact administration.`,
      };
    }

    if (now - accountEntry.lastAttempt < WINDOW_MS) {
      if (accountEntry.attempts >= MAX_STUDENT_FAILURES) {
        accountEntry.lockedUntil = now + LOCKOUT_MS;
        return {
          allowed: false,
          error: 'Account locked for 15 minutes due to repeated failed PIN attempts.',
        };
      }
      const effectiveStudentAttempts = accountEntry.attempts + accountEntry.inFlight;
      if (effectiveStudentAttempts >= MAX_STUDENT_FAILURES) {
        return {
          allowed: false,
          error: 'Too many concurrent authentication attempts for this account. Please wait a moment.',
        };
      }
    } else {
      // Window expired, reset
      accountEntry.attempts = 0;
      accountEntry.inFlight = 0;
    }
  }

  // Atomically reserve attempt slot to eliminate concurrent request race condition (BUG-038)
  enforceCapacity(ipMap, MAX_IP_BUCKETS, now);
  if (!ipEntry) {
    ipEntry = { attempts: 0, inFlight: 1, lastAttempt: now };
    ipMap.set(clientIp, ipEntry);
  } else {
    ipEntry.inFlight += 1;
    ipEntry.lastAttempt = now;
  }

  enforceCapacity(accountMap, MAX_STUDENT_BUCKETS, now);
  if (!accountEntry) {
    accountEntry = { attempts: 0, inFlight: 1, lastAttempt: now };
    accountMap.set(studentId, accountEntry);
  } else {
    accountEntry.inFlight += 1;
    accountEntry.lastAttempt = now;
  }

  return { allowed: true };
}

/**
 * Releases reserved in-flight attempt if operation terminates before PIN check.
 */
export function releasePinAttempt(
  studentId: string,
  clientIp: string,
  role: 'student' | 'teacher' = 'student'
): void {
  const accountMap = role === 'teacher' ? teacherBuckets : studentBuckets;
  const ipMap = role === 'teacher' ? teacherIpBuckets : ipBuckets;

  const accountEntry = accountMap.get(studentId);
  if (accountEntry && accountEntry.inFlight > 0) {
    accountEntry.inFlight -= 1;
  }
  const ipEntry = ipMap.get(clientIp);
  if (ipEntry && ipEntry.inFlight > 0) {
    ipEntry.inFlight -= 1;
  }
}

/**
 * Records a failed PIN attempt for rate limiting and lockout.
 */
export function recordPinFailure(
  studentId: string,
  clientIp: string,
  role: 'student' | 'teacher' = 'student'
): void {
  const now = Date.now();
  const ipMap = role === 'teacher' ? teacherIpBuckets : ipBuckets;
  const accountMap = role === 'teacher' ? teacherBuckets : studentBuckets;
  const maxIpAttempts = getMaxIpAttempts(role);

  // IP bucket
  enforceCapacity(ipMap, MAX_IP_BUCKETS, now);
  const ipEntry = ipMap.get(clientIp) || { attempts: 0, inFlight: 0, lastAttempt: now };
  if (ipEntry.inFlight > 0) {
    ipEntry.inFlight -= 1;
  }
  if (now - ipEntry.lastAttempt > WINDOW_MS) {
    ipEntry.attempts = 1;
  } else {
    ipEntry.attempts += 1;
  }
  ipEntry.lastAttempt = now;
  if (ipEntry.attempts >= maxIpAttempts) {
    ipEntry.lockedUntil = now + LOCKOUT_MS;
  }
  ipMap.set(clientIp, ipEntry);

  // Account bucket
  enforceCapacity(accountMap, MAX_STUDENT_BUCKETS, now);
  const accountEntry = accountMap.get(studentId) || { attempts: 0, inFlight: 0, lastAttempt: now };
  if (accountEntry.inFlight > 0) {
    accountEntry.inFlight -= 1;
  }
  if (now - accountEntry.lastAttempt > WINDOW_MS) {
    accountEntry.attempts = 1;
  } else {
    accountEntry.attempts += 1;
  }
  accountEntry.lastAttempt = now;

  if (accountEntry.attempts >= MAX_STUDENT_FAILURES) {
    accountEntry.lockedUntil = now + LOCKOUT_MS;
  }
  accountMap.set(studentId, accountEntry);
}

/**
 * Resets the student failure counter upon successful authentication.
 * Releases in-flight IP reservation without penalizing legitimate network users.
 */
export function recordPinSuccess(
  studentId: string,
  clientIp: string,
  role: 'student' | 'teacher' = 'student'
): void {
  const accountMap = role === 'teacher' ? teacherBuckets : studentBuckets;
  const ipMap = role === 'teacher' ? teacherIpBuckets : ipBuckets;

  accountMap.delete(studentId);

  // Decrement inFlight attempt on the IP bucket without incrementing failed attempts
  const now = Date.now();
  const ipEntry = ipMap.get(clientIp);
  if (ipEntry) {
    if (ipEntry.inFlight > 0) {
      ipEntry.inFlight -= 1;
    }
    ipEntry.lastAttempt = now;
  }
}

/**
 * Dedicated Teacher rate-limiting helpers for faculty isolation.
 */
export function checkTeacherPinRateLimit(
  teacherId: string,
  clientIp: string
): { allowed: boolean; error?: string } {
  return checkStudentPinRateLimit(teacherId, clientIp, 'teacher');
}

export function recordTeacherPinFailure(teacherId: string, clientIp: string): void {
  recordPinFailure(teacherId, clientIp, 'teacher');
}

export function recordTeacherPinSuccess(teacherId: string, clientIp: string): void {
  recordPinSuccess(teacherId, clientIp, 'teacher');
}

export function releaseTeacherPinAttempt(teacherId: string, clientIp: string): void {
  releasePinAttempt(teacherId, clientIp, 'teacher');
}

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
  for (const [ip, entry] of teacherIpBuckets.entries()) {
    if (now - entry.lastAttempt > WINDOW_MS && (!entry.lockedUntil || entry.lockedUntil < now) && entry.inFlight === 0) {
      teacherIpBuckets.delete(ip);
    }
  }
  for (const [studentId, entry] of studentBuckets.entries()) {
    if (now - entry.lastAttempt > WINDOW_MS && (!entry.lockedUntil || entry.lockedUntil < now) && entry.inFlight === 0) {
      studentBuckets.delete(studentId);
    }
  }
  for (const [teacherId, entry] of teacherBuckets.entries()) {
    if (now - entry.lastAttempt > WINDOW_MS && (!entry.lockedUntil || entry.lockedUntil < now) && entry.inFlight === 0) {
      teacherBuckets.delete(teacherId);
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
  teacherIpBuckets.clear();
  teacherBuckets.clear();
  adminBuckets.clear();
}

/**
 * Internal bucket count inspection for testing environments.
 */
export function getBucketCountsForTesting(): { ipCount: number; studentCount: number; adminCount: number } {
  return { ipCount: ipBuckets.size, studentCount: studentBuckets.size, adminCount: adminBuckets.size };
}
