import { getPbClient } from './pb';
import { getTodayIST } from './date-utils';
import { computeEffectiveThreshold, determineTopicStatus } from './coverage-calculator';

export interface DashboardCourse {
  id: string;
  name: string;
  code: string;
  sort_order: number;
}

export interface OverviewMetrics {
  totalTopics: number;
  coveredTopics: number;
  coveragePct: number;
  plannedTopics: number;
  plannedPct: number;
  variancePct: number;
  overdueCount: number;
  pendingReviewCount: number;
  enrolledStudents: number;
  totalClassesLogged: number;
  confirmationThreshold: number;
}

export interface SubjectProgressItem {
  subject_id: string;
  course_id: string;
  subject_name: string;
  total_topics: number;
  planned_topics: number;
  covered_topics: number;
  planned_pct: number;
  actual_pct: number;
  variance_pct: number;
}

export interface TopicProgressItem {
  topic_id: string;
  subject_id: string;
  course_id: string;
  subject_name: string;
  course_name: string;
  topic_name: string;
  seq_no: number;
  target_date: string | null;
  covered_confirmations: number;
  partial_confirmations: number;
  first_date_taught: string | null;
  last_date_taught: string | null;
  effective_threshold: number;
  status: 'covered' | 'unverified' | 'in_progress' | 'overdue' | 'not_started';
  teacher_names?: string;
}

export interface TeacherScorecardItem {
  teacher_id: string;
  teacher_name: string;
  topics_covered: number;
  avg_lag_days: number;
  last_class_logged: string | null;
  classes_logged_this_month: number;
  subject_names?: string;
}

export interface TimelineDataPoint {
  date: string;
  plannedCumulative: number;
  actualCumulative: number;
}

export interface RecentEntryItem {
  id: string;
  student_name: string;
  roll_no: string;
  teacher_name: string;
  subject_name: string;
  topic_name: string;
  class_date: string;
  status: 'covered' | 'partial' | 'revision';
  remarks: string | null;
  review_status: 'auto' | 'pending' | 'approved' | 'rejected' | 'CLEARED' | 'VIOLATION' | 'FLAGGED';
  flags: string[];
  created_at: string;
}

export async function getActiveCourses(): Promise<DashboardCourse[]> {
  const pb = await getPbClient();
  const list = await pb.collection('courses').getFullList({
    filter: 'active = true',
    sort: 'sort_order',
  });
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    sort_order: c.sort_order || 0,
  }));
}

export async function getDashboardData(courseId?: string) {
  const courses = await getActiveCourses();
  if (courses.length === 0) {
    return null;
  }

  const selectedCourse = courses.find((c) => c.id === courseId) || courses[0];
  const cId = selectedCourse.id;
  const today = getTodayIST();
  const pb = await getPbClient();

  // 1. Settings & Enrollment Count
  const [settingsList, enrollments, pendingEntriesRes] = await Promise.all([
    pb.collection('course_settings').getFullList({ filter: `course = "${cId}"` }),
    pb.collection('enrollments').getFullList({ filter: `course = "${cId}"`, expand: 'student' }),
    pb.collection('entries').getList(1, 1, { filter: `course = "${cId}" && review_status = "pending"` }),
  ]);

  const activeEnrolledStudents = enrollments.filter((e) => (e.expand as any)?.student?.active).length;
  const enrolledCount = activeEnrolledStudents || enrollments.length;
  const pendingReviewCount = pendingEntriesRes.totalItems;
  const configuredThreshold = settingsList[0]?.confirmation_threshold || 5;
  const effectiveThreshold = computeEffectiveThreshold(configuredThreshold, enrolledCount);

  // 2. Fetch Subjects & Topics for this course
  const [subjects, topics, courseEntries, teacherSubjects] = await Promise.all([
    pb.collection('subjects').getFullList({ filter: `course = "${cId}"`, sort: 'sort_order' }),
    pb.collection('topics').getFullList({
      filter: `subject.course = "${cId}"`,
      sort: 'seq_no',
    }),
    pb.collection('entries').getFullList({
      filter: `course = "${cId}" && review_status != "rejected" && review_status != "VIOLATION"`,
    }),
    pb.collection('teacher_subjects').getFullList({
      filter: `subject.course = "${cId}"`,
      expand: 'teacher',
    }),
  ]);

  // Subject ID to Name map
  const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

  // Subject to Teacher Names map
  const subjectTeachersMap = new Map<string, Set<string>>();
  for (const ts of teacherSubjects) {
    const teacherName = (ts.expand as any)?.teacher?.name;
    if (teacherName) {
      if (!subjectTeachersMap.has(ts.subject)) {
        subjectTeachersMap.set(ts.subject, new Set());
      }
      subjectTeachersMap.get(ts.subject)!.add(teacherName);
    }
  }

  // Topic ID to stats map
  const topicStatsMap = new Map<
    string,
    {
      covered: Set<string>;
      partial: Set<string>;
      approved: boolean;
      firstDate: string | null;
      lastDate: string | null;
    }
  >();

  for (const ent of courseEntries) {
    if (!topicStatsMap.has(ent.topic)) {
      topicStatsMap.set(ent.topic, {
        covered: new Set(),
        partial: new Set(),
        approved: false,
        firstDate: null,
        lastDate: null,
      });
    }
    const stat = topicStatsMap.get(ent.topic)!;
    if (ent.status === 'covered' && (ent.review_status === 'auto' || ent.review_status === 'approved' || ent.review_status === 'CLEARED')) {
      stat.covered.add(ent.student);
    }
    if (ent.status === 'partial' && (ent.review_status === 'auto' || ent.review_status === 'approved' || ent.review_status === 'CLEARED')) {
      stat.partial.add(ent.student);
    }
    if (ent.review_status === 'approved' && ent.status === 'covered') {
      stat.approved = true;
    }

    if (ent.class_date) {
      if (!stat.firstDate || ent.class_date < stat.firstDate) stat.firstDate = ent.class_date;
      if (!stat.lastDate || ent.class_date > stat.lastDate) stat.lastDate = ent.class_date;
    }
  }

  // Build Topic Progress
  const topicProgress: TopicProgressItem[] = topics.map((t) => {
    const stat = topicStatsMap.get(t.id);
    const coveredConfirmations = stat?.covered.size || 0;
    const partialConfirmations = stat?.partial.size || 0;
    const targetDate = t.target_date ? t.target_date.split(' ')[0] : null;

    const status = determineTopicStatus({
      hasAdminApproval: stat?.approved || false,
      coveredConfirmations,
      partialConfirmations,
      effectiveThreshold,
      targetDate,
      todayIST: today,
    });

    const teacherSet = subjectTeachersMap.get(t.subject);
    const teacherNames = teacherSet && teacherSet.size > 0 ? Array.from(teacherSet).join(', ') : 'Unassigned';

    return {
      topic_id: t.id,
      subject_id: t.subject,
      course_id: cId,
      subject_name: subjectNameMap.get(t.subject) || 'General',
      course_name: selectedCourse.name,
      topic_name: t.name,
      seq_no: t.seq_no,
      target_date: targetDate,
      covered_confirmations: coveredConfirmations,
      partial_confirmations: partialConfirmations,
      first_date_taught: stat?.firstDate || null,
      last_date_taught: stat?.lastDate || null,
      effective_threshold: effectiveThreshold,
      status,
      teacher_names: teacherNames,
    };
  });

  // Group by Subject for Subject Progress
  const subjectProgressMap = new Map<
    string,
    { total: number; planned: number; covered: number; name: string }
  >();

  for (const s of subjects) {
    subjectProgressMap.set(s.id, { total: 0, planned: 0, covered: 0, name: s.name });
  }

  for (const tp of topicProgress) {
    let sProg = subjectProgressMap.get(tp.subject_id);
    if (!sProg) {
      sProg = { total: 0, planned: 0, covered: 0, name: tp.subject_name };
      subjectProgressMap.set(tp.subject_id, sProg);
    }
    sProg.total++;
    if (tp.target_date && tp.target_date <= today) {
      sProg.planned++;
    }
    if (tp.status === 'covered') {
      sProg.covered++;
    }
  }

  const subjectProgress: SubjectProgressItem[] = Array.from(subjectProgressMap.entries()).map(
    ([sId, val]) => {
      const plannedPct = val.total > 0 ? Number(((val.planned / val.total) * 100).toFixed(1)) : 0;
      const actualPct = val.total > 0 ? Number(((val.covered / val.total) * 100).toFixed(1)) : 0;
      const variancePct = Number((actualPct - plannedPct).toFixed(1));

      return {
        subject_id: sId,
        course_id: cId,
        subject_name: val.name,
        total_topics: val.total,
        planned_topics: val.planned,
        covered_topics: val.covered,
        planned_pct: plannedPct,
        actual_pct: actualPct,
        variance_pct: variancePct,
      };
    }
  );

  // 4. Overview Metrics
  const totalTopics = topicProgress.length;
  const coveredTopics = topicProgress.filter((t) => t.status === 'covered').length;
  const plannedTopics = topicProgress.filter(
    (t) => t.target_date !== null && t.target_date <= today
  ).length;
  const overdueCount = topicProgress.filter((t) => t.status === 'overdue').length;

  const coveragePct = totalTopics > 0 ? Number(((coveredTopics / totalTopics) * 100).toFixed(1)) : 0;
  const plannedPct = totalTopics > 0 ? Number(((plannedTopics / totalTopics) * 100).toFixed(1)) : 0;
  const variancePct = Number((coveragePct - plannedPct).toFixed(1));

  // Distinct classes logged = distinct (teacher, class_date)
  const distinctClasses = new Set<string>();
  for (const ent of courseEntries) {
    if (ent.teacher && ent.class_date) {
      distinctClasses.add(`${ent.teacher}_${ent.class_date}`);
    }
  }

  const overviewMetrics: OverviewMetrics = {
    totalTopics,
    coveredTopics,
    coveragePct,
    plannedTopics,
    plannedPct,
    variancePct,
    overdueCount,
    pendingReviewCount,
    enrolledStudents: enrolledCount,
    totalClassesLogged: distinctClasses.size,
    confirmationThreshold: configuredThreshold,
  };

  // 5. Teacher Scorecard for this course
  const teachers = await pb.collection('teachers').getFullList({ filter: 'active = true' });
  const currentMonthPrefix = today.substring(0, 7); // YYYY-MM

  const teacherScorecard: TeacherScorecardItem[] = [];
  for (const tea of teachers) {
    const teaEntries = courseEntries.filter((e) => e.teacher === tea.id);
    if (teaEntries.length === 0) continue;

    const coveredTopicIds = new Set<string>();
    let totalLagDays = 0;
    let lagCount = 0;
    let lastClassDate: string | null = null;
    const monthClasses = new Set<string>();

    for (const ent of teaEntries) {
      const topicObj = topics.find((t) => t.id === ent.topic);
      const isTopicCovered = topicProgress.find((tp) => tp.topic_id === ent.topic)?.status === 'covered';

      if (isTopicCovered) {
        coveredTopicIds.add(ent.topic);
        if (topicObj?.target_date && ent.class_date) {
          const tDate = new Date(topicObj.target_date.split(' ')[0]).getTime();
          const cDate = new Date(ent.class_date).getTime();
          const diffDays = Math.round((cDate - tDate) / (1000 * 60 * 60 * 24));
          totalLagDays += diffDays;
          lagCount++;
        }
      }

      if (ent.class_date) {
        if (!lastClassDate || ent.class_date > lastClassDate) {
          lastClassDate = ent.class_date;
        }
        if (ent.class_date.startsWith(currentMonthPrefix)) {
          monthClasses.add(`${ent.class_date}_${ent.subject}`);
        }
      }
    }

    const teaSubjects = new Set<string>();
    for (const ent of teaEntries) {
      const sName = subjectNameMap.get(ent.subject);
      if (sName) teaSubjects.add(sName);
    }

    const avgLag = lagCount > 0 ? Number((totalLagDays / lagCount).toFixed(1)) : 0;

    teacherScorecard.push({
      teacher_id: tea.id,
      teacher_name: tea.name,
      topics_covered: coveredTopicIds.size,
      avg_lag_days: avgLag,
      last_class_logged: lastClassDate,
      classes_logged_this_month: monthClasses.size,
      subject_names: Array.from(teaSubjects).join(', '),
    });
  }

  teacherScorecard.sort((a, b) => b.topics_covered - a.topics_covered);

  // 6. Cumulative Planned vs Actual Timeline
  const allDatesSet = new Set<string>();
  topicProgress.forEach((t) => {
    if (t.target_date) allDatesSet.add(t.target_date);
    if (t.first_date_taught && t.status === 'covered') allDatesSet.add(t.first_date_taught);
  });
  allDatesSet.add(today);

  const sortedDates = Array.from(allDatesSet).sort();
  let plannedAcc = 0;
  let actualAcc = 0;
  const timelineData: TimelineDataPoint[] = [];

  sortedDates.forEach((d) => {
    const plannedOnDate = topicProgress.filter((t) => t.target_date === d).length;
    const actualOnDate = topicProgress.filter(
      (t) => t.first_date_taught === d && t.status === 'covered'
    ).length;
    plannedAcc += plannedOnDate;
    actualAcc += actualOnDate;

    timelineData.push({
      date: d,
      plannedCumulative: plannedAcc,
      actualCumulative: actualAcc,
    });
  });

  // 7. Recent Entries Feed
  const recentEntriesRes = await pb.collection('entries').getList(1, 15, {
    filter: `course = "${cId}"`,
    sort: '-created',
    expand: 'student,teacher,subject,topic',
  });

  const recentEntries: RecentEntryItem[] = recentEntriesRes.items.map((r) => {
    const student = (r.expand as any)?.student;
    const teacher = (r.expand as any)?.teacher;
    const subject = (r.expand as any)?.subject;
    const topic = (r.expand as any)?.topic;

    return {
      id: r.id,
      student_name: student?.name || 'Unknown',
      roll_no: student?.roll_no || '',
      teacher_name: teacher?.name || 'Unknown',
      subject_name: subject?.name || '',
      topic_name: topic?.name || '',
      class_date: r.class_date,
      status: r.status,
      remarks: r.remarks || null,
      review_status: r.review_status,
      flags: Array.isArray(r.flags) ? r.flags : [],
      created_at: r.created,
    };
  });

  return {
    courses,
    selectedCourse,
    overviewMetrics,
    subjectProgress,
    topicProgress,
    teacherScorecard,
    timelineData,
    recentEntries,
    today,
  };
}
