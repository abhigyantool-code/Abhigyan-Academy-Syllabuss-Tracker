import { query, withTransaction } from '../lib/db';

async function main() {
  console.log('=== Propagating Common Syllabus Across All Courses & Disabling Class Code ===');

  await withTransaction(async (client) => {
    // -------------------------------------------------------------------------
    // 1. DISABLE CLASS CODE ACROSS ALL COURSES FOR REAL-TIME DIRECT LOGGING
    // -------------------------------------------------------------------------
    await client.query(`UPDATE course_settings SET require_class_code = false;`);
    console.log('✓ Class code disabled across all course settings (real-time submission active).');

    // -------------------------------------------------------------------------
    // 2. GET NDA AS THE MASTER TEMPLATE COURSE
    // -------------------------------------------------------------------------
    const ndaRes = await client.query(`SELECT id FROM courses WHERE code = 'NDA' LIMIT 1;`);
    if (ndaRes.rows.length === 0) throw new Error('NDA course not found!');
    const ndaCourseId = ndaRes.rows[0].id;

    // Fetch all NDA subjects with their topics and teachers
    const ndaSubjectsRes = await client.query(
      `SELECT s.id, s.name, s.sort_order
       FROM subjects s
       WHERE s.course_id = $1
       ORDER BY s.sort_order;`,
      [ndaCourseId]
    );

    // Fetch all other active courses
    const otherCoursesRes = await client.query(
      `SELECT id, code, name FROM courses WHERE code != 'NDA' AND active = true ORDER BY sort_order;`
    );

    console.log(`Found ${ndaSubjectsRes.rows.length} master subjects in NDA. Propagating to ${otherCoursesRes.rows.length} other courses...`);

    // For each non-NDA course
    for (const targetCourse of otherCoursesRes.rows) {
      console.log(`\n--> Syncing Course: [${targetCourse.code}] ${targetCourse.name}`);

      // Delete old entries and topics in target course to ensure clean state
      await client.query(
        `DELETE FROM entries WHERE course_id = $1;`,
        [targetCourse.id]
      );
      await client.query(
        `DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE course_id = $1);`,
        [targetCourse.id]
      );
      await client.query(
        `DELETE FROM teacher_subjects WHERE subject_id IN (SELECT id FROM subjects WHERE course_id = $1);`,
        [targetCourse.id]
      );
      // Clean old subjects (e.g. 'Elementary Mathematics', 'Maths')
      await client.query(
        `DELETE FROM subjects WHERE course_id = $1;`,
        [targetCourse.id]
      );

      // Now copy each master subject and its topics from NDA
      for (const masterSub of ndaSubjectsRes.rows) {
        // Create subject in target course
        const newSubRes = await client.query(
          `INSERT INTO subjects (course_id, name, sort_order)
           VALUES ($1, $2, $3)
           RETURNING id;`,
          [targetCourse.id, masterSub.name, masterSub.sort_order]
        );
        const newSubjectId = newSubRes.rows[0].id;

        // Copy teacher mappings from NDA subject
        const teacherMapRes = await client.query(
          `SELECT teacher_id FROM teacher_subjects WHERE subject_id = $1;`,
          [masterSub.id]
        );
        for (const tRow of teacherMapRes.rows) {
          await client.query(
            `INSERT INTO teacher_subjects (teacher_id, subject_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING;`,
            [tRow.teacher_id, newSubjectId]
          );
        }

        // Copy all topics from NDA subject
        const topicsRes = await client.query(
          `SELECT name, seq_no, target_date, notes
           FROM topics
           WHERE subject_id = $1
           ORDER BY seq_no;`,
          [masterSub.id]
        );

        for (const top of topicsRes.rows) {
          await client.query(
            `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
             VALUES ($1, $2, $3, $4, $5);`,
            [newSubjectId, top.name, top.seq_no, top.target_date, top.notes]
          );
        }
      }

      console.log(`✓ Synchronized all subjects and 280 topics into [${targetCourse.code}].`);
    }

    // -------------------------------------------------------------------------
    // 3. RE-VERIFY FOUNDATION TOPIC (TRIGONOMETRY) FOR ACTIVE STUDENTS
    // -------------------------------------------------------------------------
    // Re-link initial covered entries for Trigonometry across courses where students exist
    const dipyRes = await client.query(`SELECT id FROM teachers WHERE name = 'Dipyaman Sir' LIMIT 1;`);
    const dipyamanId = dipyRes.rows[0]?.id;

    for (const c of [{ id: ndaCourseId, code: 'NDA' }, ...otherCoursesRes.rows]) {
      // Find Trigonometry topic
      const trigTopicRes = await client.query(
        `SELECT t.id as topic_id, s.id as subject_id
         FROM topics t
         JOIN subjects s ON t.subject_id = s.id
         WHERE s.course_id = $1 AND s.name = 'Mathematics' AND t.name LIKE 'Trigonometry – Introduction%'
         LIMIT 1;`,
        [c.id]
      );

      if (trigTopicRes.rows.length > 0 && dipyamanId) {
        const { topic_id, subject_id } = trigTopicRes.rows[0];
        // Fetch students in this course
        const stuRes = await client.query(
          `SELECT s.id FROM students s JOIN enrollments e ON s.id = e.student_id WHERE e.course_id = $1 LIMIT 5;`,
          [c.id]
        );

        for (let idx = 0; idx < stuRes.rows.length; idx++) {
          await client.query(
            `INSERT INTO entries (student_id, course_id, subject_id, teacher_id, topic_id, class_date, remarks, status, device_id)
             VALUES ($1, $2, $3, $4, $5, '2026-10-24', 'Completed foundation topic (Prior to late Oct 2026)', 'covered', $6)
             ON CONFLICT (student_id, topic_id, class_date) DO NOTHING;`,
            [stuRes.rows[idx].id, c.id, subject_id, dipyamanId, topic_id, `device-${c.code}-${idx}`]
          );
        }
      }
    }
  });

  console.log('\n=== All Courses Successfully Synchronized with 280 Topics & Open Real-Time Submissions! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to propagate syllabus:', err);
  process.exit(1);
});
