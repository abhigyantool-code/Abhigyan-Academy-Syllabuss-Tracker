'use server';

import { getPbClient } from '@/lib/pb';
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
  const pb = await getPbClient();

  const newCourse = await pb.collection('courses').create({
    name: formData.name.trim(),
    code: formData.code.trim().toUpperCase(),
    sort_order: formData.sort_order || 1,
    active: true,
  });

  const newSettings = await pb.collection('course_settings').create({
    course: newCourse.id,
    confirmation_threshold: formData.confirmation_threshold || 5,
    daily_entry_cap: formData.daily_entry_cap || 6,
    code_ttl_minutes: formData.code_ttl_minutes || 60,
    require_class_code: formData.require_class_code ?? false,
  });

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
  const pb = await getPbClient();

  const before = await pb.collection('courses').getOne(id).catch(() => null);
  const updatedCourse = await pb.collection('courses').update(id, {
    name: formData.name.trim(),
    code: formData.code.trim().toUpperCase(),
    sort_order: formData.sort_order,
    active: formData.active,
  });

  await logAudit({
    action: 'UPDATE_COURSE',
    entity: 'courses',
    entityId: id,
    before,
    after: updatedCourse,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, course: updatedCourse };
}

export async function toggleCourseActiveAction(id: string, active: boolean) {
  await requireAccess('admin');
  const pb = await getPbClient();

  await pb.collection('courses').update(id, { active });
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
  const pb = await getPbClient();

  let existingSetting: any = null;
  try {
    existingSetting = await pb.collection('course_settings').getFirstListItem(`course = "${courseId}"`);
  } catch {}

  let updatedSetting: any;
  if (existingSetting) {
    updatedSetting = await pb.collection('course_settings').update(existingSetting.id, {
      confirmation_threshold: settings.confirmation_threshold,
      daily_entry_cap: settings.daily_entry_cap,
      code_ttl_minutes: settings.code_ttl_minutes,
      require_class_code: settings.require_class_code,
    });
  } else {
    updatedSetting = await pb.collection('course_settings').create({
      course: courseId,
      confirmation_threshold: settings.confirmation_threshold,
      daily_entry_cap: settings.daily_entry_cap,
      code_ttl_minutes: settings.code_ttl_minutes,
      require_class_code: settings.require_class_code,
    });
  }

  await logAudit({
    action: 'UPDATE_COURSE_SETTINGS',
    entity: 'course_settings',
    entityId: courseId,
    before: existingSetting,
    after: updatedSetting,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, settings: updatedSetting };
}

// -------------------------------------------------------------
// 2. Curriculum (Subjects & Topics) Actions
// -------------------------------------------------------------

export async function createSubjectAction(courseId: string, name: string, sortOrder = 1) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const subject = await pb.collection('subjects').create({
    course: courseId,
    name: name.trim(),
    sort_order: sortOrder,
  });

  await logAudit({
    action: 'CREATE_SUBJECT',
    entity: 'subjects',
    entityId: subject.id,
    after: subject,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, subject };
}

export async function updateSubjectAction(id: string, name: string, sortOrder: number) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const before = await pb.collection('subjects').getOne(id).catch(() => null);
  const updatedSubject = await pb.collection('subjects').update(id, {
    name: name.trim(),
    sort_order: sortOrder,
  });

  await logAudit({
    action: 'UPDATE_SUBJECT',
    entity: 'subjects',
    entityId: id,
    before,
    after: updatedSubject,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, subject: updatedSubject };
}

export async function deleteSubjectAction(id: string) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const before = await pb.collection('subjects').getOne(id).catch(() => null);
  await pb.collection('subjects').delete(id);

  await logAudit({
    action: 'DELETE_SUBJECT',
    entity: 'subjects',
    entityId: id,
    before,
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
  const pb = await getPbClient();

  const topic = await pb.collection('topics').create({
    subject: subjectId,
    name: name.trim(),
    seq_no: seqNo,
    target_date: targetDate ? `${targetDate} 00:00:00.000Z` : null,
    notes: notes ? notes.trim() : null,
  });

  await logAudit({
    action: 'CREATE_TOPIC',
    entity: 'topics',
    entityId: topic.id,
    after: topic,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, topic };
}

export async function updateTopicAction(
  id: string,
  name: string,
  seqNo: number,
  targetDate?: string | null,
  notes?: string | null
) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const before = await pb.collection('topics').getOne(id).catch(() => null);
  const updatedTopic = await pb.collection('topics').update(id, {
    name: name.trim(),
    seq_no: seqNo,
    target_date: targetDate ? `${targetDate} 00:00:00.000Z` : null,
    notes: notes ? notes.trim() : null,
  });

  await logAudit({
    action: 'UPDATE_TOPIC',
    entity: 'topics',
    entityId: id,
    before,
    after: updatedTopic,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, topic: updatedTopic };
}

export async function deleteTopicAction(id: string) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const before = await pb.collection('topics').getOne(id).catch(() => null);
  await pb.collection('topics').delete(id);

  await logAudit({
    action: 'DELETE_TOPIC',
    entity: 'topics',
    entityId: id,
    before,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function reorderTopicsAction(subjectId: string, orderedTopicIds: string[]) {
  await requireAccess('admin');
  const pb = await getPbClient();

  for (let i = 0; i < orderedTopicIds.length; i++) {
    await pb.collection('topics').update(orderedTopicIds[i], {
      seq_no: i + 1,
    });
  }

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

  const pb = await getPbClient();
  const sourceSubjects = await pb.collection('subjects').getFullList({
    filter: `course = "${sourceCourseId}"`,
    sort: 'sort_order',
  });

  let copiedSubjects = 0;
  let copiedTopics = 0;

  for (const sub of sourceSubjects) {
    const newSub = await pb.collection('subjects').create({
      course: targetCourseId,
      name: sub.name,
      sort_order: sub.sort_order,
    });
    copiedSubjects++;

    const sourceTopics = await pb.collection('topics').getFullList({
      filter: `subject = "${sub.id}"`,
      sort: 'seq_no',
    });

    for (const top of sourceTopics) {
      await pb.collection('topics').create({
        subject: newSub.id,
        name: top.name,
        seq_no: top.seq_no,
        target_date: top.target_date,
        notes: top.notes,
      });
      copiedTopics++;
    }
  }

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
  const pb = await getPbClient();

  const lines = csvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  const existingSubs = await pb.collection('subjects').getFullList({
    filter: `course = "${courseId}"`,
  });
  const subjectMap = new Map<string, string>();
  existingSubs.forEach((s) => subjectMap.set(s.name.toLowerCase(), s.id));

  let maxSort = existingSubs.length;
  let importedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
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
      const newSub = await pb.collection('subjects').create({
        course: courseId,
        name: subName,
        sort_order: maxSort,
      });
      subId = newSub.id;
      subjectMap.set(subName.toLowerCase(), subId);
    }

    const currentTopics = await pb.collection('topics').getList(1, 1, {
      filter: `subject = "${subId}"`,
      sort: '-seq_no',
    });
    const nextSeq = (currentTopics.items[0]?.seq_no || 0) + 1;

    await pb.collection('topics').create({
      subject: subId,
      name: topicName,
      seq_no: nextSeq,
      target_date: targetDate ? `${targetDate} 00:00:00.000Z` : null,
      notes,
    });
    importedCount++;
  }

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
  const pb = await getPbClient();

  const teacher = await pb.collection('teachers').create({
    name: name.trim(),
    phone: phone ? phone.trim() : null,
    active: true,
    pin: '1234',
  });

  await logAudit({
    action: 'CREATE_TEACHER',
    entity: 'teachers',
    entityId: teacher.id,
    after: teacher,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, teacher };
}

export async function updateTeacherAction(id: string, name: string, phone: string | null, active: boolean) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const before = await pb.collection('teachers').getOne(id).catch(() => null);
  const updatedTeacher = await pb.collection('teachers').update(id, {
    name: name.trim(),
    phone: phone ? phone.trim() : null,
    active,
  });

  await logAudit({
    action: 'UPDATE_TEACHER',
    entity: 'teachers',
    entityId: id,
    before,
    after: updatedTeacher,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, teacher: updatedTeacher };
}

export async function assignTeacherSubjectsAction(teacherId: string, subjectIds: string[]) {
  await requireAccess('admin');
  const pb = await getPbClient();

  // Delete existing teacher_subjects
  const existing = await pb.collection('teacher_subjects').getFullList({
    filter: `teacher = "${teacherId}"`,
  });
  for (const item of existing) {
    await pb.collection('teacher_subjects').delete(item.id);
  }

  // Create new assignments
  for (const sId of subjectIds) {
    await pb.collection('teacher_subjects').create({
      teacher: teacherId,
      subject: sId,
    });
  }

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
  const pb = await getPbClient();

  const student = await pb.collection('students').create({
    roll_no: rollNo.trim().toUpperCase(),
    name: name.trim(),
    active: true,
    pin: '1234',
  });

  for (const cId of courseIds) {
    await pb.collection('enrollments').create({
      student: student.id,
      course: cId,
      batch: 'General',
    });
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
  const pb = await getPbClient();

  const before = await pb.collection('students').getOne(id).catch(() => null);
  const updatedStudent = await pb.collection('students').update(id, {
    roll_no: rollNo.trim().toUpperCase(),
    name: name.trim(),
    active,
  });

  // Re-sync enrollments
  const existingEnrollments = await pb.collection('enrollments').getFullList({
    filter: `student = "${id}"`,
  });
  for (const en of existingEnrollments) {
    await pb.collection('enrollments').delete(en.id);
  }

  for (const cId of courseIds) {
    await pb.collection('enrollments').create({
      student: id,
      course: cId,
      batch: 'General',
    });
  }

  await logAudit({
    action: 'UPDATE_STUDENT',
    entity: 'students',
    entityId: id,
    before,
    after: { student: updatedStudent, courseIds },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true };
}

export async function bulkImportStudentsCsvAction(csvContent: string, defaultCourseId?: string) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const lines = csvContent.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  const courses = await pb.collection('courses').getFullList();
  const courseCodeMap = new Map<string, string>();
  courses.forEach((c) => courseCodeMap.set(c.code.toUpperCase(), c.id));

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;

    const rollNo = parts[0].toUpperCase();
    const name = parts[1];
    const courseCode = parts[2] ? parts[2].toUpperCase() : null;

    if (!rollNo || !name) continue;

    const targetCourseId = (courseCode ? courseCodeMap.get(courseCode) : null) || defaultCourseId;

    try {
      const student = await pb.collection('students').create({
        roll_no: rollNo,
        name,
        active: true,
        pin: '1234',
      });
      imported++;

      if (targetCourseId) {
        await pb.collection('enrollments').create({
          student: student.id,
          course: targetCourseId,
          batch: 'General',
        });
      }
    } catch {}
  }

  await logAudit({
    action: 'BULK_IMPORT_STUDENTS_CSV',
    entity: 'students',
    after: { importedCount: imported },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/submit');
  return { success: true, count: imported };
}

// -------------------------------------------------------------
// 5. Class Codes Actions
// -------------------------------------------------------------

function generateRandomCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix.substring(0, 3).toUpperCase()}-${rand}`;
}

export async function generateClassCodeAction(
  courseId: string,
  dateStr: string = getTodayIST(),
  codeCustom?: string,
  ttlMinutes = 1440
) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const course = await pb.collection('courses').getOne(courseId);
  const codePrefix = course?.code || 'ABG';
  const finalCode = (codeCustom && codeCustom.trim().toUpperCase()) || generateRandomCode(codePrefix);

  const { validFrom, validUntil } = getTodayBoundsIST(ttlMinutes);

  const classCode = await pb.collection('class_codes').create({
    course: courseId,
    batch: 'Main',
    class_date: dateStr,
    code: finalCode,
    valid_from: validFrom,
    valid_until: validUntil,
  });

  await logAudit({
    action: 'GENERATE_CLASS_CODE',
    entity: 'class_codes',
    entityId: classCode.id,
    after: classCode,
  });

  revalidatePath('/admin');
  revalidatePath('/submit');
  return { success: true, classCode };
}

export async function autoGenerateDailyCodesAction() {
  await requireAccess('admin');
  const pb = await getPbClient();

  const today = getTodayIST();
  const courses = await pb.collection('courses').getFullList({ filter: 'active = true' });
  const generated: any[] = [];

  for (const c of courses) {
    const code = generateRandomCode(c.code);
    const { validFrom, validUntil } = getTodayBoundsIST(1440);
    const classCode = await pb.collection('class_codes').create({
      course: c.id,
      batch: 'AutoDaily',
      class_date: today,
      code,
      valid_from: validFrom,
      valid_until: validUntil,
    });
    generated.push(classCode);
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

  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error('PIN must be 4–8 numeric digits.');
  }

  const pb = await getPbClient();
  const before = await pb.collection('students').getOne(studentId).catch(() => null);
  if (!before) throw new Error('Student not found.');

  await pb.collection('students').update(studentId, { pin: newPin.trim() });

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

  if (!/^\d{4,8}$/.test(newPin)) {
    throw new Error('PIN must be 4–8 numeric digits.');
  }

  const pb = await getPbClient();
  const before = await pb.collection('teachers').getOne(teacherId).catch(() => null);
  if (!before) throw new Error('Teacher not found.');

  await pb.collection('teachers').update(teacherId, { pin: newPin.trim() });

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
  const pb = await getPbClient();

  const before = await pb.collection('entries').getOne(entryId).catch(() => null);
  const updatedEntry = await pb.collection('entries').update(entryId, {
    review_status: 'CLEARED',
    status: 'covered',
  });

  await logAudit({
    action: 'CLEAR_FLAGGED_ENTRY',
    entity: 'entries',
    entityId: entryId,
    before,
    after: updatedEntry,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, entry: updatedEntry };
}

export async function confirmViolation(entryId: string) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const before = await pb.collection('entries').getOne(entryId).catch(() => null);
  const updatedEntry = await pb.collection('entries').update(entryId, {
    review_status: 'VIOLATION',
  });

  await logAudit({
    action: 'CONFIRM_VIOLATION',
    entity: 'entries',
    entityId: entryId,
    before,
    after: updatedEntry,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, entry: updatedEntry };
}

export async function reviewEntryAction(entryId: string, reviewStatus: 'approved' | 'rejected' | 'CLEARED' | 'VIOLATION') {
  if (reviewStatus === 'approved' || reviewStatus === 'CLEARED') {
    return clearFlaggedEntry(entryId);
  } else {
    return confirmViolation(entryId);
  }
}

// Aliases matching requirements
export const resetStudentPin = resetStudentPinAction;
export const resetTeacherPin = resetTeacherPinAction;
