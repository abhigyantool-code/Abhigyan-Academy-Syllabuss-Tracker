import { query } from './db';
import { getTodayIST } from './date-utils';

export async function getAdminInitialData() {
  const today = getTodayIST();

  // 1. Courses with Settings
  const coursesRes = await query(`
    SELECT c.id, c.name, c.code, c.sort_order, c.active, c.created_at,
           cs.confirmation_threshold, cs.daily_entry_cap, cs.code_ttl_minutes, cs.require_class_code
    FROM courses c
    LEFT JOIN course_settings cs ON cs.course_id = c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `);

  // 2. Subjects with Topics count
  const subjectsRes = await query(`
    SELECT s.id, s.course_id, s.name, s.sort_order, c.name as course_name, c.code as course_code,
           COUNT(t.id)::int as topics_count
    FROM subjects s
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN topics t ON t.subject_id = s.id
    GROUP BY s.id, s.course_id, s.name, s.sort_order, c.name, c.code
    ORDER BY s.sort_order ASC, s.name ASC
  `);

  // 3. Topics
  const topicsRes = await query(`
    SELECT t.id, t.subject_id, t.name, t.seq_no, t.target_date::text, t.notes,
           s.name as subject_name, s.course_id, c.code as course_code
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    JOIN courses c ON c.id = s.course_id
    ORDER BY s.sort_order ASC, t.seq_no ASC
  `);

  // 4. Teachers with Assigned Subjects
  const teachersRes = await query(`
    SELECT tea.id, tea.name, tea.phone, tea.active, tea.created_at,
           COALESCE(ARRAY_AGG(ts.subject_id) FILTER (WHERE ts.subject_id IS NOT NULL), '{}') as assigned_subject_ids,
           COALESCE(STRING_AGG(DISTINCT s.name, ', '), 'None') as assigned_subject_names
    FROM teachers tea
    LEFT JOIN teacher_subjects ts ON ts.teacher_id = tea.id
    LEFT JOIN subjects s ON s.id = ts.subject_id
    GROUP BY tea.id, tea.name, tea.phone, tea.active, tea.created_at
    ORDER BY tea.name ASC
  `);

  // 5. Students with Enrolled Courses
  const studentsRes = await query(`
    SELECT stu.id, stu.roll_no, stu.name, stu.active, stu.created_at,
           COALESCE(ARRAY_AGG(e.course_id) FILTER (WHERE e.course_id IS NOT NULL), '{}') as enrolled_course_ids,
           COALESCE(STRING_AGG(DISTINCT c.code, ', '), 'None') as enrolled_course_codes
    FROM students stu
    LEFT JOIN enrollments e ON e.student_id = stu.id
    LEFT JOIN courses c ON c.id = e.course_id
    GROUP BY stu.id, stu.roll_no, stu.name, stu.active, stu.created_at
    ORDER BY stu.roll_no ASC
  `);

  // 6. Active Class Codes
  const classCodesRes = await query(`
    SELECT cc.id, cc.course_id, c.name as course_name, c.code as course_code,
           cc.batch, cc.class_date::text, cc.code, cc.valid_from::text, cc.valid_until::text,
           cc.created_at::text,
           (now() BETWEEN cc.valid_from AND cc.valid_until) as is_active_now
    FROM class_codes cc
    JOIN courses c ON c.id = cc.course_id
    ORDER BY cc.class_date DESC, cc.created_at DESC
    LIMIT 30
  `);

  // 7. Review Queue (Flagged Entries with review_status = 'pending')
  const reviewQueueRes = await query(`
    SELECT e.id, e.class_date::text, e.status, e.remarks, e.flags, e.review_status,
           e.device_id, e.created_at::text,
           stu.name as student_name, stu.roll_no,
           tea.name as teacher_name,
           sub.name as subject_name,
           top.name as topic_name, top.seq_no,
           c.name as course_name, c.code as course_code
    FROM entries e
    JOIN students stu ON stu.id = e.student_id
    JOIN teachers tea ON tea.id = e.teacher_id
    JOIN subjects sub ON sub.id = e.subject_id
    JOIN topics top ON top.id = e.topic_id
    JOIN courses c ON c.id = e.course_id
    WHERE LOWER(e.review_status) IN ('pending', 'flagged')
    ORDER BY e.created_at DESC
  `);

  // 8. Audit Log
  const auditLogRes = await query(`
    SELECT id, actor_label, action, entity, entity_id, before, after, created_at::text
    FROM audit_log
    ORDER BY created_at DESC
    LIMIT 50
  `);

  return {
    today,
    courses: coursesRes.rows,
    subjects: subjectsRes.rows,
    topics: topicsRes.rows,
    teachers: teachersRes.rows,
    students: studentsRes.rows,
    classCodes: classCodesRes.rows,
    reviewQueue: reviewQueueRes.rows,
    auditLog: auditLogRes.rows,
  };
}
