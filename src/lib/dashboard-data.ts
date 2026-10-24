import { query } from './db';
import { getTodayIST } from './date-utils';

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
  review_status: 'auto' | 'pending' | 'approved' | 'rejected';
  flags: string[];
  created_at: string;
}

export async function getActiveCourses(): Promise<DashboardCourse[]> {
  const res = await query<DashboardCourse>(
    `SELECT id, name, code, sort_order FROM courses WHERE active = true ORDER BY sort_order ASC, name ASC`
  );
  return res.rows;
}

export async function getDashboardData(courseId?: string) {
  const courses = await getActiveCourses();
  if (courses.length === 0) {
    return null;
  }

  const selectedCourse = courses.find((c) => c.id === courseId) || courses[0];
  const cId = selectedCourse.id;
  const today = getTodayIST();

  // 1. Settings & Enrollment Count
  const [settingsRes, enrollRes, pendingFlagsRes] = await Promise.all([
    query(
      `SELECT confirmation_threshold, daily_entry_cap, code_ttl_minutes, require_class_code 
       FROM course_settings WHERE course_id = $1`,
      [cId]
    ),
    query(
      `SELECT COUNT(DISTINCT e.student_id) as enrolled_count
       FROM enrollments e
       JOIN students s ON s.id = e.student_id AND s.active = true
       WHERE e.course_id = $1`,
      [cId]
    ),
    query(
      `SELECT COUNT(*) as count 
       FROM entries 
       WHERE course_id = $1 AND review_status = 'pending'`,
      [cId]
    ),
  ]);

  const enrolledCount = Number(enrollRes.rows[0]?.enrolled_count || 0);
  const pendingReviewCount = Number(pendingFlagsRes.rows[0]?.count || 0);
  const threshold = Number(settingsRes.rows[0]?.confirmation_threshold || 5);

  // 2. Subject Progress
  const subProgRes = await query<SubjectProgressItem>(
    `SELECT subject_id, course_id, subject_name, 
            total_topics::int, planned_topics::int, covered_topics::int, 
            planned_pct::float, actual_pct::float, variance_pct::float
     FROM subject_progress
     WHERE course_id = $1
     ORDER BY subject_name ASC`,
    [cId]
  );
  const subjectProgress = subProgRes.rows;

  // 3. Topic Progress
  const topicProgRes = await query<TopicProgressItem>(
    `SELECT tp.topic_id, tp.subject_id, tp.course_id, tp.subject_name, tp.course_name,
            tp.topic_name, tp.seq_no, tp.target_date::text, 
            tp.covered_confirmations::int, tp.partial_confirmations::int,
            tp.first_date_taught::text, tp.last_date_taught::text,
            tp.effective_threshold::int, tp.status,
            COALESCE(STRING_AGG(DISTINCT tea.name, ', '), 'Unassigned') as teacher_names
     FROM topic_progress tp
     LEFT JOIN teacher_subjects ts ON ts.subject_id = tp.subject_id
     LEFT JOIN teachers tea ON tea.id = ts.teacher_id
     WHERE tp.course_id = $1
     GROUP BY tp.topic_id, tp.subject_id, tp.course_id, tp.subject_name, tp.course_name,
              tp.topic_name, tp.seq_no, tp.target_date, tp.covered_confirmations,
              tp.partial_confirmations, tp.first_date_taught, tp.last_date_taught,
              tp.effective_threshold, tp.status
     ORDER BY tp.subject_name ASC, tp.seq_no ASC`,
    [cId]
  );
  const topicProgress = topicProgRes.rows;

  // 4. Compute Overview Metrics
  const totalTopics = topicProgress.length;
  const coveredTopics = topicProgress.filter((t) => t.status === 'covered').length;
  const plannedTopics = topicProgress.filter(
    (t) => t.target_date !== null && t.target_date <= today
  ).length;
  const overdueCount = topicProgress.filter((t) => t.status === 'overdue').length;

  const coveragePct = totalTopics > 0 ? Number(((coveredTopics / totalTopics) * 100).toFixed(1)) : 0;
  const plannedPct = totalTopics > 0 ? Number(((plannedTopics / totalTopics) * 100).toFixed(1)) : 0;
  const variancePct = Number((coveragePct - plannedPct).toFixed(1));

  const totalClassesRes = await query(
    `SELECT COUNT(DISTINCT (teacher_id, class_date)) as count FROM entries WHERE course_id = $1`,
    [cId]
  );
  const totalClassesLogged = Number(totalClassesRes.rows[0]?.count || 0);

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
    totalClassesLogged,
    confirmationThreshold: threshold,
  };

  // 5. Teacher Scorecard for this course
  const teacherScorecardRes = await query<TeacherScorecardItem>(
    `SELECT tsc.teacher_id, tsc.teacher_name, 
            tsc.topics_covered::int, tsc.avg_lag_days::float,
            tsc.last_class_logged::text, tsc.classes_logged_this_month::int,
            STRING_AGG(DISTINCT s.name, ', ') as subject_names
     FROM teacher_scorecard tsc
     JOIN teacher_subjects ts ON ts.teacher_id = tsc.teacher_id
     JOIN subjects s ON s.id = ts.subject_id AND s.course_id = $1
     GROUP BY tsc.teacher_id, tsc.teacher_name, tsc.topics_covered, 
              tsc.avg_lag_days, tsc.last_class_logged, tsc.classes_logged_this_month
     ORDER BY tsc.topics_covered DESC, tsc.teacher_name ASC`,
    [cId]
  );
  const teacherScorecard = teacherScorecardRes.rows;

  // 6. Cumulative Planned vs Actual Timeline
  // Collect all distinct dates from target_date and first_date_taught
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

  // Group by date
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
  const recentEntriesRes = await query<RecentEntryItem>(
    `SELECT e.id, s.name as student_name, s.roll_no, 
            tea.name as teacher_name, sub.name as subject_name,
            top.name as topic_name, e.class_date::text, e.status, 
            e.remarks, e.review_status, e.flags, e.created_at::text
     FROM entries e
     JOIN students s ON s.id = e.student_id
     JOIN teachers tea ON tea.id = e.teacher_id
     JOIN subjects sub ON sub.id = e.subject_id
     JOIN topics top ON top.id = e.topic_id
     WHERE e.course_id = $1
     ORDER BY e.created_at DESC
     LIMIT 15`,
    [cId]
  );
  const recentEntries = recentEntriesRes.rows;

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
