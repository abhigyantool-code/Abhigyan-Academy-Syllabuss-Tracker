import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'abg_auth_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'abhigyan-academy-super-secure-key-2026-ist';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

// Verifies and decodes token
export function verifyPayload(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(data)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SessionPayload;
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
