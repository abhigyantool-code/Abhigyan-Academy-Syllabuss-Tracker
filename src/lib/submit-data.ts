import { query } from './db';

export interface SubmitCourseData {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  require_class_code: boolean;
}

export interface SubmitTeacher {
  id: string;
  name: string;
  course_id: string;
}

export interface SubmitSubject {
  id: string;
  name: string;
  course_id: string;
  teacher_id: string;
}

export interface SubmitTopic {
  id: string;
  subject_id: string;
  name: string;
  seq_no: number;
  target_date: string | null;
}

export interface SubmitStudent {
  id: string;
  roll_no: string;
  name: string;
  course_id: string;
}

export async function getSubmitFormData() {
  // 1. Active Courses with Settings
  const coursesRes = await query<SubmitCourseData>(`
    SELECT c.id, c.name, c.code, c.sort_order,
           COALESCE(cs.require_class_code, true) as require_class_code
    FROM courses c
    LEFT JOIN course_settings cs ON cs.course_id = c.id
    WHERE c.active = true
    ORDER BY c.sort_order ASC, c.name ASC
  `);

  // 2. Teachers mapped to course (through subject assignments)
  const teachersRes = await query<SubmitTeacher>(`
    SELECT DISTINCT tea.id, tea.name, s.course_id
    FROM teachers tea
    JOIN teacher_subjects ts ON ts.teacher_id = tea.id
    JOIN subjects s ON s.id = ts.subject_id
    WHERE tea.active = true
    ORDER BY tea.name ASC
  `);

  // 3. Subjects mapped to (course_id, teacher_id)
  const subjectsRes = await query<SubmitSubject>(`
    SELECT DISTINCT s.id, s.name, s.course_id, ts.teacher_id
    FROM subjects s
    JOIN teacher_subjects ts ON ts.subject_id = s.id
    ORDER BY s.name ASC
  `);

  // 4. Topics for all subjects
  const topicsRes = await query<SubmitTopic>(`
    SELECT t.id, t.subject_id, t.name, t.seq_no, t.target_date::text
    FROM topics t
    ORDER BY t.seq_no ASC
  `);

  // 5. Enrolled Active Students per course
  const studentsRes = await query<SubmitStudent>(`
    SELECT s.id, s.roll_no, s.name, e.course_id
    FROM students s
    JOIN enrollments e ON e.student_id = s.id
    WHERE s.active = true
    ORDER BY s.roll_no ASC, s.name ASC
  `);

  return {
    courses: coursesRes.rows,
    teachers: teachersRes.rows,
    subjects: subjectsRes.rows,
    topics: topicsRes.rows,
    students: studentsRes.rows,
  };
}
