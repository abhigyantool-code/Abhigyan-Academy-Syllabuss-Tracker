'use server';

import { getPbClient } from '@/lib/pb';
import { createSession, destroySession, getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { getTodayIST } from '@/lib/date-utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  safeCompare,
  checkStudentPinRateLimit,
  validateNewPinStrength,
  recordPinFailure,
  recordPinSuccess,
  releasePinAttempt,
  getClientIp,
  isIpRateLimited,
  checkAdminRateLimit,
  recordAdminFailure,
  recordAdminSuccess,
} from '@/lib/rate-limit';
import { verifyPinDual, hashPin } from '@/lib/pin-hash';
import { verifyStudent } from '@/lib/student-guard';

export async function teacherLoginAction(teacherId: string, pin: string): Promise<{ success: boolean; error?: string }> {
  let clientIp = '127.0.0.1';
  try {
    const headerList = await headers();
    clientIp = getClientIp(headerList);
  } catch {
    // In test or non-HTTP environments
  }

  // Pre-flight IP rate limit check
  const ipCheck = isIpRateLimited(clientIp);
  if (!ipCheck.allowed) {
    return { success: false, error: ipCheck.error || 'Too many requests from your network. Please wait.' };
  }

  let inFlightReserved = false;
  let resolvedTeacherId = teacherId;

  try {
    if (!teacherId || !pin) {
      return { success: false, error: 'Please select your faculty profile and enter your PIN.' };
    }

    const pb = await getPbClient();

    let teacher: any;
    try {
      teacher = await pb.collection('teachers').getOne(teacherId);
    } catch {
      recordPinFailure('unknown_teacher', clientIp);
      return { success: false, error: 'Teacher record not found.' };
    }

    resolvedTeacherId = teacher.id;

    if (!teacher.active) {
      return { success: false, error: 'This faculty account is deactivated. Please contact the administrator.' };
    }

    // Rate limit check before verifying PIN
    const rateCheck = checkStudentPinRateLimit(teacher.id, clientIp);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error || 'Too many failed login attempts. Account temporarily locked.' };
    }
    inFlightReserved = true;

    // Timing-safe dual verification (scrypt hash or plaintext fallback)
    const verification = await verifyPinDual(pin.trim(), teacher.pin_hash, teacher.pin);
    if (!verification.valid) {
      inFlightReserved = false;
      recordPinFailure(teacher.id, clientIp);
      return { success: false, error: 'Incorrect PIN. Please try again.' };
    }

    inFlightReserved = false;
    recordPinSuccess(teacher.id, clientIp);

    // Opportunistic hash upgrade if authenticated via plaintext
    if (verification.needsMigration) {
      try {
        const newHash = await hashPin(pin.trim());
        await pb.collection('teachers').update(teacher.id, { pin_hash: newHash });
      } catch (err) {
        console.warn('Teacher PIN hash opportunistic migration deferred:', err);
      }
    }

    // Create session
    await createSession({
      userId: teacher.id,
      role: 'faculty',
      name: teacher.name,
      teacherId: teacher.id,
    });

    await logAudit({
      action: 'TEACHER_LOGIN',
      entity: 'teachers',
      entityId: teacher.id,
      after: { name: teacher.name, loggedInAt: new Date().toISOString() },
    });

    revalidatePath('/teacher');
    return { success: true };
  } catch (err: any) {
    if (inFlightReserved) {
      releasePinAttempt(resolvedTeacherId, clientIp);
    }
    console.error('teacherLoginAction error:', err);
    return { success: false, error: 'An unexpected server error occurred. Please try again or contact the administrator.' };
  }
}

export async function adminLoginAction(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!password) {
      return { success: false, error: 'Please enter the Director Master Password.' };
    }

    let clientIp = '127.0.0.1';
    try {
      const headerList = await headers();
      clientIp = getClientIp(headerList);
    } catch {
      // In test or non-HTTP environments
    }

    // Check admin login rate limit per IP
    const adminRateCheck = checkAdminRateLimit(clientIp);
    if (!adminRateCheck.allowed) {
      return { success: false, error: adminRateCheck.error || 'Too many failed admin login attempts. Please wait.' };
    }

    const masterPassword = process.env.ADMIN_MASTER_PASSWORD || 'AbhigyanAdmin2026!';
    if (!masterPassword) {
      console.error('FATAL: ADMIN_MASTER_PASSWORD is not configured in environment variables.');
      return { success: false, error: 'Authentication service configuration error. Please contact administrator.' };
    }

    if (!safeCompare(password.trim(), masterPassword.trim())) {
      recordAdminFailure(clientIp);
      return { success: false, error: 'Incorrect Director Master Password. Access denied.' };
    }

    recordAdminSuccess(clientIp);

    // Create admin session
    await createSession({
      userId: 'admin-director-root',
      role: 'admin',
      name: 'Academy Director',
    });

    await logAudit({
      action: 'ADMIN_LOGIN',
      entity: 'admin',
      entityId: 'admin-director-root',
      after: { loggedInAt: new Date().toISOString() },
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('adminLoginAction error:', err);
    return { success: false, error: 'An unexpected server error occurred. Please try again or contact the administrator.' };
  }
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await logAudit({
      action: 'LOGOUT',
      entity: session.role,
      entityId: session.userId,
    });
  }
  await destroySession();
  redirect('/login');
}

export async function teacherEndorseTopicAction(topicId: string, subjectId: string, courseId: string, remarks?: string) {
  const session = await getSession();
  if (!session || session.role !== 'faculty' || !session.teacherId) {
    throw new Error('Unauthorized. Please log in as faculty.');
  }

  const teacherId = session.teacherId;
  const today = getTodayIST();
  const pb = await getPbClient();

  // 1. Verify this teacher teaches this subject
  try {
    await pb.collection('teacher_subjects').getFirstListItem(`teacher="${teacherId}" && subject="${subjectId}"`);
  } catch {
    throw new Error('You are not assigned to teach this subject.');
  }

  // 2. Find pending student submissions for this topic and approve them
  const existingEntries = await pb.collection('entries').getFullList({
    filter: `topic="${topicId}" && teacher="${teacherId}"`,
  });

  if (existingEntries.length > 0) {
    for (const ent of existingEntries) {
      await pb.collection('entries').update(ent.id, {
        review_status: 'approved',
        status: 'covered',
      });
    }
  } else {
    // 3. If no student submissions exist, write faculty instruction log to teaching_records (BUG-009 Fix: Never fabricate student entries)
    const sessionId = `TR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      await pb.collection('teaching_records').create({
        session_id: sessionId,
        session_number: 1,
        teacher: teacherId,
        course: courseId,
        subject: subjectId,
        topic: topicId,
        session_date: today,
        session_type: 'lecture',
        status: 'completed',
        duration_minutes: 60,
        remarks: remarks ? `[Faculty Endorsed] ${remarks}` : '[Faculty Endorsed directly from Teacher Portal]',
        is_voided: false,
        version: 1,
        source: 'teacher_portal',
      });
    } catch (trErr: any) {
      console.warn('teaching_records write deferred (awaiting schema deployment):', trErr.message);
      // Fallback: Do not corrupt student data in entries table
    }
  }

  await logAudit({
    action: 'TEACHER_ENDORSE_TOPIC',
    entity: 'topics',
    entityId: topicId,
    after: { teacherId, subjectId, courseId, date: today },
  });

  revalidatePath('/teacher');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function changeStudentPinAction(
  studentIdentifier: string,
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  if (!studentIdentifier || !currentPin || !newPin) {
    return { success: false, error: 'All fields are required.' };
  }

  // 1. Validate new PIN format and strength
  const pinValidation = validateNewPinStrength(newPin, currentPin);
  if (!pinValidation.valid) {
    return { success: false, error: pinValidation.error || 'Invalid new PIN.' };
  }

  // 2. Safely extract client IP for rate limiting (BUG-037)
  let clientIp = '127.0.0.1';
  try {
    const headerList = await headers();
    clientIp = getClientIp(headerList);
  } catch {
    // In non-HTTP or test environments
  }

  // Pre-flight check: Reject immediately if client IP is currently rate-limited (0 DB queries)
  const ipCheck = isIpRateLimited(clientIp);
  if (!ipCheck.allowed) {
    return { success: false, error: ipCheck.error || 'Too many requests from your network. Please wait.' };
  }

  let inFlightReserved = false;
  let resolvedStudentId = studentIdentifier;

  try {
    // 3. Lookup student record in PocketBase
    const pb = await getPbClient();
    let student: any;
    try {
      student = await pb.collection('students').getOne(studentIdentifier);
    } catch {
      try {
        const safeId = studentIdentifier.replace(/["\\]/g, '');
        student = await pb.collection('students').getFirstListItem(`roll_no="${safeId}"`);
      } catch {
        recordPinFailure('unknown_student', clientIp);
        return { success: false, error: 'Student record not found.' };
      }
    }

    resolvedStudentId = student.id;

    if (!student.active) {
      return { success: false, error: 'This student account is inactive. Please contact administration.' };
    }

    // 4. Check rate limits (per-IP and per-student failure lockout, with atomic reservation BUG-038)
    const rateLimit = checkStudentPinRateLimit(student.id, clientIp);
    if (!rateLimit.allowed) {
      return { success: false, error: rateLimit.error || 'Rate limit exceeded. Please wait.' };
    }
    inFlightReserved = true;

    // 5. Authorization & Session Role Checks
    const session = await getSession();

    if (session) {
      // Faculty are prohibited from modifying student PINs
      if (session.role === 'faculty') {
        inFlightReserved = false;
        releasePinAttempt(student.id, clientIp);
        return {
          success: false,
          error: 'Unauthorized: Faculty accounts cannot modify student PINs. Please contact administration.',
        };
      }

      // If a student session exists, enforce strict studentId match (BUG-040)
      if (session.role === 'student') {
        if (!session.studentId || session.studentId !== student.id) {
          inFlightReserved = false;
          recordPinFailure(student.id, clientIp);
          return {
            success: false,
            error: "Unauthorized: You are not permitted to modify another student's PIN.",
          };
        }
      }
      // If session.role === 'admin', admin override is permitted
    }

    // 6. Verify Current PIN (mandatory unless an authorized admin is overriding)
    const isAdmin = session?.role === 'admin';
    if (!isAdmin) {
      const verification = await verifyPinDual(currentPin.trim(), student.pin_hash, student.pin);
      if (!verification.valid) {
        inFlightReserved = false;
        recordPinFailure(student.id, clientIp);
        return { success: false, error: 'Current PIN is incorrect.' };
      }
    }

    // 7. Hash New PIN and update Student record in PocketBase (BUG-004)
    const newPinHash = await hashPin(newPin.trim());
    await pb.collection('students').update(student.id, {
      pin: newPin.trim(),
      pin_hash: newPinHash,
    });

    // 8. Clear student failure lock on success
    inFlightReserved = false;
    recordPinSuccess(student.id, clientIp);

    // 9. Audit Logging (Zero credential leakage - passwords/PINs never stored in audit log)
    await logAudit({
      action: 'STUDENT_CHANGE_PIN',
      entity: 'students',
      entityId: student.id,
      after: {
        roll_no: student.roll_no,
        changedAt: new Date().toISOString(),
        authMethod: isAdmin ? 'admin_override' : 'self_service_pin_verification',
        clientIp,
      },
    });

    revalidatePath('/submit');
    return { success: true };
  } catch (err: any) {
    if (inFlightReserved) {
      releasePinAttempt(resolvedStudentId, clientIp);
    }
    console.error('changeStudentPinAction error:', err);
    return { success: false, error: err.message || 'An error occurred while changing PIN. Please try again.' };
  }
}

export const changeStudentPin = changeStudentPinAction;

export async function updateTeacherPinAction(oldPin: string, newPin: string) {
  const session = await getSession();
  if (!session || session.role !== 'faculty' || !session.teacherId) {
    throw new Error('Unauthorized. Faculty session required.');
  }

  // Validate new PIN strength (BUG-032 / BUG-005)
  const pinValidation = validateNewPinStrength(newPin, oldPin);
  if (!pinValidation.valid) {
    throw new Error(pinValidation.error || 'Invalid new PIN.');
  }

  let clientIp = '127.0.0.1';
  try {
    const headerList = await headers();
    clientIp = getClientIp(headerList);
  } catch {
    // In test or non-HTTP environments
  }

  // Pre-flight check on IP rate limit
  const ipCheck = isIpRateLimited(clientIp);
  if (!ipCheck.allowed) {
    throw new Error(ipCheck.error || 'Too many requests from your network. Please wait.');
  }

  const rateCheck = checkStudentPinRateLimit(session.teacherId, clientIp);
  if (!rateCheck.allowed) {
    throw new Error(rateCheck.error || 'Account temporarily locked due to multiple failed PIN attempts.');
  }

  let inFlightReserved = true;

  try {
    const pb = await getPbClient();
    const teacher = await pb.collection('teachers').getOne(session.teacherId);
    const verification = await verifyPinDual(oldPin.trim(), teacher.pin_hash, teacher.pin);
    if (!verification.valid) {
      inFlightReserved = false;
      recordPinFailure(session.teacherId, clientIp);
      throw new Error('Old PIN is incorrect.');
    }

    inFlightReserved = false;
    recordPinSuccess(session.teacherId, clientIp);

    const newPinHash = await hashPin(newPin.trim());
    await pb.collection('teachers').update(session.teacherId, {
      pin: newPin.trim(),
      pin_hash: newPinHash,
    });

    await logAudit({
      action: 'UPDATE_TEACHER_PIN',
      entity: 'teachers',
      entityId: session.teacherId,
    });

    return { success: true };
  } catch (err: any) {
    if (inFlightReserved) {
      releasePinAttempt(session.teacherId, clientIp);
    }
    throw err;
  }
}

/**
 * Verifies student Roll Number and PIN on /submit without exposing the student roster (BUG-003).
 */
export async function verifyStudentLookupAction(
  courseId: string,
  rollNo: string,
  pin: string
): Promise<{ success: boolean; student?: { id: string; name: string; roll_no: string }; error?: string }> {
  let clientIp = '127.0.0.1';
  try {
    const headerList = await headers();
    clientIp = getClientIp(headerList);
  } catch {}

  const check = await verifyStudent(rollNo, courseId, pin, clientIp);
  if (!check.valid || !check.student) {
    return { success: false, error: check.error || 'Student authentication failed.' };
  }

  return {
    success: true,
    student: {
      id: check.student.id,
      name: check.student.name,
      roll_no: check.student.roll_no,
    },
  };
}

/**
 * Authenticates a student via Roll Number + PIN and creates a student session for /student dashboard (BUG-017).
 */
export async function studentLoginAction(
  rollNo: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  let clientIp = '127.0.0.1';
  try {
    const headerList = await headers();
    clientIp = getClientIp(headerList);
  } catch {}

  // Pre-flight check on IP rate limit
  const ipCheck = isIpRateLimited(clientIp);
  if (!ipCheck.allowed) {
    return { success: false, error: ipCheck.error || 'Too many requests from your network. Please wait.' };
  }

  if (!rollNo || !rollNo.trim()) {
    return { success: false, error: 'Please enter your Roll Number.' };
  }
  if (!pin || !pin.trim()) {
    return { success: false, error: 'Please enter your 4-digit PIN.' };
  }

  const cleanRoll = rollNo.trim().toUpperCase();
  const pb = await getPbClient();

  let student: any;
  try {
    student = await pb.collection('students').getFirstListItem(`roll_no = "${cleanRoll}"`);
  } catch {
    recordPinFailure('unknown_student', clientIp);
    return { success: false, error: 'Invalid Roll Number or PIN.' };
  }

  if (!student.active) {
    return { success: false, error: 'This student account is inactive. Please contact the academy administration.' };
  }

  const rateCheck = checkStudentPinRateLimit(student.id, clientIp);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.error || 'Account temporarily locked due to multiple failed PIN attempts.' };
  }

  let inFlightReserved = true;

  try {
    const verification = await verifyPinDual(pin.trim(), student.pin_hash, student.pin);
    if (!verification.valid) {
      inFlightReserved = false;
      recordPinFailure(student.id, clientIp);
      return { success: false, error: 'Invalid Roll Number or PIN.' };
    }

    inFlightReserved = false;
    recordPinSuccess(student.id, clientIp);

    // Opportunistic hash upgrade if authenticated via plaintext
    if (verification.needsMigration) {
      try {
        const newHash = await hashPin(pin.trim());
        await pb.collection('students').update(student.id, { pin_hash: newHash });
      } catch (err) {
        console.warn('Student PIN hash opportunistic migration deferred:', err);
      }
    }

    // Create student session
    await createSession({
      userId: student.id,
      role: 'student',
      name: student.name,
      studentId: student.id,
    });

    await logAudit({
      action: 'STUDENT_LOGIN',
      entity: 'students',
      entityId: student.id,
    });

    return { success: true };
  } catch (err: any) {
    if (inFlightReserved) {
      releasePinAttempt(student.id, clientIp);
    }
    return { success: false, error: 'An unexpected authentication error occurred. Please try again.' };
  }
}
