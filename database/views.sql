-- Abhigyan Academy Derived Views in PostgreSQL (IST Enforced)

-- 1. Topic Progress View
CREATE OR REPLACE VIEW topic_progress AS
WITH student_counts AS (
  SELECT course_id, COUNT(DISTINCT student_id) AS enrolled_students
  FROM enrollments e
  JOIN students s ON s.id = e.student_id AND s.active = true
  GROUP BY course_id
),
topic_stats AS (
  SELECT
    e.topic_id,
    COUNT(DISTINCT CASE WHEN e.status = 'covered' AND e.review_status IN ('auto', 'approved') THEN e.student_id END) AS covered_confirmations,
    COUNT(DISTINCT CASE WHEN e.status = 'partial' AND e.review_status IN ('auto', 'approved') THEN e.student_id END) AS partial_confirmations,
    MIN(e.class_date) AS first_date_taught,
    MAX(e.class_date) AS last_date_taught,
    BOOL_OR(e.review_status = 'approved' AND e.status = 'covered') AS has_admin_approval
  FROM entries e
  GROUP BY e.topic_id
)
SELECT
  t.id AS topic_id,
  t.subject_id,
  s.course_id,
  s.name AS subject_name,
  c.name AS course_name,
  t.name AS topic_name,
  t.seq_no,
  t.target_date,
  COALESCE(ts.covered_confirmations, 0) AS covered_confirmations,
  COALESCE(ts.partial_confirmations, 0) AS partial_confirmations,
  ts.first_date_taught,
  ts.last_date_taught,
  -- Threshold formula: min(confirmation_threshold, max(1, round(0.20 * enrolled_students)))
  LEAST(
    COALESCE(cs.confirmation_threshold, 5),
    GREATEST(1, ROUND(0.20 * COALESCE(sc.enrolled_students, 10)))
  ) AS effective_threshold,
  CASE
    WHEN COALESCE(ts.has_admin_approval, false) = true THEN 'covered'
    WHEN COALESCE(ts.covered_confirmations, 0) >= LEAST(COALESCE(cs.confirmation_threshold, 5), GREATEST(1, ROUND(0.20 * COALESCE(sc.enrolled_students, 10)))) THEN 'covered'
    WHEN COALESCE(ts.covered_confirmations, 0) > 0 THEN 'unverified'
    WHEN COALESCE(ts.partial_confirmations, 0) > 0 THEN 'in_progress'
    WHEN t.target_date IS NOT NULL AND t.target_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 'overdue'
    ELSE 'not_started'
  END AS status
FROM topics t
JOIN subjects s ON s.id = t.subject_id
JOIN courses c ON c.id = s.course_id
LEFT JOIN course_settings cs ON cs.course_id = c.id
LEFT JOIN student_counts sc ON sc.course_id = c.id
LEFT JOIN topic_stats ts ON ts.topic_id = t.id;

-- 2. Subject Progress View
CREATE OR REPLACE VIEW subject_progress AS
SELECT
  s.id AS subject_id,
  s.course_id,
  s.name AS subject_name,
  COUNT(t.id) AS total_topics,
  COUNT(CASE WHEN t.target_date IS NOT NULL AND t.target_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 1 END) AS planned_topics,
  COUNT(CASE WHEN tp.status = 'covered' THEN 1 END) AS covered_topics,
  ROUND(
    COALESCE((COUNT(CASE WHEN t.target_date IS NOT NULL AND t.target_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 1 END)::numeric / NULLIF(COUNT(t.id), 0)) * 100, 0), 1
  ) AS planned_pct,
  ROUND(
    COALESCE((COUNT(CASE WHEN tp.status = 'covered' THEN 1 END)::numeric / NULLIF(COUNT(t.id), 0)) * 100, 0), 1
  ) AS actual_pct,
  ROUND(
    COALESCE(((COUNT(CASE WHEN tp.status = 'covered' THEN 1 END)::numeric - COUNT(CASE WHEN t.target_date IS NOT NULL AND t.target_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN 1 END)::numeric) / NULLIF(COUNT(t.id), 0)) * 100, 0), 1
  ) AS variance_pct
FROM subjects s
LEFT JOIN topics t ON t.subject_id = s.id
LEFT JOIN topic_progress tp ON tp.topic_id = t.id
GROUP BY s.id, s.course_id, s.name;

-- 3. Teacher Scorecard View
CREATE OR REPLACE VIEW teacher_scorecard AS
SELECT
  tea.id AS teacher_id,
  tea.name AS teacher_name,
  COUNT(DISTINCT CASE WHEN tp.status = 'covered' THEN tp.topic_id END) AS topics_covered,
  ROUND(
    COALESCE(AVG(CASE WHEN tp.status = 'covered' AND t.target_date IS NOT NULL THEN (tp.first_date_taught - t.target_date) END)::numeric, 0), 1
  ) AS avg_lag_days,
  MAX(e.class_date) AS last_class_logged,
  COUNT(DISTINCT e.id) FILTER (
    WHERE DATE_TRUNC('month', e.class_date) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
  ) AS classes_logged_this_month
FROM teachers tea
LEFT JOIN entries e ON e.teacher_id = tea.id AND e.review_status IN ('auto', 'approved')
LEFT JOIN topics t ON t.id = e.topic_id
LEFT JOIN topic_progress tp ON tp.topic_id = t.id
GROUP BY tea.id, tea.name;
