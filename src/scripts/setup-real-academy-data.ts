import { query, withTransaction } from '../lib/db';

async function main() {
  console.log('--- Setting up Real Abhigyan Academy Courses & Faculty ---');

  const courses = [
    { name: 'National Defence Academy', code: 'NDA', sort_order: 1 },
    { name: 'Combined Defence Services', code: 'CDS', sort_order: 2 },
    { name: 'Air Force Common Admission Test', code: 'AFCAT', sort_order: 3 },
    { name: 'Services Selection Board & GD', code: 'SSBGD', sort_order: 4 },
    { name: 'Staff Selection Commission (GD)', code: 'SSCGD', sort_order: 5 },
    { name: 'Agniveer (Army / Navy / IAF)', code: 'AGNIVEER', sort_order: 6 },
    { name: 'Merchant Navy Entrance', code: 'MERCHANT_NAVY', sort_order: 7 },
  ];

  const teachers = [
    { name: 'Dipyaman Sir', phone: null, subjects: ['Maths'] },
    { name: 'Pallavi Ma\'am', phone: null, subjects: ['Chemistry'] },
    { name: 'Pallabi Bhuyan Ma\'am', phone: null, subjects: ['Biology'] },
    { name: 'Epsha Ma\'am', phone: null, subjects: ['English', 'Current Affairs'] },
    { name: 'Swapneel Sir', phone: null, subjects: ['Economics', 'Current Affairs'] },
    { name: 'Neelav Sir', phone: null, subjects: ['Geography', 'Current Affairs'] },
    { name: 'Salma Ma\'am', phone: null, subjects: ['History', 'Polity'] },
    { name: 'Ashish Sir', phone: null, subjects: ['Physics', 'Reasoning'] },
  ];

  const allSubjects = [
    'Maths',
    'Physics',
    'Chemistry',
    'Biology',
    'English',
    'Reasoning',
    'Current Affairs',
    'History',
    'Polity',
    'Economics',
    'Geography',
  ];

  await withTransaction(async (client) => {
    // 1. Insert or update courses
    const courseMap = new Map<string, string>();
    for (const c of courses) {
      const res = await client.query(
        `INSERT INTO courses (name, code, sort_order, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
         RETURNING id;`,
        [c.name, c.code, c.sort_order]
      );
      const cId = res.rows[0].id as string;
      courseMap.set(c.code, cId);

      // Ensure course settings
      await client.query(
        `INSERT INTO course_settings (course_id, confirmation_threshold, daily_entry_cap, code_ttl_minutes, require_class_code)
         VALUES ($1, 4, 6, 120, true)
         ON CONFLICT (course_id) DO NOTHING;`,
        [cId]
      );
    }
    console.log(`✓ 7 Courses verified & configured.`);

    // 2. Insert or update teachers
    const teacherMap = new Map<string, string>();
    for (const t of teachers) {
      const res = await client.query(
        `INSERT INTO teachers (name, phone, active)
         VALUES ($1, $2, true)
         ON CONFLICT DO NOTHING
         RETURNING id;`,
        [t.name, t.phone]
      );
      let tId = res.rows[0]?.id;
      if (!tId) {
        const find = await client.query(`SELECT id FROM teachers WHERE name = $1`, [t.name]);
        tId = find.rows[0].id;
      }
      teacherMap.set(t.name, tId);
    }
    console.log(`✓ 7 Teachers verified.`);

    // 3. For each course, create the common subjects if they don't already exist
    const subjectMap = new Map<string, string>(); // key: `${courseCode}_${subjectName}` -> subjectId
    for (const [code, cId] of courseMap.entries()) {
      let sortOrder = 1;
      for (const subName of allSubjects) {
        const res = await client.query(
          `INSERT INTO subjects (course_id, name, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING id;`,
          [cId, subName, sortOrder++]
        );
        let sId = res.rows[0]?.id;
        if (!sId) {
          const find = await client.query(
            `SELECT id FROM subjects WHERE course_id = $1 AND name = $2`,
            [cId, subName]
          );
          if (find.rows.length > 0) {
            sId = find.rows[0].id;
          }
        }
        if (sId) {
          subjectMap.set(`${code}_${subName.toLowerCase()}`, sId);
        }
      }
    }
    console.log(`✓ Core Subjects initialized for all 7 courses.`);

    // 4. Map teachers to subjects across all courses
    for (const t of teachers) {
      const tId = teacherMap.get(t.name);
      if (!tId) continue;

      for (const subName of t.subjects) {
        for (const [code] of courseMap.entries()) {
          const sId = subjectMap.get(`${code}_${subName.toLowerCase()}`);
          if (sId) {
            await client.query(
              `INSERT INTO teacher_subjects (teacher_id, subject_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING;`,
              [tId, sId]
            );
          }
        }
      }
    }
    console.log(`✓ Teacher-to-subject mappings linked across courses.`);
  });

  console.log('--- Real Academy Data Setup Completed Successfully! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to setup real academy data:', err);
  process.exit(1);
});
