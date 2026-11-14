'use server';

import { getPbClient } from '@/lib/pb';
import { requireAccess } from '@/lib/auth-guard';
import { logAudit } from '@/lib/audit';
import { getTodayIST, getTodayBoundsIST } from '@/lib/date-utils';
import { revalidatePath } from 'next/cache';
import { parseCsv } from '@/lib/csv-parser';
import { hashPin, generateTemporaryPin, markHashAsTemporary } from '@/lib/pin-hash';
import { validateNewPinStrength } from '@/lib/rate-limit';
import { invalidateSubmitFormDataCache } from '@/lib/submit-data';

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

  try {
    await pb.collection('course_settings').create({
      course: newCourse.id,
      confirmation_threshold: formData.confirmation_threshold || 5,
      daily_entry_cap: formData.daily_entry_cap || 6,
      code_ttl_minutes: formData.code_ttl_minutes || 60,
      require_class_code: formData.require_class_code ?? false,
    });
  } catch (err: any) {
    try {
      await pb.collection('courses').delete(newCourse.id);
    } catch (cleanupErr) {
      console.error('Failed to cleanup orphaned course:', cleanupErr);
    }
    throw new Error(`Failed to create course settings. Course creation reverted. Error: ${err.message}`);
  }

  await logAudit({
    action: 'CREATE_COURSE',
    entity: 'courses',
    entityId: newCourse.id,
    after: newCourse,
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  invalidateSubmitFormDataCache();
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
  invalidateSubmitFormDataCache();
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
  invalidateSubmitFormDataCache();
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
  invalidateSubmitFormDataCache();
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

  const createdSubIds: string[] = [];
  const createdTopIds: string[] = [];

  try {
    for (const sub of sourceSubjects) {
      const newSub = await pb.collection('subjects').create({
        course: targetCourseId,
        name: sub.name,
        sort_order: sub.sort_order,
      });
      createdSubIds.push(newSub.id);
      copiedSubjects++;

      const sourceTopics = await pb.collection('topics').getFullList({
        filter: `subject = "${sub.id}"`,
        sort: 'seq_no',
      });

      for (const top of sourceTopics) {
        const newTop = await pb.collection('topics').create({
          subject: newSub.id,
          name: top.name,
          seq_no: top.seq_no,
          target_date: top.target_date,
          notes: top.notes,
        });
        createdTopIds.push(newTop.id);
        copiedTopics++;
      }
    }
  } catch (err: any) {
    for (const topId of createdTopIds) {
      try {
        await pb.collection('topics').delete(topId);
      } catch {}
    }
    for (const subId of createdSubIds) {
      try {
        await pb.collection('subjects').delete(subId);
      } catch {}
    }
    throw new Error(`Curriculum clone failed. Reverted partial imports (${copiedSubjects} subjects, ${copiedTopics} topics). Error: ${err.message}`);
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

  const rows = parseCsv(csvContent);
  if (rows.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  const existingSubs = await pb.collection('subjects').getFullList({
    filter: `course = "${courseId}"`,
  });
  const subjectMap = new Map<string, string>();
  existingSubs.forEach((s) => subjectMap.set(s.name.toLowerCase(), s.id));

  let maxSort = existingSubs.length;
  let importedCount = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const parts = rows[i];
    if (!parts || parts.length < 2) continue;

    const subName = parts[0]?.trim();
    const topicName = parts[1]?.trim();
    const targetDate = parts[2] && parts[2].trim().match(/^\d{4}-\d{2}-\d{2}$/) ? parts[2].trim() : null;
    const notes = parts[3]?.trim() || null;

    if (!subName || !topicName) continue;

    try {
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
    } catch (err: any) {
      errors.push(`Row ${i + 1} (${subName} - ${topicName}): ${err.message}`);
    }
  }

  await logAudit({
    action: 'BULK_IMPORT_TOPICS_CSV',
    entity: 'topics',
    entityId: courseId,
    after: { importedCount, errorsCount: errors.length },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { success: true, count: importedCount, errors };
}

// -------------------------------------------------------------
// 3. Faculty Actions
// -------------------------------------------------------------

export async function createTeacherAction(name: string, phone?: string | null, customPin?: string) {
  await requireAccess('admin');
  const pb = await getPbClient();

  let pinToUse = customPin?.trim();
  if (pinToUse) {
    const validation = validateNewPinStrength(pinToUse);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid PIN.');
    }
  } else {
    pinToUse = generateTemporaryPin();
  }

  const pinHash = markHashAsTemporary(await hashPin(pinToUse));
  const teacher = await pb.collection('teachers').create({
    name: name.trim(),
    phone: phone ? phone.trim() : null,
    active: true,
    pin: '',
    pin_hash: pinHash,
  });

  await logAudit({
    action: 'CREATE_TEACHER',
    entity: 'teachers',
    entityId: teacher.id,
    after: { ...teacher, pin: '[REDACTED]', pin_hash: '[REDACTED]' },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  invalidateSubmitFormDataCache();
  revalidatePath('/submit');
  return { success: true, teacher, temporaryPin: pinToUse };
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
  invalidateSubmitFormDataCache();
  revalidatePath('/submit');
  return { success: true, teacher: updatedTeacher };
}

export async function assignTeacherSubjectsAction(teacherId: string, subjectIds: string[]) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const existing = await pb.collection('teacher_subjects').getFullList({
    filter: `teacher = "${teacherId}"`,
  });

  const existingSubjectMap = new Map(existing.map((item) => [item.subject, item.id]));
  const targetSubjectSet = new Set(subjectIds);

  const toCreate = subjectIds.filter((sId) => !existingSubjectMap.has(sId));
  const toDelete = existing.filter((item) => !targetSubjectSet.has(item.subject));

  const createdIds: string[] = [];
  try {
    for (const sId of toCreate) {
      const created = await pb.collection('teacher_subjects').create({
        teacher: teacherId,
        subject: sId,
      });
      createdIds.push(created.id);
    }
  } catch (err: any) {
    for (const id of createdIds) {
      try {
        await pb.collection('teacher_subjects').delete(id);
      } catch {}
    }
    throw new Error(`Failed to assign subjects. Existing assignments preserved. Error: ${err.message}`);
  }

  for (const item of toDelete) {
    try {
      await pb.collection('teacher_subjects').delete(item.id);
    } catch (delErr) {
      console.warn(`Failed to delete obsolete teacher_subject assignment ${item.id}:`, delErr);
    }
  }

  await logAudit({
    action: 'ASSIGN_TEACHER_SUBJECTS',
    entity: 'teacher_subjects',
    entityId: teacherId,
    after: { subjectIds },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  invalidateSubmitFormDataCache();
  revalidatePath('/submit');
  return { success: true };
}

// -------------------------------------------------------------
// 4. Students & Enrollments Actions
// -------------------------------------------------------------

export async function createStudentAction(rollNo: string, name: string, courseIds: string[] = [], customPin?: string) {
  await requireAccess('admin');
  const pb = await getPbClient();

  let pinToUse = customPin?.trim();
  if (pinToUse) {
    const validation = validateNewPinStrength(pinToUse);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid PIN.');
    }
  } else {
    pinToUse = generateTemporaryPin();
  }

  const pinHash = markHashAsTemporary(await hashPin(pinToUse));
  const student = await pb.collection('students').create({
    roll_no: rollNo.trim().toUpperCase(),
    name: name.trim(),
    active: true,
    pin: '',
    pin_hash: pinHash,
  });

  const createdEnrollmentIds: string[] = [];
  try {
    for (const cId of courseIds) {
      const en = await pb.collection('enrollments').create({
        student: student.id,
        course: cId,
        batch: 'General',
      });
      createdEnrollmentIds.push(en.id);
    }
  } catch (err: any) {
    // Compensating rollback
    for (const enId of createdEnrollmentIds) {
      try {
        await pb.collection('enrollments').delete(enId);
      } catch {}
    }
    try {
      await pb.collection('students').delete(student.id);
    } catch {}
    throw new Error(`Failed to enroll student. Student creation reverted. Error: ${err.message}`);
  }

  await logAudit({
    action: 'CREATE_STUDENT',
    entity: 'students',
    entityId: student.id,
    after: { student, enrolledCourses: courseIds, pin: '[REDACTED]', pin_hash: '[REDACTED]' },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  invalidateSubmitFormDataCache();
  revalidatePath('/submit');
  return { success: true, student, temporaryPin: pinToUse };
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

  // Reconcile enrollments atomically
  const existingEnrollments = await pb.collection('enrollments').getFullList({
    filter: `student = "${id}"`,
  });

  const existingCourseMap = new Map(existingEnrollments.map((en) => [en.course, en.id]));
  const targetCourseSet = new Set(courseIds);

  const toAdd = courseIds.filter((cId) => !existingCourseMap.has(cId));
  const toRemove = existingEnrollments.filter((en) => !targetCourseSet.has(en.course));

  const createdEnrollmentIds: string[] = [];
  try {
    for (const cId of toAdd) {
      const en = await pb.collection('enrollments').create({
        student: id,
        course: cId,
        batch: 'General',
      });
      createdEnrollmentIds.push(en.id);
    }
  } catch (err: any) {
    for (const enId of createdEnrollmentIds) {
      try {
        await pb.collection('enrollments').delete(enId);
      } catch {}
    }
    throw new Error(`Failed to update student enrollments. Changes reverted. Error: ${err.message}`);
  }

  for (const en of toRemove) {
    try {
      await pb.collection('enrollments').delete(en.id);
    } catch (delErr) {
      console.warn(`Failed to delete obsolete enrollment ${en.id}:`, delErr);
    }
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
  invalidateSubmitFormDataCache();
  revalidatePath('/submit');
  return { success: true };
}

export async function bulkImportStudentsCsvAction(csvContent: string, defaultCourseId?: string) {
  await requireAccess('admin');
  const pb = await getPbClient();

  const rows = parseCsv(csvContent);
  if (rows.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  const courses = await pb.collection('courses').getFullList();
  const courseCodeMap = new Map<string, string>();
  courses.forEach((c) => courseCodeMap.set(c.code.toUpperCase(), c.id));

  let imported = 0;
  const errors: string[] = [];
  const generatedPins: Array<{ rollNo: string; name: string; temporaryPin: string }> = [];

  for (let i = 1; i < rows.length; i++) {
    const parts = rows[i];
    if (!parts || parts.length < 2) continue;

    const rollNo = parts[0]?.trim().toUpperCase();
    const name = parts[1]?.trim();
    const courseCode = parts[2] ? parts[2].trim().toUpperCase() : null;
    const customPin = parts[3]?.trim();

    if (!rollNo || !name) continue;

    const targetCourseId = (courseCode ? courseCodeMap.get(courseCode) : null) || defaultCourseId;

    try {
      let pinToUse = customPin;
      if (pinToUse && validateNewPinStrength(pinToUse).valid) {
        // use provided strong non-trivial numeric PIN from CSV
      } else {
        pinToUse = generateTemporaryPin();
      }
      const pinHash = markHashAsTemporary(await hashPin(pinToUse));

      const student = await pb.collection('students').create({
        roll_no: rollNo,
        name,
        active: true,
        pin: '',
        pin_hash: pinHash,
      });
      imported++;
      generatedPins.push({ rollNo, name, temporaryPin: pinToUse });

      if (targetCourseId) {
        await pb.collection('enrollments').create({
          student: student.id,
          course: targetCourseId,
          batch: 'General',
        });
      }
    } catch (err: any) {
      errors.push(`Row ${i + 1} (${rollNo} - ${name}): ${err.message}`);
    }
  }

  await logAudit({
    action: 'BULK_IMPORT_STUDENTS_CSV',
    entity: 'students',
    after: { importedCount: imported, errorsCount: errors.length },
  });

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  invalidateSubmitFormDataCache();
  revalidatePath('/submit');
  return { success: true, count: imported, errors, generatedPins };
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
  invalidateSubmitFormDataCache();
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
  invalidateSubmitFormDataCache();
  revalidatePath('/submit');
  return { success: true, count: generated.length };
}

// -------------------------------------------------------------
// 6. PIN Management Actions
// -------------------------------------------------------------

export async function resetStudentPinAction(studentId: string, newPin?: string) {
  await requireAccess('admin');

  let pinToUse = newPin?.trim();
  if (pinToUse) {
    const validation = validateNewPinStrength(pinToUse);
    if (!validation.valid) {
      throw new Error(validation.error || 'PIN must be 4–8 numeric digits and not a trivial default pattern.');
    }
  } else {
    pinToUse = generateTemporaryPin();
  }

  const pb = await getPbClient();
  const before = await pb.collection('students').getOne(studentId).catch(() => null);
  if (!before) throw new Error('Student not found.');

  const pinHash = markHashAsTemporary(await hashPin(pinToUse));
  await pb.collection('students').update(studentId, {
    pin: '',
    pin_hash: pinHash,
  });

  await logAudit({
    action: 'RESET_STUDENT_PIN',
    entity: 'students',
    entityId: studentId,
    before: { pin: '[REDACTED]', pin_hash: '[REDACTED]' },
    after: { pin: '[REDACTED]', pin_hash: '[REDACTED]' },
  });

  revalidatePath('/admin');
  return { success: true, temporaryPin: pinToUse };
}

export async function resetTeacherPinAction(teacherId: string, newPin?: string) {
  await requireAccess('admin');

  let pinToUse = newPin?.trim();
  if (pinToUse) {
    const validation = validateNewPinStrength(pinToUse);
    if (!validation.valid) {
      throw new Error(validation.error || 'PIN must be 4–8 numeric digits and not a trivial default pattern.');
    }
  } else {
    pinToUse = generateTemporaryPin();
  }

  const pb = await getPbClient();
  const before = await pb.collection('teachers').getOne(teacherId).catch(() => null);
  if (!before) throw new Error('Teacher not found.');

  const pinHash = markHashAsTemporary(await hashPin(pinToUse));
  await pb.collection('teachers').update(teacherId, {
    pin: '',
    pin_hash: pinHash,
  });

  await logAudit({
    action: 'RESET_TEACHER_PIN',
    entity: 'teachers',
    entityId: teacherId,
    before: { pin: '[REDACTED]', pin_hash: '[REDACTED]' },
    after: { pin: '[REDACTED]', pin_hash: '[REDACTED]' },
  });

  revalidatePath('/admin');
  return { success: true, temporaryPin: pinToUse };
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

// -------------------------------------------------------------
// 8. Teaching Records Actions (BUG-035)
// -------------------------------------------------------------

export async function voidTeachingRecordAction(recordId: string, voidReason: string) {
  // Use requireAccess supporting role arrays (BUG-035 Fix)
  const access = await requireAccess(['admin', 'faculty']);
  if (!access.allowed || !access.user) {
    throw new Error('Unauthorized. Admin or faculty credentials required.');
  }

  if (!recordId || typeof recordId !== 'string') {
    throw new Error('Valid teaching record ID is required.');
  }

  const trimmedReason = (voidReason || '').trim();
  if (trimmedReason.length < 10) {
    throw new Error('Void reason must be at least 10 characters long.');
  }

  const pb = await getPbClient();
  const existingRecord = await pb.collection('teaching_records').getOne(recordId);
  if (!existingRecord) {
    throw new Error('Teaching record not found.');
  }

  if (existingRecord.is_voided) {
    throw new Error('This teaching record has already been voided.');
  }

  // If faculty role, ensure faculty can only void their own teaching records
  if (access.user.role === 'faculty' && access.user.teacherId) {
    if (existingRecord.teacher !== access.user.teacherId) {
      throw new Error('Faculty members may only void their own teaching records.');
    }
  }

  const nowIso = new Date().toISOString();
  const updated = await pb.collection('teaching_records').update(recordId, {
    is_voided: true,
    voided_at: nowIso,
    voided_by: access.user.label || access.user.id,
    void_reason: trimmedReason,
  });

  await logAudit({
    action: 'VOID_TEACHING_RECORD',
    entity: 'teaching_records',
    entityId: recordId,
    before: { is_voided: false },
    after: { is_voided: true, voided_at: nowIso, void_reason: trimmedReason },
  });

  revalidatePath('/teacher');
  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return { success: true, record: updated };
}

