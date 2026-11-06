import { query } from './db';
import { getTodayIST } from './date-utils';

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

  // 1. Fetch Teacher Profile
  const teacherRes = await query(`SELECT id, name, phone, active FROM teachers WHERE id = $1`, [teacherId]);
  if (teacherRes.rows.length === 0) return null;
  const teacher = teacherRes.rows[0];

  // 2. Fetch Assigned Subjects with Topic Stats
  const subjectsRes = await query(
    `SELECT 
       s.id as subject_id,
       s.name as subject_name,
       c.id as course_id,
       c.name as course_name,
       c.code as course_code,
       COUNT(DISTINCT t.id) as total_topics,
       COUNT(DISTINCT CASE WHEN tp.status = 'covered' THEN t.id END) as covered_topics
     FROM teacher_subjects ts
     JOIN subjects s ON ts.subject_id = s.id
     JOIN courses c ON s.course_id = c.id
     LEFT JOIN topics t ON s.id = t.subject_id
     LEFT JOIN topic_progress tp ON t.id = tp.topic_id
     WHERE ts.teacher_id = $1 AND c.active = true
     GROUP BY s.id, s.name, c.id, c.name, c.code, c.sort_order, s.sort_order
     ORDER BY c.sort_order, s.sort_order;`,
    [teacherId]
  );

  const subjects: TeacherAssignedSubject[] = subjectsRes.rows.map((row) => {
    const total = Number(row.total_topics) || 0;
    const covered = Number(row.covered_topics) || 0;
    const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
    return {
      subject_id: row.subject_id,
      subject_name: row.subject_name,
      course_id: row.course_id,
      course_name: row.course_name,
      course_code: row.course_code,
      total_topics: total,
      covered_topics: covered,
      progress_pct: pct,
    };
  });

  const activeSubject = subjects.find((s) => s.subject_id === subjectId) || subjects[0];
  const selectedSubjectId = activeSubject?.subject_id || '';
  const selectedCourseId = activeSubject?.course_id || '';

  // 3. Fetch Topics for selected subject
  let topics: TeacherTopicItem[] = [];
  if (selectedSubjectId) {
    const topicsRes = await query(
      `SELECT 
         t.id,
         t.subject_id,
         s.course_id,
         t.name,
         t.seq_no,
         t.target_date,
         t.notes,
         COALESCE(tp.status, 'not_started') as status,
         COALESCE(tp.covered_confirmations, 0) as student_confirmations
       FROM topics t
       JOIN subjects s ON t.subject_id = s.id
       LEFT JOIN topic_progress tp ON t.id = tp.topic_id
       WHERE t.subject_id = $1
       ORDER BY t.seq_no;`,
      [selectedSubjectId]
    );

    topics = topicsRes.rows.map((r) => ({
      id: r.id,
      subject_id: r.subject_id,
      course_id: r.course_id,
      name: r.name,
      seq_no: Number(r.seq_no),
      target_date: r.target_date ? new Date(r.target_date).toISOString().slice(0, 10) : null,
      notes: r.notes,
      status: r.status as any,
      student_confirmations: Number(r.student_confirmations),
    }));
  }

  // 4. Fetch recent student logs for this teacher
  const logsRes = await query(
    `SELECT 
       e.id,
       e.class_date,
       e.status,
       e.remarks,
       e.created_at,
       s.name as student_name,
       s.roll_no as student_roll,
       sub.name as subject_name,
       top.id as topic_id,
       top.name as topic_name,
       top.seq_no as topic_seq,
       c.code as course_code
     FROM entries e
     JOIN students s ON e.student_id = s.id
     JOIN subjects sub ON e.subject_id = sub.id
     JOIN topics top ON e.topic_id = top.id
     JOIN courses c ON e.course_id = c.id
     WHERE e.teacher_id = $1
     ORDER BY e.created_at DESC
     LIMIT 40;`,
    [teacherId]
  );

  const recentStudentLogs: TeacherRecentEntry[] = logsRes.rows.map((r) => ({
    id: r.id,
    class_date: r.class_date ? new Date(r.class_date).toISOString().slice(0, 10) : '',
    status: r.status,
    remarks: r.remarks,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : '',
    student_name: r.student_name,
    student_roll: r.student_roll,
    subject_name: r.subject_name,
    topic_id: r.topic_id,
    topic_name: r.topic_name,
    topic_seq: Number(r.topic_seq),
    course_code: r.course_code,
  }));

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      phone: teacher.phone,
    },
    subjects,
    selectedSubjectId,
    selectedCourseId,
    topics,
    recentStudentLogs,
    today,
  };
}
