'use server';

import { query, withTransaction } from '@/lib/db';
import { requireAccess } from '@/lib/auth-guard';
import { logAudit } from '@/lib/audit';
import { getTodayIST, getTodayBoundsIST } from '@/lib/date-utils';
import { revalidatePath } from 'next/cache';

// -------------------------------------------------------------
// 1. Courses & Settings Actions
// -------------------------------------------------------------

export async function createCourseAction(formData: {
  name: string;
  code: string;
  sort_order: number;
  confirmation_threshold?: number;
  daily_entry_cap?: number;
  code_ttl_minutes?: number;
  require_class_code?: boolean;
}) {
  await requireAccess('admin');

  const res = await query(
    `INSERT INTO courses (name, code, sort_order, active)
     VALUES ($1, UPPER(TRIM($2)), $3, true) RETURNING *;`,
    [formData.name.trim(), formData.code, formData.sort_order || 1]
  );
  const newCourse = res.rows[0];

  // Insert default course settings
  await query(
    `INSERT INTO course_settings (course_id, confirmation_threshold, daily_entry_cap, code_ttl_minutes, require_class_code)
     VALUES ($1, $2, $3, $4, $5);`,
    [
      newCourse.id,
      formData.confirmation_threshold || 5,
      formData.daily_entry_cap || 6,
      formData.code_ttl_minutes || 60,
      formData.require_class_code ?? true,
    ]
  );

  await logAudit({
    action: 'CREATE_COURSE',
    entity: 'courses',
    entityId: newCourse.id,
    after: newCourse,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, course: newCourse };
}

export async function updateCourseAction(
  id: string,
  formData: {
    name: string;
    code: string;
    sort_order: number;
    active: boolean;
  }
) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM courses WHERE id = $1`, [id]);
  const res = await query(
    `UPDATE courses
     SET name = $1, code = UPPER(TRIM($2)), sort_order = $3, active = $4
     WHERE id = $5 RETURNING *;`,
    [formData.name.trim(), formData.code, formData.sort_order, formData.active, id]
  );

  await logAudit({
    action: 'UPDATE_COURSE',
    entity: 'courses',
    entityId: id,
    before: before.rows[0],
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, course: res.rows[0] };
}

export async function toggleCourseActiveAction(id: string, active: boolean) {
  await requireAccess('admin');

  await query(`UPDATE courses SET active = $1 WHERE id = $2`, [active, id]);
  await logAudit({
    action: active ? 'ACTIVATE_COURSE' : 'DEACTIVATE_COURSE',
    entity: 'courses',
    entityId: id,
    after: { active },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true };
}

export async function updateCourseSettingsAction(
  courseId: string,
  settings: {
    confirmation_threshold: number;
    daily_entry_cap: number;
    code_ttl_minutes: number;
    require_class_code: boolean;
  }
) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM course_settings WHERE course_id = $1`, [courseId]);
  const res = await query(
    `INSERT INTO course_settings (course_id, confirmation_threshold, daily_entry_cap, code_ttl_minutes, require_class_code, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (course_id) DO UPDATE
     SET confirmation_threshold = EXCLUDED.confirmation_threshold,
         daily_entry_cap = EXCLUDED.daily_entry_cap,
         code_ttl_minutes = EXCLUDED.code_ttl_minutes,
         require_class_code = EXCLUDED.require_class_code,
         updated_at = now()
     RETURNING *;`,
    [
      courseId,
      settings.confirmation_threshold,
      settings.daily_entry_cap,
      settings.code_ttl_minutes,
      settings.require_class_code,
    ]
  );

  await logAudit({
    action: 'UPDATE_COURSE_SETTINGS',
    entity: 'course_settings',
    entityId: courseId,
    before: before.rows[0],
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, settings: res.rows[0] };
}

// -------------------------------------------------------------
// 2. Curriculum (Subjects & Topics) Actions
// -------------------------------------------------------------

export async function createSubjectAction(courseId: string, name: string, sortOrder = 1) {
  await requireAccess('admin');

  const res = await query(
    `INSERT INTO subjects (course_id, name, sort_order)
     VALUES ($1, $2, $3) RETURNING *;`,
    [courseId, name.trim(), sortOrder]
  );

  await logAudit({
    action: 'CREATE_SUBJECT',
    entity: 'subjects',
    entityId: res.rows[0].id,
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, subject: res.rows[0] };
}

export async function updateSubjectAction(id: string, name: string, sortOrder: number) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM subjects WHERE id = $1`, [id]);
  const res = await query(
    `UPDATE subjects SET name = $1, sort_order = $2 WHERE id = $3 RETURNING *;`,
    [name.trim(), sortOrder, id]
  );

  await logAudit({
    action: 'UPDATE_SUBJECT',
    entity: 'subjects',
    entityId: id,
    before: before.rows[0],
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, subject: res.rows[0] };
}

export async function deleteSubjectAction(id: string) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM subjects WHERE id = $1`, [id]);
  await query(`DELETE FROM subjects WHERE id = $1`, [id]);

  await logAudit({
    action: 'DELETE_SUBJECT',
    entity: 'subjects',
    entityId: id,
    before: before.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function createTopicAction(
  subjectId: string,
  name: string,
  seqNo: number,
  targetDate?: string | null,
  notes?: string | null
) {
  await requireAccess('admin');

  const res = await query(
    `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
    [subjectId, name.trim(), seqNo, targetDate || null, notes ? notes.trim() : null]
  );

  await logAudit({
    action: 'CREATE_TOPIC',
    entity: 'topics',
    entityId: res.rows[0].id,
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, topic: res.rows[0] };
}

export async function updateTopicAction(
  id: string,
  name: string,
  seqNo: number,
  targetDate?: string | null,
  notes?: string | null
) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM topics WHERE id = $1`, [id]);
  const res = await query(
    `UPDATE topics
     SET name = $1, seq_no = $2, target_date = $3, notes = $4
     WHERE id = $5 RETURNING *;`,
    [name.trim(), seqNo, targetDate || null, notes ? notes.trim() : null, id]
  );

  await logAudit({
    action: 'UPDATE_TOPIC',
    entity: 'topics',
    entityId: id,
    before: before.rows[0],
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, topic: res.rows[0] };
}

export async function deleteTopicAction(id: string) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM topics WHERE id = $1`, [id]);
  await query(`DELETE FROM topics WHERE id = $1`, [id]);

  await logAudit({
    action: 'DELETE_TOPIC',
    entity: 'topics',
    entityId: id,
    before: before.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function reorderTopicsAction(subjectId: string, orderedTopicIds: string[]) {
  await requireAccess('admin');

  await withTransaction(async (client) => {
    for (let i = 0; i < orderedTopicIds.length; i++) {
      await client.query(`UPDATE topics SET seq_no = $1 WHERE id = $2 AND subject_id = $3`, [
        i + 1,
        orderedTopicIds[i],
        subjectId,
      ]);
    }
  });

  await logAudit({
    action: 'REORDER_TOPICS',
    entity: 'topics',
    entityId: subjectId,
    after: { count: orderedTopicIds.length },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function copySyllabusAction(sourceCourseId: string, targetCourseId: string) {
  await requireAccess('admin');

  if (sourceCourseId === targetCourseId) {
    throw new Error('Source and target courses must be different');
  }

  // Fetch source subjects and topics
  const subjectsRes = await query(`SELECT * FROM subjects WHERE course_id = $1 ORDER BY sort_order ASC`, [
    sourceCourseId,
  ]);

  let copiedSubjects = 0;
  let copiedTopics = 0;

  await withTransaction(async (client) => {
    for (const sub of subjectsRes.rows) {
      const newSubRes = await client.query(
        `INSERT INTO subjects (course_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id;`,
        [targetCourseId, sub.name, sub.sort_order]
      );
      const newSubId = newSubRes.rows[0].id;
      copiedSubjects++;

      const topicsRes = await client.query(
        `SELECT * FROM topics WHERE subject_id = $1 ORDER BY seq_no ASC;`,
        [sub.id]
      );

      for (const top of topicsRes.rows) {
        await client.query(
          `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
           VALUES ($1, $2, $3, $4, $5);`,
          [newSubId, top.name, top.seq_no, top.target_date, top.notes]
        );
        copiedTopics++;
      }
    }
  });

  await logAudit({
    action: 'CLONE_SYLLABUS',
    entity: 'curriculum',
    entityId: targetCourseId,
    after: { sourceCourseId, targetCourseId, copiedSubjects, copiedTopics },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, copiedSubjects, copiedTopics };
}

export async function bulkImportTopicsCsvAction(courseId: string, csvContent: string) {
  await requireAccess('admin');

  const lines = csvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  // Parse lines: Subject, Topic Name, Target Date, Notes
  let importedCount = 0;
  const subjectMap = new Map<string, string>();

  // Load existing subjects
  const existingSubs = await query(`SELECT id, name FROM subjects WHERE course_id = $1`, [courseId]);
  existingSubs.rows.forEach((s) => subjectMap.set(s.name.toLowerCase(), s.id));

  await withTransaction(async (client) => {
    // Determine subject max sort order
    let maxSort = existingSubs.rows.length;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV split considering quotes
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2) continue;

      const subName = parts[0];
      const topicName = parts[1];
      const targetDate = parts[2] && parts[2].match(/^\d{4}-\d{2}-\d{2}$/) ? parts[2] : null;
      const notes = parts[3] || null;

      if (!subName || !topicName) continue;

      let subId = subjectMap.get(subName.toLowerCase());
      if (!subId) {
        maxSort++;
        const newSubRes = await client.query(
          `INSERT INTO subjects (course_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id;`,
          [courseId, subName, maxSort]
        );
        subId = newSubRes.rows[0].id as string;
        subjectMap.set(subName.toLowerCase(), subId);
      }

      // Next seq no
      const countRes = await client.query(`SELECT COUNT(*) as count FROM topics WHERE subject_id = $1`, [subId]);
      const nextSeq = Number(countRes.rows[0].count) + 1;

      await client.query(
        `INSERT INTO topics (subject_id, name, seq_no, target_date, notes) VALUES ($1, $2, $3, $4, $5);`,
        [subId, topicName, nextSeq, targetDate, notes]
      );
      importedCount++;
    }
  });

  await logAudit({
    action: 'BULK_IMPORT_TOPICS_CSV',
    entity: 'topics',
    entityId: courseId,
    after: { importedCount },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, count: importedCount };
}

// -------------------------------------------------------------
// 3. Faculty Actions
// -------------------------------------------------------------

export async function createTeacherAction(name: string, phone?: string | null) {
  await requireAccess('admin');

  const res = await query(
    `INSERT INTO teachers (name, phone, active) VALUES ($1, $2, true) RETURNING *;`,
    [name.trim(), phone ? phone.trim() : null]
  );

  await logAudit({
    action: 'CREATE_TEACHER',
    entity: 'teachers',
    entityId: res.rows[0].id,
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, teacher: res.rows[0] };
}

export async function updateTeacherAction(id: string, name: string, phone: string | null, active: boolean) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM teachers WHERE id = $1`, [id]);
  const res = await query(
    `UPDATE teachers SET name = $1, phone = $2, active = $3 WHERE id = $4 RETURNING *;`,
    [name.trim(), phone ? phone.trim() : null, active, id]
  );

  await logAudit({
    action: 'UPDATE_TEACHER',
    entity: 'teachers',
    entityId: id,
    before: before.rows[0],
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, teacher: res.rows[0] };
}

export async function assignTeacherSubjectsAction(teacherId: string, subjectIds: string[]) {
  await requireAccess('admin');

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM teacher_subjects WHERE teacher_id = $1`, [teacherId]);
    for (const sId of subjectIds) {
      await client.query(
        `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [teacherId, sId]
      );
    }
  });

  await logAudit({
    action: 'ASSIGN_TEACHER_SUBJECTS',
    entity: 'teacher_subjects',
    entityId: teacherId,
    after: { subjectIds },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true };
}

// -------------------------------------------------------------
// 4. Students & Enrollments Actions
// -------------------------------------------------------------

export async function createStudentAction(rollNo: string, name: string, courseIds: string[] = []) {
  await requireAccess('admin');

  const res = await query(
    `INSERT INTO students (roll_no, name, active) VALUES (UPPER(TRIM($1)), $2, true) RETURNING *;`,
    [rollNo, name.trim()]
  );
  const student = res.rows[0];

  for (const cId of courseIds) {
    await query(
      `INSERT INTO enrollments (student_id, course_id, batch) VALUES ($1, $2, 'General') ON CONFLICT DO NOTHING;`,
      [student.id, cId]
    );
  }

  await logAudit({
    action: 'CREATE_STUDENT',
    entity: 'students',
    entityId: student.id,
    after: { student, enrolledCourses: courseIds },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, student };
}

export async function updateStudentAction(id: string, rollNo: string, name: string, active: boolean, courseIds: string[] = []) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM students WHERE id = $1`, [id]);
  const res = await query(
    `UPDATE students SET roll_no = UPPER(TRIM($1)), name = $2, active = $3 WHERE id = $4 RETURNING *;`,
    [rollNo, name.trim(), active, id]
  );

  await query(`DELETE FROM enrollments WHERE student_id = $1`, [id]);
  for (const cId of courseIds) {
    await query(
      `INSERT INTO enrollments (student_id, course_id, batch) VALUES ($1, $2, 'General') ON CONFLICT DO NOTHING;`,
      [id, cId]
    );
  }

  await logAudit({
    action: 'UPDATE_STUDENT',
    entity: 'students',
    entityId: id,
    before: before.rows[0],
    after: { student: res.rows[0], courseIds },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true };
}

export async function bulkImportStudentsCsvAction(csvContent: string, defaultCourseId?: string) {
  await requireAccess('admin');

  const lines = csvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  // Load courses
  const coursesRes = await query(`SELECT id, code FROM courses`);
  const courseCodeMap = new Map<string, string>();
  coursesRes.rows.forEach((c) => courseCodeMap.set(c.code.toUpperCase(), c.id));

  let imported = 0;
  await withTransaction(async (client) => {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2) continue;

      const rollNo = parts[0].toUpperCase();
      const name = parts[1];
      const courseCode = parts[2] ? parts[2].toUpperCase() : null;

      if (!rollNo || !name) continue;

      const stuRes = await client.query(
        `INSERT INTO students (roll_no, name, active)
         VALUES ($1, $2, true)
         ON CONFLICT (roll_no) DO UPDATE SET name = EXCLUDED.name, active = true
         RETURNING id;`,
        [rollNo, name]
      );
      const studentId = stuRes.rows[0].id;

      const targetCourseId = (courseCode && courseCodeMap.get(courseCode)) || defaultCourseId;
      if (targetCourseId) {
        await client.query(
          `INSERT INTO enrollments (student_id, course_id, batch)
           VALUES ($1, $2, 'Batch-1') ON CONFLICT DO NOTHING;`,
          [studentId, targetCourseId]
        );
      }
      imported++;
    }
  });

  await logAudit({
    action: 'BULK_IMPORT_STUDENTS_CSV',
    entity: 'students',
    after: { count: imported },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, count: imported };
}

// -------------------------------------------------------------
// 5. Class Codes Actions & Board Presentation
// -------------------------------------------------------------

function generateRandomCode(prefix = 'ABG'): string {
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
}

export async function generateClassCodeAction(
  courseId: string,
  dateStr: string = getTodayIST(),
  codeCustom?: string,
  ttlMinutes = 1440
) {
  await requireAccess('admin');

  const courseRes = await query(`SELECT code FROM courses WHERE id = $1`, [courseId]);
  const codePrefix = courseRes.rows[0]?.code || 'ABG';
  const finalCode = (codeCustom && codeCustom.trim().toUpperCase()) || generateRandomCode(codePrefix);

  const { validFrom, validUntil } = getTodayBoundsIST(ttlMinutes);

  const res = await query(
    `INSERT INTO class_codes (course_id, batch, class_date, code, valid_from, valid_until)
     VALUES ($1, 'Main', $2, $3, $4, $5) RETURNING *;`,
    [courseId, dateStr, finalCode, validFrom, validUntil]
  );

  await logAudit({
    action: 'GENERATE_CLASS_CODE',
    entity: 'class_codes',
    entityId: res.rows[0].id,
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/submit');
  return { success: true, classCode: res.rows[0] };
}

export async function autoGenerateDailyCodesAction() {
  await requireAccess('admin');

  const today = getTodayIST();
  const courses = await query(`SELECT id, code FROM courses WHERE active = true`);
  const generated: any[] = [];

  for (const c of courses.rows) {
    const code = generateRandomCode(c.code);
    const { validFrom, validUntil } = getTodayBoundsIST(1440);
    const res = await query(
      `INSERT INTO class_codes (course_id, batch, class_date, code, valid_from, valid_until)
       VALUES ($1, 'AutoDaily', $2, $3, $4, $5) RETURNING *;`,
      [c.id, today, code, validFrom, validUntil]
    );
    generated.push(res.rows[0]);
  }

  await logAudit({
    action: 'AUTO_GENERATE_DAILY_CODES',
    entity: 'class_codes',
    after: { count: generated.length, date: today },
  });

  revalidatePath('/admin');
  revalidatePath('/submit');
  return { success: true, count: generated.length };
}

// -------------------------------------------------------------
// 6. PIN Management Actions
// -------------------------------------------------------------

export async function resetStudentPinAction(studentId: string, newPin: string) {
  await requireAccess('admin');

  // Validate PIN: 4–8 numeric digits
  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error('PIN must be 4–8 numeric digits.');
  }

  const before = await query(`SELECT id, roll_no, name FROM students WHERE id = $1`, [studentId]);
  if (!before.rows[0]) throw new Error('Student not found.');

  await query(`UPDATE students SET pin = $1 WHERE id = $2`, [newPin, studentId]);

  await logAudit({
    action: 'RESET_STUDENT_PIN',
    entity: 'students',
    entityId: studentId,
    before: { pin: '[REDACTED]' },
    after: { pin: '[REDACTED]' },
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function resetTeacherPinAction(teacherId: string, newPin: string) {
  await requireAccess('admin');

  // Validate PIN: 4–8 numeric digits
  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error('PIN must be 4–8 numeric digits.');
  }

  const before = await query(`SELECT id, name FROM teachers WHERE id = $1`, [teacherId]);
  if (!before.rows[0]) throw new Error('Teacher not found.');

  await query(`UPDATE teachers SET pin = $1 WHERE id = $2`, [newPin, teacherId]);

  await logAudit({
    action: 'RESET_TEACHER_PIN',
    entity: 'teachers',
    entityId: teacherId,
    before: { pin: '[REDACTED]' },
    after: { pin: '[REDACTED]' },
  });

  revalidatePath('/admin');
  return { success: true };
}

// -------------------------------------------------------------
// 7. Review Queue Actions
// -------------------------------------------------------------

export async function clearFlaggedEntry(entryId: string) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM entries WHERE id = $1`, [entryId]);
  const res = await query(
    `UPDATE entries SET review_status = 'CLEARED', status = 'covered' WHERE id = $1 RETURNING *;`,
    [entryId]
  );

  await logAudit({
    action: 'CLEAR_FLAGGED_ENTRY',
    entity: 'entries',
    entityId: entryId,
    before: before.rows[0],
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, entry: res.rows[0] };
}

export async function confirmViolation(entryId: string) {
  await requireAccess('admin');

  const before = await query(`SELECT * FROM entries WHERE id = $1`, [entryId]);
  const res = await query(
    `UPDATE entries SET review_status = 'VIOLATION' WHERE id = $1 RETURNING *;`,
    [entryId]
  );

  await logAudit({
    action: 'CONFIRM_VIOLATION',
    entity: 'entries',
    entityId: entryId,
    before: before.rows[0],
    after: res.rows[0],
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, entry: res.rows[0] };
}

export async function reviewEntryAction(entryId: string, reviewStatus: 'approved' | 'rejected' | 'CLEARED' | 'VIOLATION') {
  if (reviewStatus === 'approved' || reviewStatus === 'CLEARED') {
    return clearFlaggedEntry(entryId);
  } else {
    return confirmViolation(entryId);
  }
}

// Aliases matching prompt requirements
export const resetStudentPin = resetStudentPinAction;
export const resetTeacherPin = resetTeacherPinAction;
