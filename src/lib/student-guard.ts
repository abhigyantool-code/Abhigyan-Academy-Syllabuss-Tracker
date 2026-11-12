import { getPbClient } from './pb';
import {
  checkStudentPinRateLimit,
  recordPinFailure,
  recordPinSuccess,
  releasePinAttempt,
  isIpRateLimited,
} from './rate-limit';
import { verifyPinDual, hashPin } from './pin-hash';

export interface VerifyStudentResult {
  valid: boolean;
  student?: {
    id: string;
    roll_no: string;
    name: string;
    active: boolean;
  };
  error?: string;
}

/**
 * Verifies student existence, active status, course enrollment, and 4-digit PIN using PocketBase.
 * Protected against brute-force attacks via rate limiting and lockout counters (BUG-045).
 * Supports dual-read verification for smooth migration from plaintext PINs to secure hashes (BUG-004).
 */
export async function verifyStudent(
  studentId: string,
  courseId: string,
  pin?: string,
  clientIp: string = '127.0.0.1'
): Promise<VerifyStudentResult> {
  // Pre-flight check: Reject immediately if client IP is currently rate-limited (0 DB queries)
  const ipCheck = isIpRateLimited(clientIp);
  if (!ipCheck.allowed) {
    return {
      valid: false,
      error: ipCheck.error || 'Too many requests from your network. Please wait.',
    };
  }

  let inFlightReserved = false;
  let resolvedStudentId = studentId;

  try {
    const pb = await getPbClient();

    // 1. Fetch student by ID or Roll Number
    let student: any;
    try {
      student = await pb.collection('students').getOne(studentId);
    } catch {
      try {
        const cleanRoll = studentId.trim().toUpperCase();
        student = await pb.collection('students').getFirstListItem(`roll_no = "${cleanRoll}"`);
      } catch {
        recordPinFailure('unknown_student', clientIp);
        return { valid: false, error: 'Student not found in academy records. Please verify your Roll Number.' };
      }
    }

    resolvedStudentId = student.id;

    if (!student.active) {
      return {
        valid: false,
        error: `Student account for ${student.name} (${student.roll_no}) is inactive. Please contact administration.`,
      };
    }

    // 2. Check enrollment in course
    try {
      await pb.collection('enrollments').getFirstListItem(`student="${resolvedStudentId}" && course="${courseId}"`);
    } catch {
      return {
        valid: false,
        error: `Student ${student.name} (${student.roll_no}) is not enrolled in this course.`,
      };
    }

    // 3. Check rate limits & failure lockout before verifying PIN (BUG-045)
    const rateCheck = checkStudentPinRateLimit(student.id, clientIp);
    if (!rateCheck.allowed) {
      return {
        valid: false,
        error: rateCheck.error || 'Account temporarily locked due to multiple failed PIN attempts.',
      };
    }
    inFlightReserved = true;

    // 4. Verify Student PIN using timing-safe dual verification (scrypt hash or plaintext fallback)
    if (!pin) {
      inFlightReserved = false;
      recordPinFailure(student.id, clientIp);
      return {
        valid: false,
        error: 'Student PIN is required.',
      };
    }

    const verification = await verifyPinDual(pin, student.pin_hash, student.pin);
    if (!verification.valid) {
      inFlightReserved = false;
      recordPinFailure(student.id, clientIp);
      return {
        valid: false,
        error: 'Incorrect 4-digit Student PIN. Please check your credentials.',
      };
    }

    // 5. Authentication successful - clear lockout and reset failures
    inFlightReserved = false;
    recordPinSuccess(student.id, clientIp);

    // 6. Opportunistic credential upgrade: If student logged in with plaintext PIN, compute hash
    if (verification.needsMigration) {
      try {
        const newHash = await hashPin(pin);
        await pb.collection('students').update(student.id, { pin_hash: newHash });
      } catch (migrateErr) {
        // Non-blocking: background upgrade error should not fail user request
        console.warn('Opportunistic PIN hash upgrade deferred:', migrateErr);
      }
    }

    return {
      valid: true,
      student: {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        active: student.active,
      },
    };
  } catch (error: any) {
    if (inFlightReserved) {
      releasePinAttempt(resolvedStudentId, clientIp);
    }
    console.error('Error verifying student in PocketBase:', error);
    return {
      valid: false,
      error: 'An internal error occurred during student validation. Please try again.',
    };
  }
}
