import crypto from 'node:crypto';
import { safeCompare } from './rate-limit';

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS: crypto.ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

/**
 * Hashes a numeric PIN or password using Node.js scrypt with a unique random salt.
 * Returns format: scrypt$<salt_hex>$<derived_key_hex>
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || typeof pin !== 'string') {
    throw new Error('PIN must be a non-empty string.');
  }

  const salt = crypto.randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    crypto.scrypt(pin.trim(), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Synchronous version of hashPin for scripts or batch migrations.
 */
export function hashPinSync(pin: string): string {
  if (!pin || typeof pin !== 'string') {
    throw new Error('PIN must be a non-empty string.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pin.trim(), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a candidate PIN against a stored scrypt hash in constant time.
 */
export async function verifyPinHash(pin: string, storedHash: string): Promise<boolean> {
  if (!pin || !storedHash || typeof pin !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, salt, expectedHashHex] = parts;
  if (!salt || !expectedHashHex) {
    return false;
  }

  return new Promise((resolve) => {
    crypto.scrypt(pin.trim(), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) {
        resolve(false);
        return;
      }

      const expectedBuf = Buffer.from(expectedHashHex, 'hex');
      if (derivedKey.length !== expectedBuf.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(derivedKey, expectedBuf));
    });
  });
}

/**
 * Synchronous version of verifyPinHash for scripts and offline validation.
 */
export function verifyPinHashSync(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash || typeof pin !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, salt, expectedHashHex] = parts;
  if (!salt || !expectedHashHex) {
    return false;
  }

  try {
    const derivedKey = crypto.scryptSync(pin.trim(), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
    const expectedBuf = Buffer.from(expectedHashHex, 'hex');
    if (derivedKey.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Dual verification:
 * 1. If storedHash is present, verifies using scrypt constant-time check.
 * 2. If storedHash is absent/null, falls back to storedPlaintext using timing-safe safeCompare.
 * 3. Returns { valid: boolean, needsMigration: boolean } so callers can auto-upgrade credentials.
 */
export async function verifyPinDual(
  pin: string,
  storedHash?: string | null,
  storedPlaintext?: string | null
): Promise<{ valid: boolean; needsMigration: boolean }> {
  if (!pin || typeof pin !== 'string') {
    return { valid: false, needsMigration: false };
  }

  const trimmedPin = pin.trim();

  // If hash is available, verify against hash
  if (storedHash && typeof storedHash === 'string' && storedHash.startsWith('scrypt$')) {
    const matches = await verifyPinHash(trimmedPin, storedHash);
    return { valid: matches, needsMigration: false };
  }

  // Fallback to plaintext PIN with constant-time comparison
  if (storedPlaintext && typeof storedPlaintext === 'string') {
    const matches = safeCompare(trimmedPin, storedPlaintext.trim());
    return { valid: matches, needsMigration: matches };
  }

  return { valid: false, needsMigration: false };
}
