-- Row Level Security (RLS) Configuration
-- Direct access via Supabase Client (anon / public) is completely denied.
-- All database operations MUST execute via server route handlers / server actions
-- using connection pool / service role.

-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- If roles exist in Supabase (anon / authenticated), explicitly revoke direct access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
    END IF;
END $$;

-- Policy ensuring no public access through PostgREST / direct client
CREATE POLICY no_direct_courses ON courses FOR ALL USING (false);
CREATE POLICY no_direct_settings ON course_settings FOR ALL USING (false);
CREATE POLICY no_direct_subjects ON subjects FOR ALL USING (false);
CREATE POLICY no_direct_topics ON topics FOR ALL USING (false);
CREATE POLICY no_direct_teachers ON teachers FOR ALL USING (false);
CREATE POLICY no_direct_teacher_subjects ON teacher_subjects FOR ALL USING (false);
CREATE POLICY no_direct_students ON students FOR ALL USING (false);
CREATE POLICY no_direct_enrollments ON enrollments FOR ALL USING (false);
CREATE POLICY no_direct_class_codes ON class_codes FOR ALL USING (false);
CREATE POLICY no_direct_entries ON entries FOR ALL USING (false);
CREATE POLICY no_direct_audit_log ON audit_log FOR ALL USING (false);
