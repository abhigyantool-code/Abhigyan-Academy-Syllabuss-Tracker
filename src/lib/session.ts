import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { safeCompare } from './rate-limit';

const SESSION_COOKIE_NAME = 'abg_auth_session';
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

export async function createSession(payload: Omit<SessionPayload, 'createdAt'>): Promise<void> {
  const fullPayload: SessionPayload = {
    ...payload,
    createdAt: Date.now(),
  };

  const token = signPayload(fullPayload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // Ensures session persists seamlessly whether accessed via HTTP or HTTPS reverse proxy
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPayload(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
