



import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { safeCompare } from './rate-limit';

export const STUDENT_SESSION_COOKIE = 'abg_student_session';
export const TEACHER_SESSION_COOKIE = 'abg_teacher_session';
export const ADMIN_SESSION_COOKIE = 'abg_admin_session';
export const LEGACY_SESSION_COOKIE = 'abg_auth_session';

export type UserRole = 'faculty' | 'admin' | 'student';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: SESSION_SECRET is not configured in production environment variables.');
    }
    return 'dev-only-insecure-secret-key-32-chars-min';
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('FATAL: SESSION_SECRET must be at least 32 characters long in production.');
  }
  return secret;
}

export interface SessionPayload {
  userId: string;
  role: 'faculty' | 'admin' | 'student';
  name: string;
  teacherId?: string;
  studentId?: string;
  courseId?: string;
  createdAt: number;
  mustChangePin?: boolean;
}

export function getCookieNameForRole(role: UserRole): string {
  switch (role) {
    case 'student':
      return STUDENT_SESSION_COOKIE;
    case 'faculty':
      return TEACHER_SESSION_COOKIE;
    case 'admin':
      return ADMIN_SESSION_COOKIE;
  }
}

// In-memory token revocation cache (TTL-bounded, pruned against memory leaks)
// Prevents replayed stateless session tokens from being reused after sign-out (BUG-044)
const revokedSignatures = new Map<string, number>();
const MAX_REVOKED_BUCKETS = 10_000;

function pruneRevokedTokens(now: number): void {
  if (revokedSignatures.size >= MAX_REVOKED_BUCKETS) {
    for (const [sig, expiry] of revokedSignatures.entries()) {
      if (expiry <= now) {
        revokedSignatures.delete(sig);
      }
    }
    // Hard cap eviction if still at capacity (FIFO)
    while (revokedSignatures.size >= MAX_REVOKED_BUCKETS) {
      const oldest = revokedSignatures.keys().next().value;
      if (oldest) revokedSignatures.delete(oldest);
      else break;
    }
  }
}

export function revokeToken(token: string): void {
  try {
    const parts = token.split('.');
    const signature = parts[1];
    if (!signature) return;
    const now = Date.now();
    pruneRevokedTokens(now);
    // Retain revoked signature for max session duration so it cannot be replayed before expiry
    revokedSignatures.set(signature, now + SESSION_MAX_AGE_SECONDS * 1000);
  } catch {}
}

export function isTokenRevoked(token: string): boolean {
  try {
    const parts = token.split('.');
    const signature = parts[1];
    if (!signature) return false;
    const now = Date.now();
    const expiry = revokedSignatures.get(signature);
    if (!expiry) return false;
    if (expiry <= now) {
      revokedSignatures.delete(signature);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Signs and encodes payload
export function signPayload(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

// Verifies and decodes token using constant-time comparison (BUG-026 / BUG-043)
export function verifyPayload(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    // Check revocation cache before cryptographic validation (Bug 4 fix)
    if (isTokenRevoked(token)) {
      return null;
    }

    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(data)
      .digest('base64url');

    if (!safeCompare(signature, expectedSig)) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SessionPayload;

    // Validate token expiration (BUG-027)
    const maxAgeMs = SESSION_MAX_AGE_SECONDS * 1000;
    const now = Date.now();
    if (
      typeof payload.createdAt !== 'number' ||
      now - payload.createdAt > maxAgeMs ||
      payload.createdAt > now + 60_000 // Clock skew tolerance: 60 seconds
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Creates an isolated session cookie for the specified role.
 * Writes to role-specific cookie name (abg_student_session, abg_teacher_session, or abg_admin_session)
 * without touching or overwriting session cookies of other portals.
 */
export async function createSession(
  payload: Omit<SessionPayload, 'createdAt'>,
  specificCookieName?: string
): Promise<void> {
  const fullPayload: SessionPayload = {
    ...payload,
    createdAt: Date.now(),
  };

  const token = signPayload(fullPayload);
  const cookieStore = await cookies();
  const cookieName = specificCookieName || getCookieNameForRole(payload.role);

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== 'true',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

/**
 * Retrieves an active session.
 * If a role is specified ('student', 'faculty', 'admin'), it inspects that role's isolated cookie,
 * falling back to the legacy cookie if valid and matching.
 * If role is omitted, it returns the first valid session found (checking admin, faculty, student, legacy).
 */
export async function getSession(role?: UserRole): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();

    if (role) {
      const primaryCookie = getCookieNameForRole(role);
      const token = cookieStore.get(primaryCookie)?.value;
      if (token) {
        const payload = verifyPayload(token);
        if (payload && payload.role === role) {
          return payload;
        }
      }
      // Backward compatibility fallback to legacy shared cookie
      const legacyToken = cookieStore.get(LEGACY_SESSION_COOKIE)?.value;
      if (legacyToken) {
        const legacyPayload = verifyPayload(legacyToken);
        if (legacyPayload && legacyPayload.role === role) {
          return legacyPayload;
        }
      }
      return null;
    }

    // Role omitted: probe in order of specificity (admin -> faculty -> student -> legacy)
    const probeCookies = [ADMIN_SESSION_COOKIE, TEACHER_SESSION_COOKIE, STUDENT_SESSION_COOKIE, LEGACY_SESSION_COOKIE];
    for (const cName of probeCookies) {
      const token = cookieStore.get(cName)?.value;
      if (token) {
        const payload = verifyPayload(token);
        if (payload) return payload;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Role-specific session getters
 */
export async function getStudentSession(): Promise<SessionPayload | null> {
  return getSession('student');
}

export async function getFacultySession(): Promise<SessionPayload | null> {
  return getSession('faculty');
}

export async function getTeacherSession(): Promise<SessionPayload | null> {
  return getSession('faculty');
}

export async function getAdminSession(): Promise<SessionPayload | null> {
  return getSession('admin');
}

/**
 * Destroys session for a specific role or destroys legacy session / all sessions if role omitted.
 */
export async function destroySession(role?: UserRole): Promise<void> {
  const cookieStore = await cookies();
  const cookiesToClear = role
    ? [getCookieNameForRole(role)]
    : [STUDENT_SESSION_COOKIE, TEACHER_SESSION_COOKIE, ADMIN_SESSION_COOKIE, LEGACY_SESSION_COOKIE];

  for (const cName of cookiesToClear) {
    const existingVal = cookieStore.get(cName)?.value;
    if (existingVal) {
      revokeToken(existingVal);
    }
    cookieStore.delete(cName);
    cookieStore.set(cName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== 'true',
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
      path: '/',
    });
  }
}

export async function destroyStudentSession(): Promise<void> {
  return destroySession('student');
}

export async function destroyFacultySession(): Promise<void> {
  return destroySession('faculty');
}

export async function destroyTeacherSession(): Promise<void> {
  return destroySession('faculty');
}

export async function destroyAdminSession(): Promise<void> {
  return destroySession('admin');
}

/**
 * Universally destroys all active portal sessions simultaneously.
 */
export async function destroyAllSessions(): Promise<void> {
  return destroySession();
}
