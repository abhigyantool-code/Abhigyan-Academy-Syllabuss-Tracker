'use server';

import { query } from '@/lib/db';
import { createSession, destroySession, getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { getTodayIST } from '@/lib/date-utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function teacherLoginAction(teacherId: string, pin: string) {
  if (!teacherId || !pin) {
    throw new Error('Please select your faculty profile and enter your PIN.');
  }

  const res = await query(
    `SELECT id, name, pin, active FROM teachers WHERE id = $1 LIMIT 1;`,
    [teacherId]
  );

  if (res.rows.length === 0) {
    throw new Error('Teacher record not found.');
  }

  const teacher = res.rows[0];
  if (!teacher.active) {
    throw new Error('This faculty account is deactivated. Please contact the administrator.');
  }

  if (teacher.pin !== pin.trim()) {
    throw new Error('Incorrect PIN. The default PIN is 1234. Please try again.');
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
}

export async function adminLoginAction(password: string) {
  if (!password) {
    throw new Error('Please enter the Director Master Password.');
  }

  const masterPassword = process.env.ADMIN_MASTER_PASSWORD || 'AbhigyanAdmin2026!';
  if (password.trim() !== masterPassword) {
    throw new Error('Incorrect Director Master Password. Access denied.');
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

  // 1. Verify this teacher teaches this subject
  const match = await query(
    `SELECT 1 FROM teacher_subjects WHERE teacher_id = $1 AND subject_id = $2;`,
    [teacherId, subjectId]
  );
  if (match.rows.length === 0) {
    throw new Error('You are not assigned to teach this subject.');
  }

  // 2. Approve all pending student submissions for this topic
  const updateRes = await query(
    `UPDATE entries 
     SET review_status = 'approved', status = 'covered'
     WHERE topic_id = $1 AND teacher_id = $2
     RETURNING id;`,
    [topicId, teacherId]
  );

  // 3. If no student submissions exist yet today, create a teacher-endorsed entry
  if (updateRes.rows.length === 0) {
    // Pick first enrolled student in course to anchor entry
    const stuRes = await query(
      `SELECT s.id FROM students s JOIN enrollments e ON s.id = e.student_id WHERE e.course_id = $1 LIMIT 1;`,
      [courseId]
    );
    if (stuRes.rows.length > 0) {
      await query(
        `INSERT INTO entries (student_id, course_id, subject_id, teacher_id, topic_id, class_date, remarks, status, device_id, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'covered', 'teacher-portal-endorse', 'approved')
         ON CONFLICT (student_id, topic_id, class_date) 
         DO UPDATE SET status = 'covered', review_status = 'approved', remarks = EXCLUDED.remarks;`,
        [
          stuRes.rows[0].id,
          courseId,
          subjectId,
          teacherId,
          topicId,
          today,
          remarks ? `[Faculty Endorsed] ${remarks}` : '[Faculty Endorsed directly from Teacher Portal]',
        ]
      );
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

  // Support lookup by UUID or by roll_no / serial number (e.g. NDA-01)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentIdentifier);
  const res = isUuid
    ? await query(`SELECT id, pin FROM students WHERE id = $1 LIMIT 1`, [studentIdentifier])
    : await query(`SELECT id, pin FROM students WHERE roll_no = $1 OR id::text = $1 LIMIT 1`, [studentIdentifier]);

  if (res.rows.length === 0) {
    throw new Error('Student not found.');
  }

  const student = res.rows[0];

  if (student.pin !== currentPin.trim()) {
    throw new Error('Current PIN is incorrect.');
  }

  await query(`UPDATE students SET pin = $1 WHERE id = $2`, [newPin.trim(), student.id]);

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

  const teacherRes = await query(`SELECT pin FROM teachers WHERE id = $1`, [session.teacherId]);
  if (teacherRes.rows[0]?.pin !== oldPin.trim()) {
    throw new Error('Old PIN is incorrect.');
  }

  await query(`UPDATE teachers SET pin = $1 WHERE id = $2`, [newPin.trim(), session.teacherId]);

  await logAudit({
    action: 'UPDATE_TEACHER_PIN',
    entity: 'teachers',
    entityId: session.teacherId,
  });

  return { success: true };
}
