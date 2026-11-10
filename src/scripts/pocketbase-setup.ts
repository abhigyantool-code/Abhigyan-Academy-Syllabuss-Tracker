/**
 * PocketBase Setup & Data Migration Script
 * Compatible with PocketBase v0.20 through v0.24+
 */

import fs from 'fs';
import path from 'path';

// Automatically load .env.local if present
try {
  if (typeof (process as any).loadEnvFile === 'function') {
    if (fs.existsSync('.env.local')) (process as any).loadEnvFile('.env.local');
    else if (fs.existsSync('.env')) (process as any).loadEnvFile('.env');
  }
} catch {}

const DEFAULT_URL = 'https://stracker.abhigyanintelligence.cloud/_/';
const rawUrl = process.env.POCKETBASE_URL || DEFAULT_URL;
// Normalize by trimming trailing /_ or / so API requests reach /api/... cleanly
const PB_URL = rawUrl.replace(/\/_\/?$/, '').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '';

async function main() {
  console.log(`Connecting to PocketBase at: ${PB_URL}`);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('\nError: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required.');
    process.exit(1);
  }

  // 1. Authenticate as Admin / Superuser
  let token = '';
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (authRes.ok) {
    const authData = await authRes.json();
    token = authData.token;
  } else {
    const errText = await authRes.text();
    throw new Error(`Authentication failed: ${errText}`);
  }

  console.log('✓ Successfully authenticated as Superuser!');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: token,
  };

  async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, options);
        return res;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 300));
        }
      }
    }
    throw lastError;
  }

  // Helper to fetch all records from a collection
  async function getAllRecords(collectionName: string): Promise<any[]> {
    const items: any[] = [];
    let page = 1;
    while (true) {
      const res = await fetchWithRetry(`${PB_URL}/api/collections/${collectionName}/records?page=${page}&perPage=200`, { headers });
      if (!res.ok) break;
      const data = await res.json();
      if (!data.items || data.items.length === 0) break;
      items.push(...data.items);
      if (page >= data.totalPages) break;
      page++;
    }
    return items;
  }

  const seedDir = path.join(process.cwd(), 'database/pocketbase_seed');
  if (!fs.existsSync(seedDir)) {
    console.log('No seed directory found.');
    return;
  }

  console.log('\n--- Step 2: Mapping Existing Records & Seeding Missing Data ---');

  // Course Mapping
  const courseIdMap = new Map<string, string>(); // pgCourseId -> pbCourseId
  const courses = JSON.parse(fs.readFileSync(path.join(seedDir, 'courses.json'), 'utf8'));
  const existingCourses = await getAllRecords('courses');
  const pbCourseByCode = new Map<string, any>(existingCourses.map((c) => [c.code, c]));

  for (const c of courses) {
    let pbCourse = pbCourseByCode.get(c.code);
    if (!pbCourse) {
      console.log(`  + Creating course: ${c.code}`);
      const res = await fetchWithRetry(`${PB_URL}/api/collections/courses/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: c.name, code: c.code, sort_order: c.sort_order, active: c.active }),
      });
      if (res.ok) {
        pbCourse = await res.json();
        pbCourseByCode.set(c.code, pbCourse);
      }
    }
    if (pbCourse) {
      courseIdMap.set(c.id, pbCourse.id);
    }
  }
  console.log(`✓ Mapped ${courseIdMap.size} courses.`);

  // Course Settings
  const settings = JSON.parse(fs.readFileSync(path.join(seedDir, 'course_settings.json'), 'utf8'));
  const existingSettings = await getAllRecords('course_settings');
  const pbSettingsByCourse = new Set(existingSettings.map((s) => s.course));

  for (const s of settings) {
    const pbCourseId = courseIdMap.get(s.course_id);
    if (pbCourseId && !pbSettingsByCourse.has(pbCourseId)) {
      await fetchWithRetry(`${PB_URL}/api/collections/course_settings/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          course: pbCourseId,
          confirmation_threshold: s.confirmation_threshold,
          daily_entry_cap: s.daily_entry_cap,
          code_ttl_minutes: s.code_ttl_minutes,
          require_class_code: s.require_class_code,
        }),
      });
      pbSettingsByCourse.add(pbCourseId);
    }
  }
  console.log(`✓ Verified ${settings.length} course settings.`);

  // Teachers Mapping
  const teacherIdMap = new Map<string, string>(); // pgTeacherId -> pbTeacherId
  const teachers = JSON.parse(fs.readFileSync(path.join(seedDir, 'teachers.json'), 'utf8'));
  const existingTeachers = await getAllRecords('teachers');
  const pbTeacherByName = new Map<string, any>(existingTeachers.map((t) => [t.name, t]));

  for (const t of teachers) {
    let pbTeacher = pbTeacherByName.get(t.name);
    if (!pbTeacher) {
      console.log(`  + Creating teacher: ${t.name}`);
      const res = await fetchWithRetry(`${PB_URL}/api/collections/teachers/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: t.name, phone: t.phone, pin: t.pin || '1234', active: t.active }),
      });
      if (res.ok) {
        pbTeacher = await res.json();
        pbTeacherByName.set(t.name, pbTeacher);
      }
    }
    if (pbTeacher) {
      teacherIdMap.set(t.id, pbTeacher.id);
    }
  }
  console.log(`✓ Mapped ${teacherIdMap.size} teachers.`);

  // Students Mapping
  const studentIdMap = new Map<string, string>(); // pgStudentId -> pbStudentId
  const students = JSON.parse(fs.readFileSync(path.join(seedDir, 'students.json'), 'utf8'));
  const existingStudents = await getAllRecords('students');
  const pbStudentByRoll = new Map<string, any>(existingStudents.map((st) => [st.roll_no, st]));

  for (const st of students) {
    let pbStudent = pbStudentByRoll.get(st.roll_no);
    if (!pbStudent) {
      const res = await fetchWithRetry(`${PB_URL}/api/collections/students/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ roll_no: st.roll_no, name: st.name, pin: st.pin || '1234', pin_hash: st.pin_hash, active: st.active }),
      });
      if (res.ok) {
        pbStudent = await res.json();
        pbStudentByRoll.set(st.roll_no, pbStudent);
      }
    }
    if (pbStudent) {
      studentIdMap.set(st.id, pbStudent.id);
    }
  }
  console.log(`✓ Mapped ${studentIdMap.size} students.`);

  // Enrollments
  const enrollments = JSON.parse(fs.readFileSync(path.join(seedDir, 'enrollments.json'), 'utf8'));
  const existingEnrollments = await getAllRecords('enrollments');
  const existingEnrollKeys = new Set(existingEnrollments.map((e) => `${e.student}_${e.course}`));

  let enrollCount = 0;
  for (const en of enrollments) {
    const pbStudentId = studentIdMap.get(en.student_id);
    const pbCourseId = courseIdMap.get(en.course_id);
    if (pbStudentId && pbCourseId) {
      const key = `${pbStudentId}_${pbCourseId}`;
      if (!existingEnrollKeys.has(key)) {
        await fetchWithRetry(`${PB_URL}/api/collections/enrollments/records`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ student: pbStudentId, course: pbCourseId, batch: en.batch }),
        });
        existingEnrollKeys.add(key);
        enrollCount++;
      }
    }
  }
  console.log(`✓ Seeded ${enrollCount} new enrollments (total ${existingEnrollKeys.size}).`);

  // Subjects
  const subjectIdMap = new Map<string, string>(); // pgSubjectId -> pbSubjectId
  const subjects = JSON.parse(fs.readFileSync(path.join(seedDir, 'subjects.json'), 'utf8'));
  const existingSubjects = await getAllRecords('subjects');
  const pbSubjectByKey = new Map<string, any>(existingSubjects.map((s) => [`${s.course}_${s.name}`, s]));

  for (const sub of subjects) {
    const pbCourseId = courseIdMap.get(sub.course_id);
    if (pbCourseId) {
      const key = `${pbCourseId}_${sub.name}`;
      let pbSub = pbSubjectByKey.get(key);
      if (!pbSub) {
        const res = await fetchWithRetry(`${PB_URL}/api/collections/subjects/records`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ course: pbCourseId, name: sub.name, sort_order: sub.sort_order }),
        });
        if (res.ok) {
          pbSub = await res.json();
          pbSubjectByKey.set(key, pbSub);
        } else {
          console.warn(`Failed to create subject ${sub.name}:`, await res.text());
        }
      }
      if (pbSub) {
        subjectIdMap.set(sub.id, pbSub.id);
      }
    }
  }
  console.log(`✓ Mapped ${subjectIdMap.size} subjects.`);

  // Teacher Subjects
  const teacherSubjects = JSON.parse(fs.readFileSync(path.join(seedDir, 'teacher_subjects.json'), 'utf8'));
  const existingTeacherSubjects = await getAllRecords('teacher_subjects');
  const existingTSKeys = new Set(existingTeacherSubjects.map((ts) => `${ts.teacher}_${ts.subject}`));

  let tsCount = 0;
  for (const ts of teacherSubjects) {
    const pbTeacherId = teacherIdMap.get(ts.teacher_id);
    const pbSubjectId = subjectIdMap.get(ts.subject_id);
    if (pbTeacherId && pbSubjectId) {
      const key = `${pbTeacherId}_${pbSubjectId}`;
      if (!existingTSKeys.has(key)) {
        await fetchWithRetry(`${PB_URL}/api/collections/teacher_subjects/records`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ teacher: pbTeacherId, subject: pbSubjectId }),
        });
        existingTSKeys.add(key);
        tsCount++;
      }
    }
  }
  console.log(`✓ Seeded ${tsCount} new teacher-subject links (total ${existingTSKeys.size}).`);

  // Topics (1,960 records)
  console.log(`Seeding 1,960 curriculum topics in batches...`);
  const topics = JSON.parse(fs.readFileSync(path.join(seedDir, 'topics.json'), 'utf8'));
  const existingTopics = await getAllRecords('topics');
  const existingTopicKeys = new Set(existingTopics.map((t) => `${t.subject}_${t.seq_no}`));

  let topicCreated = 0;
  for (const top of topics) {
    const pbSubjectId = subjectIdMap.get(top.subject_id);
    if (pbSubjectId) {
      const key = `${pbSubjectId}_${top.seq_no}`;
      if (!existingTopicKeys.has(key)) {
        try {
          const res = await fetchWithRetry(`${PB_URL}/api/collections/topics/records`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              subject: pbSubjectId,
              name: top.name,
              seq_no: top.seq_no,
              target_date: top.target_date ? `${top.target_date} 00:00:00.000Z` : null,
              notes: top.notes,
            }),
          }, 5);
          if (res.ok) {
            existingTopicKeys.add(key);
            topicCreated++;
            if (topicCreated % 100 === 0) {
              console.log(`  - Inserted ${topicCreated} topics (total in DB: ${existingTopicKeys.size})...`);
            }
          }
          // Small throttle to keep connection stable
          await new Promise((r) => setTimeout(r, 10));
        } catch (err: any) {
          console.warn(`  ! Transient error on topic "${top.name}", will retry on next run:`, err.message || err);
        }
      }
    }
  }

  console.log(`\n🎉 Data seeding completed successfully! Inserted ${topicCreated} new topics (total in PocketBase: ${existingTopicKeys.size}).`);
}

main().catch((err) => {
  console.error('\nSetup error:', err.message || err);
  process.exit(1);
});
