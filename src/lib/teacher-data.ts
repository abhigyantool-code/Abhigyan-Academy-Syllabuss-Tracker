import { getPbClient } from './pb';
import { getTodayIST } from './date-utils';
import { computeEffectiveThreshold, determineTopicStatus } from './coverage-calculator';

export interface TeacherAssignedSubject {
  subject_id: string;
  subject_name: string;
  course_id: string;
  course_name: string;
  course_code: string;
  total_topics: number;
  covered_topics: number;
  progress_pct: number;
}

export interface TeacherRecentEntry {
  id: string;
  class_date: string;
  status: string;
  remarks: string | null;
  created_at: string;
  student_name: string;
  student_roll: string;
  subject_name: string;
  topic_id: string;
  topic_name: string;
  topic_seq: number;
  course_code: string;
}

export interface TeacherTopicItem {
  id: string;
  subject_id: string;
  course_id: string;
  name: string;
  seq_no: number;
  target_date: string | null;
  notes: string | null;
  status: 'covered' | 'in_progress' | 'overdue' | 'not_started';
  student_confirmations: number;
}

export interface TeacherDashboardData {
  teacher: {
    id: string;
    name: string;
    phone: string | null;
  };
  subjects: TeacherAssignedSubject[];
  selectedSubjectId: string;
  selectedCourseId: string;
  topics: TeacherTopicItem[];
  recentStudentLogs: TeacherRecentEntry[];
  today: string;
}

export async function getTeacherDashboardData(
  teacherId: string,
  subjectId?: string
): Promise<TeacherDashboardData | null> {
  const today = getTodayIST();
  const pb = await getPbClient();

  // 1. Fetch Teacher Profile
  let teacher: any;
  try {
    teacher = await pb.collection('teachers').getOne(teacherId);
  } catch {
    return null;
  }

  // 2. Fetch Assigned Subjects with Courses
  const teacherSubjects = await pb.collection('teacher_subjects').getFullList({
    filter: `teacher = "${teacherId}"`,
    expand: 'subject.course',
  });

  if (teacherSubjects.length === 0) {
    return {
      teacher: { id: teacher.id, name: teacher.name, phone: teacher.phone },
      subjects: [],
      selectedSubjectId: '',
      selectedCourseId: '',
      topics: [],
      recentStudentLogs: [],
      today,
    };
  }

  // Group by distinct subjects
  const subjectMap = new Map<string, any>();
  for (const ts of teacherSubjects) {
    const sub = (ts.expand as any)?.subject;
    const course = sub?.expand?.course;
    if (sub && course && course.active) {
      subjectMap.set(sub.id, { sub, course });
    }
  }

  // Fetch all enrollments to know student counts per course
  const enrollments = await pb.collection('enrollments').getFullList();
  const courseEnrollmentCount = new Map<string, number>();
  for (const en of enrollments) {
    courseEnrollmentCount.set(en.course, (courseEnrollmentCount.get(en.course) || 0) + 1);
  }

  // Fetch course settings for confirmation thresholds
  const courseSettingsList = await pb.collection('course_settings').getFullList();
  const settingsMap = new Map(courseSettingsList.map((s) => [s.course, s]));

  // Batch fetch topics and entries for all assigned subjects in one round-trip (NEW-01: include teaching_records)
  const subjectIds = Array.from(subjectMap.keys());
  const subjectFilter = subjectIds.map((id) => `subject = "${id}"`).join(' || ');

  const teachingRecordsPromise = pb
    .collection('teaching_records')
    .getFullList({
      filter: `(${subjectFilter}) && is_voided = false`,
    })
    .catch(() => [] as any[]);

  const [allTopics, allEntries, allTeachingRecords] = await Promise.all([
    pb.collection('topics').getFullList({
      filter: subjectFilter,
      sort: 'seq_no',
    }),
    pb.collection('entries').getFullList({
      filter: `(${subjectFilter}) && review_status != "rejected" && review_status != "VIOLATION"`,
    }),
    teachingRecordsPromise,
  ]);

  const topicsBySubject = new Map<string, any[]>();
  for (const t of allTopics) {
    if (!topicsBySubject.has(t.subject)) topicsBySubject.set(t.subject, []);
    topicsBySubject.get(t.subject)!.push(t);
  }

  const entriesBySubject = new Map<string, any[]>();
  for (const ent of allEntries) {
    if (!entriesBySubject.has(ent.subject)) entriesBySubject.set(ent.subject, []);
    entriesBySubject.get(ent.subject)!.push(ent);
  }

  const teachingRecordsBySubject = new Map<string, any[]>();
  for (const tr of allTeachingRecords) {
    if (!teachingRecordsBySubject.has(tr.subject)) teachingRecordsBySubject.set(tr.subject, []);
    teachingRecordsBySubject.get(tr.subject)!.push(tr);
  }

  const subjects: TeacherAssignedSubject[] = [];

  for (const [sId, { sub, course }] of subjectMap.entries()) {
    const subTopics = topicsBySubject.get(sId) || [];
    const entries = entriesBySubject.get(sId) || [];
    const teachingRecs = teachingRecordsBySubject.get(sId) || [];

    const enrolled = courseEnrollmentCount.get(course.id) || 10;
    const thresholdSetting = settingsMap.get(course.id)?.confirmation_threshold || 5;
    const effectiveThreshold = computeEffectiveThreshold(thresholdSetting, enrolled);

    // Group entries by topic
    const topicStats = new Map<string, { covered: Set<string>; partial: Set<string>; approved: boolean }>();
    for (const ent of entries) {
      if (!topicStats.has(ent.topic)) {
        topicStats.set(ent.topic, { covered: new Set(), partial: new Set(), approved: false });
      }
      const stat = topicStats.get(ent.topic)!;
      if (ent.status === 'covered' && (ent.review_status === 'auto' || ent.review_status === 'approved')) {
        stat.covered.add(ent.student);
      }
      if (ent.status === 'partial' && (ent.review_status === 'auto' || ent.review_status === 'approved')) {
        stat.partial.add(ent.student);
      }
      if (ent.review_status === 'approved' && ent.status === 'covered') {
        stat.approved = true;
      }
    }

    // Integrate teaching_records (NEW-01: Faculty endorsements fulfill topic coverage without double-counting)
    for (const tr of teachingRecs) {
      if (!topicStats.has(tr.topic)) {
        topicStats.set(tr.topic, { covered: new Set(), partial: new Set(), approved: false });
      }
      const stat = topicStats.get(tr.topic)!;
      if (tr.status === 'completed') {
        stat.approved = true;
      }
    }

    let coveredCount = 0;
    for (const t of subTopics) {
      const stat = topicStats.get(t.id);
      const isCovered =
        stat?.approved ||
        (stat?.covered.size || 0) >= effectiveThreshold;
      if (isCovered) coveredCount++;
    }

    const total = subTopics.length;
    const pct = total > 0 ? Math.round((coveredCount / total) * 100) : 0;

    subjects.push({
      subject_id: sub.id,
      subject_name: sub.name,
      course_id: course.id,
      course_name: course.name,
      course_code: course.code,
      total_topics: total,
      covered_topics: coveredCount,
      progress_pct: pct,
    });
  }

  const activeSubject = subjects.find((s) => s.subject_id === subjectId) || subjects[0];
  const selectedSubjectId = activeSubject?.subject_id || '';
  const selectedCourseId = activeSubject?.course_id || '';

  // 3. Detailed topic line items for selected subject (derived from batch results)
  let topics: TeacherTopicItem[] = [];
  if (selectedSubjectId) {
    const rawTopics = topicsBySubject.get(selectedSubjectId) || [];
    const entries = entriesBySubject.get(selectedSubjectId) || [];
    const teachingRecs = teachingRecordsBySubject.get(selectedSubjectId) || [];

    const enrolled = courseEnrollmentCount.get(selectedCourseId) || 10;
    const thresholdSetting = settingsMap.get(selectedCourseId)?.confirmation_threshold || 5;
    const effectiveThreshold = computeEffectiveThreshold(thresholdSetting, enrolled);

    const topicStats = new Map<string, { covered: Set<string>; partial: Set<string>; approved: boolean }>();
    for (const ent of entries) {
      if (!topicStats.has(ent.topic)) {
        topicStats.set(ent.topic, { covered: new Set(), partial: new Set(), approved: false });
      }
      const stat = topicStats.get(ent.topic)!;
      if (ent.status === 'covered' && (ent.review_status === 'auto' || ent.review_status === 'approved')) {
        stat.covered.add(ent.student);
      }
      if (ent.status === 'partial' && (ent.review_status === 'auto' || ent.review_status === 'approved')) {
        stat.partial.add(ent.student);
      }
      if (ent.review_status === 'approved' && ent.status === 'covered') {
        stat.approved = true;
      }
    }

    // Integrate teaching_records (NEW-01: Faculty endorsements directly fulfill coverage)
    for (const tr of teachingRecs) {
      if (!topicStats.has(tr.topic)) {
        topicStats.set(tr.topic, { covered: new Set(), partial: new Set(), approved: false });
      }
      const stat = topicStats.get(tr.topic)!;
      if (tr.status === 'completed') {
        stat.approved = true;
      }
    }

    topics = rawTopics.map((t) => {
      const stat = topicStats.get(t.id);
      const coveredConfirmations = stat?.covered.size || 0;
      const partialConfirmations = stat?.partial.size || 0;
      const targetDate = t.target_date ? t.target_date.split(' ')[0] : null;

      const rawStatus = determineTopicStatus({
        hasAdminApproval: stat?.approved || false,
        coveredConfirmations,
        partialConfirmations,
        effectiveThreshold,
        targetDate,
        todayIST: today,
      });

      const normalizedStatus = rawStatus === 'unverified' ? 'in_progress' : rawStatus;

      return {
        id: t.id,
        subject_id: t.subject,
        course_id: selectedCourseId,
        name: t.name,
        seq_no: t.seq_no,
        target_date: targetDate,
        notes: t.notes || null,
        status: normalizedStatus as any,
        student_confirmations: coveredConfirmations,
      };
    });
  }

  // 4. Fetch recent student logs for this teacher
  const logsRes = await pb.collection('entries').getList(1, 40, {
    filter: `teacher = "${teacherId}"`,
    sort: '-created',
    expand: 'student,subject,topic,course',
  });

  const recentStudentLogs: TeacherRecentEntry[] = logsRes.items.map((r) => {
    const student = (r.expand as any)?.student;
    const subject = (r.expand as any)?.subject;
    const topic = (r.expand as any)?.topic;
    const course = (r.expand as any)?.course;

    return {
      id: r.id,
      class_date: r.class_date || '',
      status: r.status,
      remarks: r.remarks || null,
      created_at: r.created,
      student_name: student?.name || 'Unknown Student',
      student_roll: student?.roll_no || '',
      subject_name: subject?.name || '',
      topic_id: topic?.id || r.topic,
      topic_name: topic?.name || '',
      topic_seq: topic?.seq_no || 0,
      course_code: course?.code || '',
    };
  });

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      phone: teacher.phone || null,
    },
    subjects,
    selectedSubjectId,
    selectedCourseId,
    topics,
    recentStudentLogs,
    today,
  };
}
