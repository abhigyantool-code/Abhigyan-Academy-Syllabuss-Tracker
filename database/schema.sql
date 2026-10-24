-- Abhigyan Academy Syllabus Tracker Schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Course Settings
CREATE TABLE IF NOT EXISTS course_settings (
    course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
    confirmation_threshold INT NOT NULL DEFAULT 5,
    daily_entry_cap INT NOT NULL DEFAULT 6,
    code_ttl_minutes INT NOT NULL DEFAULT 60,
    require_class_code BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Topics Table
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seq_no INT NOT NULL DEFAULT 1,
    target_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Teacher Subjects Mapping
CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, subject_id)
);

-- 7. Students Table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    pin_hash TEXT, -- Phase 1: nullable and unused
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    batch TEXT,
    PRIMARY KEY (student_id, course_id)
);

-- 9. Class Codes Table
CREATE TABLE IF NOT EXISTS class_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    batch TEXT,
    class_date DATE NOT NULL,
    code TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Entries Table
CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    class_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('covered', 'partial', 'revision')),
    remarks TEXT,
    class_code_id UUID REFERENCES class_codes(id) ON DELETE SET NULL,
    device_id TEXT NOT NULL,
    flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_status TEXT NOT NULL DEFAULT 'auto' CHECK (review_status IN ('auto', 'pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_student_topic_date UNIQUE (student_id, topic_id, class_date)
);

-- 11. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_label TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    before JSONB,
    after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_subjects_course_id ON subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id_seq ON topics(subject_id, seq_no);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_class_codes_course_date ON class_codes(course_id, class_date);
CREATE INDEX IF NOT EXISTS idx_entries_course_date ON entries(course_id, class_date);
CREATE INDEX IF NOT EXISTS idx_entries_student ON entries(student_id);
CREATE INDEX IF NOT EXISTS idx_entries_teacher ON entries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_entries_topic ON entries(topic_id);
CREATE INDEX IF NOT EXISTS idx_entries_review_status ON entries(review_status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
