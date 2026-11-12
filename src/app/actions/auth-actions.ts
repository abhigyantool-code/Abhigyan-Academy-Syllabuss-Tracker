'use server';

import { getPbClient } from '@/lib/pb';
import { createSession, destroySession, getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { getTodayIST } from '@/lib/date-utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function teacherLoginAction(teacherId: string, pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!teacherId || !pin) {
      return { success: false, error: 'Please select your faculty profile and enter your PIN.' };
    }

    const pb = await getPbClient();

    let teacher: any;
    try {
      teacher = await pb.collection('teachers').getOne(teacherId);
    } catch {
      return { success: false, error: 'Teacher record not found.' };
    }

    if (!teacher.active) {
      return { success: false, error: 'This faculty account is deactivated. Please contact the administrator.' };
    }

    if (teacher.pin !== pin.trim()) {
      return { success: false, error: 'Incorrect PIN. The default PIN is 1234. Please try again.' };
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
    console.error('teacherLoginAction error:', err);
    return { success: false, error: err.message || 'Login failed. Please verify your PIN.' };
  }
}

export async function adminLoginAction(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!password) {
      return { success: false, error: 'Please enter the Director Master Password.' };
    }

    const masterPassword = process.env.ADMIN_MASTER_PASSWORD || 'AbhigyanAdmin2026!';
    if (password.trim() !== masterPassword) {
      return { success: false, error: 'Incorrect Director Master Password. Access denied.' };
    }

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
    return { success: false, error: err.message || 'Access denied. Incorrect master password.' };
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
    // 3. If no student submissions exist, create teacher-endorsed entry anchored by first enrolled student
    const enrollments = await pb.collection('enrollments').getList(1, 1, {
      filter: `course="${courseId}"`,
    });

    if (enrollments.items.length > 0) {
      const studentId = enrollments.items[0].student;
      await pb.collection('entries').create({
        student: studentId,
        course: courseId,
        subject: subjectId,
        teacher: teacherId,
        topic: topicId,
        class_date: today,
        status: 'covered',
        review_status: 'approved',
        device_id: 'teacher-portal-endorse',
        flags: [],
        remarks: remarks ? `[Faculty Endorsed] ${remarks}` : '[Faculty Endorsed directly from Teacher Portal]',
      });
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

export async function changeStudentPinAction(studentIdentifier: string, currentPin: string, newPin: string) {
  if (!studentIdentifier || !currentPin || !newPin) {
    throw new Error('All fields are required.');
  }

  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error('New PIN must be 4–8 numeric digits.');
  }

  const pb = await getPbClient();

  let student: any;
  try {
    student = await pb.collection('students').getOne(studentIdentifier);
  } catch {
    try {
      student = await pb.collection('students').getFirstListItem(`roll_no="${studentIdentifier}"`);
    } catch {
      throw new Error('Student not found.');
    }
  }

  if (student.pin !== currentPin.trim()) {
    throw new Error('Current PIN is incorrect.');
  }

  await pb.collection('students').update(student.id, { pin: newPin.trim() });

  await logAudit({
    action: 'STUDENT_CHANGE_PIN',
    entity: 'students',
    entityId: student.id,
    before: { pin: '[REDACTED]' },
    after: { pin: '[REDACTED]' },
  });

  return { success: true };
}

export const changeStudentPin = changeStudentPinAction;

export async function updateTeacherPinAction(oldPin: string, newPin: string) {
  const session = await getSession();
  if (!session || session.role !== 'faculty' || !session.teacherId) {
    throw new Error('Unauthorized.');
  }

  if (!newPin || newPin.trim().length < 4) {
    throw new Error('New PIN must be at least 4 digits.');
  }

  const pb = await getPbClient();
  const teacher = await pb.collection('teachers').getOne(session.teacherId);
  if (teacher.pin !== oldPin.trim()) {
    throw new Error('Old PIN is incorrect.');
  }

  await pb.collection('teachers').update(session.teacherId, { pin: newPin.trim() });

  await logAudit({
    action: 'UPDATE_TEACHER_PIN',
    entity: 'teachers',
    entityId: session.teacherId,
  });

  return { success: true };
}
