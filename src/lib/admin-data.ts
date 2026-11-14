import { getPbClient } from './pb';
import { getTodayIST } from './date-utils';

export async function getAdminInitialData() {
  const today = getTodayIST();
  const pb = await getPbClient();

  // 1. Courses with Settings
  const [courses, courseSettings] = await Promise.all([
    pb.collection('courses').getFullList({ sort: 'sort_order' }),
    pb.collection('course_settings').getFullList(),
  ]);

  const settingsMap = new Map(courseSettings.map((s) => [s.course, s]));
  const coursesData = courses.map((c) => {
    const s = settingsMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      sort_order: c.sort_order || 0,
      active: c.active,
      created_at: c.created,
      confirmation_threshold: s?.confirmation_threshold || 5,
      daily_entry_cap: s?.daily_entry_cap || 6,
      code_ttl_minutes: s?.code_ttl_minutes || 60,
      require_class_code: s?.require_class_code ?? false,
    };
  });

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  // 2. Subjects with Courses & Topics Count
  const [subjects, topics] = await Promise.all([
    pb.collection('subjects').getFullList({ sort: 'sort_order', expand: 'course' }),
    pb.collection('topics').getFullList({ sort: 'seq_no' }),
  ]);

  const subjectTopicCountMap = new Map<string, number>();
  for (const t of topics) {
    subjectTopicCountMap.set(t.subject, (subjectTopicCountMap.get(t.subject) || 0) + 1);
  }

  const subjectsData = subjects.map((s) => {
    const course = (s.expand as any)?.course || courseMap.get(s.course);
    return {
      id: s.id,
      course_id: s.course,
      name: s.name,
      sort_order: s.sort_order || 0,
      course_name: course?.name || 'Unknown',
      course_code: course?.code || '',
      topics_count: subjectTopicCountMap.get(s.id) || 0,
    };
  });

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // 3. Topics Data
  const topicsData = topics.map((t) => {
    const sub = subjectMap.get(t.subject);
    const course = sub ? courseMap.get(sub.course) : null;
    return {
      id: t.id,
      subject_id: t.subject,
      name: t.name,
      seq_no: t.seq_no,
      target_date: t.target_date ? t.target_date.split(' ')[0] : null,
      notes: t.notes || null,
      subject_name: sub?.name || 'Unknown',
      course_id: sub?.course || '',
      course_code: course?.code || '',
    };
  });

  // 4. Teachers with Assigned Subjects
  const [teachers, teacherSubjects] = await Promise.all([
    pb.collection('teachers').getFullList({ sort: 'name' }),
    pb.collection('teacher_subjects').getFullList(),
  ]);

  const teacherAssignedSubjectIds = new Map<string, string[]>();
  for (const ts of teacherSubjects) {
    if (!teacherAssignedSubjectIds.has(ts.teacher)) {
      teacherAssignedSubjectIds.set(ts.teacher, []);
    }
    teacherAssignedSubjectIds.get(ts.teacher)!.push(ts.subject);
  }

  const teachersData = teachers.map((tea) => {
    const assignedIds = teacherAssignedSubjectIds.get(tea.id) || [];
    const assignedNames = assignedIds.map((sId) => subjectMap.get(sId)?.name).filter(Boolean);
    return {
      id: tea.id,
      name: tea.name,
      phone: tea.phone || null,
      active: tea.active,
      created_at: tea.created,
      assigned_subject_ids: assignedIds,
      assigned_subject_names: assignedNames.length > 0 ? assignedNames.join(', ') : 'None',
    };
  });

  // 5. Students with Enrolled Courses
  const [students, enrollments] = await Promise.all([
    pb.collection('students').getFullList({ sort: 'roll_no' }),
    pb.collection('enrollments').getFullList(),
  ]);

  const studentEnrolledCourseIds = new Map<string, string[]>();
  for (const en of enrollments) {
    if (!studentEnrolledCourseIds.has(en.student)) {
      studentEnrolledCourseIds.set(en.student, []);
    }
    studentEnrolledCourseIds.get(en.student)!.push(en.course);
  }

  const studentsData = students.map((stu) => {
    const courseIds = studentEnrolledCourseIds.get(stu.id) || [];
    const courseCodes = courseIds.map((cId) => courseMap.get(cId)?.code).filter(Boolean);
    return {
      id: stu.id,
      roll_no: stu.roll_no,
      name: stu.name,
      active: stu.active,
      created_at: stu.created,
      enrolled_course_ids: courseIds,
      enrolled_course_codes: courseCodes.length > 0 ? courseCodes.join(', ') : 'None',
    };
  });

  // 6. Active Class Codes
  const nowMs = Date.now();
  const classCodes = await pb.collection('class_codes').getList(1, 30, {
    sort: '-created',
    expand: 'course',
  });

  const classCodesData = classCodes.items.map((cc) => {
    const course = (cc.expand as any)?.course || courseMap.get(cc.course);
    const fromMs = cc.valid_from ? new Date(cc.valid_from.replace(' ', 'T')).getTime() : 0;
    const untilMs = cc.valid_until ? new Date(cc.valid_until.replace(' ', 'T')).getTime() : 0;
    const isActive = fromMs <= nowMs && untilMs >= nowMs;
    return {
      id: cc.id,
      course_id: cc.course,
      course_name: course?.name || 'Unknown',
      course_code: course?.code || '',
      batch: cc.batch || null,
      class_date: cc.class_date,
      code: cc.code,
      valid_from: cc.valid_from,
      valid_until: cc.valid_until,
      created_at: cc.created,
      is_active_now: isActive,
    };
  });

  // 7. Review Queue (Flagged Entries with review_status in pending/flagged)
  const reviewQueue = await pb.collection('entries').getFullList({
    filter: 'review_status = "pending" || review_status = "FLAGGED" || review_status = "flagged"',
    sort: '-created',
    expand: 'student,teacher,subject,topic,course',
  });

  const reviewQueueData = reviewQueue.map((e) => {
    const student = (e.expand as any)?.student;
    const teacher = (e.expand as any)?.teacher;
    const subject = (e.expand as any)?.subject;
    const topic = (e.expand as any)?.topic;
    const course = (e.expand as any)?.course;

    return {
      id: e.id,
      class_date: e.class_date,
      status: e.status,
      remarks: e.remarks || null,
      flags: Array.isArray(e.flags) ? e.flags : [],
      review_status: e.review_status,
      device_id: e.device_id,
      created_at: e.created,
      student_name: student?.name || 'Unknown',
      roll_no: student?.roll_no || '',
      teacher_name: teacher?.name || 'Unknown',
      subject_name: subject?.name || 'Unknown',
      topic_name: topic?.name || 'Unknown',
      seq_no: topic?.seq_no || 0,
      course_name: course?.name || 'Unknown',
      course_code: course?.code || '',
    };
  });

  // 8. Audit Log & Teaching Records
  const [auditLogs, teachingRecordsRes] = await Promise.all([
    pb.collection('audit_log').getList(1, 50, {
      sort: '-created',
    }),
    pb.collection('teaching_records').getList(1, 50, {
      sort: '-created',
      expand: 'teacher,subject,topic,course',
    }).catch(() => ({ items: [] as any[] })),
  ]);

  const auditLogData = auditLogs.items.map((a) => ({
    id: a.id,
    actor_label: a.actor_label,
    action: a.action,
    entity: a.entity,
    entity_id: a.entity_id || null,
    before: a.before || null,
    after: a.after || null,
    created_at: a.created,
  }));

  const teachingRecordsData = teachingRecordsRes.items.map((tr) => {
    const teacher = (tr.expand as any)?.teacher;
    const subject = (tr.expand as any)?.subject;
    const topic = (tr.expand as any)?.topic;
    const course = (tr.expand as any)?.course;
    return {
      id: tr.id,
      session_date: tr.session_date ? tr.session_date.split(' ')[0] : '',
      status: tr.status || 'completed',
      remarks: tr.remarks || null,
      is_voided: Boolean(tr.is_voided),
      voided_by: tr.voided_by || null,
      void_reason: tr.void_reason || null,
      created_at: tr.created,
      teacher_id: tr.teacher,
      teacher_name: teacher?.name || 'Unknown Faculty',
      subject_name: subject?.name || 'Unknown Subject',
      topic_name: topic?.name || 'Unknown Topic',
      topic_seq: topic?.seq_no || 0,
      course_code: course?.code || '',
    };
  });

  return {
    today,
    courses: coursesData,
    subjects: subjectsData,
    topics: topicsData,
    teachers: teachersData,
    students: studentsData,
    classCodes: classCodesData,
    reviewQueue: reviewQueueData,
    auditLog: auditLogData,
    teachingRecords: teachingRecordsData,
  };
}
