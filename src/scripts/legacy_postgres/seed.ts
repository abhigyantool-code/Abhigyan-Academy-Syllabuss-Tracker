import { query } from '../lib/db';
import { getTodayIST, offsetDaysIST, getTodayBoundsIST } from '../lib/date-utils';

async function seed() {
  console.log('--- Starting Seed Data Generation for Abhigyan Academy ---');
  try {
    const today = getTodayIST();
    console.log(`Current IST Reference Date: ${today}`);

    // Clean existing data for clean seed
    await query(`
      TRUNCATE TABLE entries, class_codes, enrollments, students, teacher_subjects, 
                     teachers, topics, subjects, course_settings, courses, audit_log CASCADE;
    `);

    // 1. Courses & Settings
    const courseData = [
      { name: 'National Defence Academy (NDA)', code: 'NDA', sort_order: 1, threshold: 5, require_code: true },
      { name: 'Combined Defence Services (CDS)', code: 'CDS', sort_order: 2, threshold: 4, require_code: true },
      { name: 'Services Selection Board (SSB Interview)', code: 'SSB', sort_order: 3, threshold: 3, require_code: false },
      { name: 'Staff Selection Commission (SSC)', code: 'SSC', sort_order: 4, threshold: 5, require_code: true },
    ];

    const courseMap: Record<string, string> = {};

    for (const c of courseData) {
      const res = await query(
        `INSERT INTO courses (name, code, sort_order, active) VALUES ($1, $2, $3, true) RETURNING id;`,
        [c.name, c.code, c.sort_order]
      );
      const courseId = res.rows[0].id;
      courseMap[c.code] = courseId;

      await query(
        `INSERT INTO course_settings (course_id, confirmation_threshold, daily_entry_cap, code_ttl_minutes, require_class_code)
         VALUES ($1, $2, 6, 120, $3);`,
        [courseId, c.threshold, c.require_code]
      );
    }
    console.log('✓ Courses & Course Settings inserted.');

    // 2. Teachers
    const teacherData = [
      { name: 'Col. R. K. Sharma (Retd.)', phone: '+91 98765 43210' },
      { name: 'Prof. Neha Verma', phone: '+91 98111 22334' },
      { name: 'Maj. Vikram Singh (Retd.)', phone: '+91 98222 33445' },
    ];

    const teacherIds: string[] = [];
    for (const t of teacherData) {
      const res = await query(
        `INSERT INTO teachers (name, phone, active) VALUES ($1, $2, true) RETURNING id;`,
        [t.name, t.phone]
      );
      teacherIds.push(res.rows[0].id);
    }
    console.log(`✓ ${teacherIds.length} Teachers inserted.`);

    // 3. Subjects & Topics
    // Structure: courseCode -> array of { subjectName, teacherIndex, topics: [ { name, offsetDays } ] }
    const syllabusStructure = [
      {
        courseCode: 'NDA',
        subjects: [
          {
            name: 'Mathematics',
            teacherIdx: 0,
            topics: [
              { name: 'Sets, Relations and Functions', offsetDays: -15 },
              { name: 'Complex Numbers & Quadratic Equations', offsetDays: -10 },
              { name: 'Matrices and Determinants', offsetDays: -5 },
              { name: 'Trigonometry & Inverse Trigonometric Functions', offsetDays: 3 },
              { name: 'Differential Calculus & Limits', offsetDays: 12 },
              { name: 'Integral Calculus & Vector Algebra', offsetDays: 25 },
            ],
          },
          {
            name: 'General Ability Test (GAT) - English',
            teacherIdx: 1,
            topics: [
              { name: 'Spotting Errors & Sentence Correction', offsetDays: -12 },
              { name: 'Synonyms & Antonyms', offsetDays: -4 },
              { name: 'Reading Comprehension & Cloze Test', offsetDays: 8 },
            ],
          },
          {
            name: 'General Ability Test (GAT) - Physics',
            teacherIdx: 2,
            topics: [
              { name: 'Physical Properties and States of Matter', offsetDays: -8 },
              { name: 'Newton Laws of Motion & Gravitation', offsetDays: 2 },
              { name: 'Work, Power and Energy', offsetDays: 15 },
            ],
          },
        ],
      },
      {
        courseCode: 'CDS',
        subjects: [
          {
            name: 'Elementary Mathematics',
            teacherIdx: 0,
            topics: [
              { name: 'Number System & Arithmetic Operations', offsetDays: -14 },
              { name: 'Algebra, Ratio and Proportions', offsetDays: -6 },
              { name: 'Geometry, Mensuration & Trigonometry', offsetDays: 7 },
            ],
          },
          {
            name: 'English Language',
            teacherIdx: 1,
            topics: [
              { name: 'Grammar, Parts of Speech & Prepositions', offsetDays: -9 },
              { name: 'Ordering of Sentences & Para Jumbles', offsetDays: 4 },
            ],
          },
        ],
      },
      {
        courseCode: 'SSB',
        subjects: [
          {
            name: 'Screening & Psychological Tests',
            teacherIdx: 2,
            topics: [
              { name: 'Officer Intelligence Rating (OIR) Test', offsetDays: -10 },
              { name: 'Picture Perception & Discussion Test (PPDT)', offsetDays: -2 },
              { name: 'Thematic Apperception Test (TAT)', offsetDays: 5 },
              { name: 'Situation Reaction Test (SRT)', offsetDays: 14 },
            ],
          },
          {
            name: 'GTO Tasks & Personal Interview',
            teacherIdx: 0,
            topics: [
              { name: 'Group Discussion & Military Planning Task (GD/GPE)', offsetDays: -6 },
              { name: 'Progressive Group Task (PGT) & Snake Race', offsetDays: 6 },
              { name: 'Personal Interview Techniques & CIQ Handling', offsetDays: 18 },
            ],
          },
        ],
      },
      {
        courseCode: 'SSC',
        subjects: [
          {
            name: 'Quantitative Aptitude',
            teacherIdx: 1,
            topics: [
              { name: 'Percentages, Profit, Loss & Discount', offsetDays: -10 },
              { name: 'Time, Speed and Distance & Trains', offsetDays: 5 },
              { name: 'Data Interpretation (DI) Charts', offsetDays: 15 },
            ],
          },
          {
            name: 'General Intelligence & Reasoning',
            teacherIdx: 2,
            topics: [
              { name: 'Analogy, Classification & Series', offsetDays: -8 },
              { name: 'Direction Sense, Syllogism & Blood Relations', offsetDays: 5 },
            ],
          },
        ],
      },
    ];

    const topicMap: Record<string, string> = {};
    const subjectMap: Record<string, string> = {};

    for (const item of syllabusStructure) {
      const courseId = courseMap[item.courseCode];
      for (let sIdx = 0; sIdx < item.subjects.length; sIdx++) {
        const sub = item.subjects[sIdx];
        const subRes = await query(
          `INSERT INTO subjects (course_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id;`,
          [courseId, sub.name, sIdx + 1]
        );
        const subId = subRes.rows[0].id;
        subjectMap[`${item.courseCode}-${sub.name}`] = subId;

        // Map teacher to subject
        const teacherId = teacherIds[sub.teacherIdx];
        await query(
          `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [teacherId, subId]
        );

        // Insert topics
        for (let tIdx = 0; tIdx < sub.topics.length; tIdx++) {
          const top = sub.topics[tIdx];
          const targetDate = offsetDaysIST(top.offsetDays, today);
          const topRes = await query(
            `INSERT INTO topics (subject_id, name, seq_no, target_date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
            [subId, top.name, tIdx + 1, targetDate, `Standard Abhigyan Academy curriculum block`]
          );
          topicMap[`${item.courseCode}-${sub.name}-${top.name}`] = topRes.rows[0].id;
        }
      }
    }
    console.log('✓ Subjects, Topics, and Teacher allocations inserted.');

    // 4. Students & Enrollments
    const studentData = [
      { roll_no: 'ABG-2026-001', name: 'Aarav Mehta' },
      { roll_no: 'ABG-2026-002', name: 'Rohit Chauhan' },
      { roll_no: 'ABG-2026-003', name: 'Ananya Deshmukh' },
      { roll_no: 'ABG-2026-004', name: 'Siddharth Nair' },
      { roll_no: 'ABG-2026-005', name: 'Priya Rathore' },
      { roll_no: 'ABG-2026-006', name: 'Devansh Rawat' },
      { roll_no: 'ABG-2026-007', name: 'Tanvi Joshi' },
      { roll_no: 'ABG-2026-008', name: 'Harshvardhan Rana' },
      { roll_no: 'ABG-2026-009', name: 'Ishita Saxena' },
      { roll_no: 'ABG-2026-010', name: 'Karan Thapa' },
    ];

    const studentIds: string[] = [];
    for (const s of studentData) {
      const res = await query(
        `INSERT INTO students (roll_no, name, active) VALUES ($1, $2, true) RETURNING id;`,
        [s.roll_no, s.name]
      );
      studentIds.push(res.rows[0].id);
    }
    console.log(`✓ ${studentIds.length} Students inserted.`);

    // Enrollments:
    // Students 0..5 in NDA
    for (let i = 0; i < 6; i++) {
      await query(`INSERT INTO enrollments (student_id, course_id, batch) VALUES ($1, $2, 'Alpha-Batch');`, [
        studentIds[i],
        courseMap['NDA'],
      ]);
    }
    // Students 3..7 in CDS
    for (let i = 3; i < 8; i++) {
      await query(`INSERT INTO enrollments (student_id, course_id, batch) VALUES ($1, $2, 'Bravo-Batch');`, [
        studentIds[i],
        courseMap['CDS'],
      ]);
    }
    // Students 0, 1, 6, 7 in SSB
    for (const idx of [0, 1, 6, 7]) {
      await query(`INSERT INTO enrollments (student_id, course_id, batch) VALUES ($1, $2, 'SSB-Batch-1');`, [
        studentIds[idx],
        courseMap['SSB'],
      ]);
    }
    // Students 6..9 in SSC
    for (let i = 6; i < 10; i++) {
      await query(`INSERT INTO enrollments (student_id, course_id, batch) VALUES ($1, $2, 'SSC-General');`, [
        studentIds[i],
        courseMap['SSC'],
      ]);
    }
    console.log('✓ Course Enrollments mapped.');

    // 5. Daily Class Codes for Today (IST)
    const { validFrom, validUntil } = getTodayBoundsIST(1440); // 24-hr window
    const classCodeMap: Record<string, string> = {};

    const codeValues: Record<string, string> = {
      NDA: 'NDA-942',
      CDS: 'CDS-318',
      SSB: 'SSB-550',
      SSC: 'SSC-721',
    };

    for (const code of ['NDA', 'CDS', 'SSB', 'SSC']) {
      const res = await query(
        `INSERT INTO class_codes (course_id, batch, class_date, code, valid_from, valid_until)
         VALUES ($1, 'Alpha', $2, $3, $4, $5) RETURNING id;`,
        [courseMap[code], today, codeValues[code], validFrom, validUntil]
      );
      classCodeMap[code] = res.rows[0].id;
    }
    console.log('✓ Active Class Codes for today generated.');

    // 6. Realistic Submissions / Entries
    // Let's create entries showing various statuses:
    // (a) NDA Math Topic 1 ("Sets, Relations"): 5 students submitted 'covered' on offsetDays(-14) => Status: COVERED
    const t1Id = topicMap['NDA-Mathematics-Sets, Relations and Functions'];
    const sMathId = subjectMap['NDA-Mathematics'];
    const cNdaId = courseMap['NDA'];
    const teacherSharma = teacherIds[0];

    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO entries (course_id, student_id, teacher_id, subject_id, topic_id, class_date, status, device_id, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'covered', 'dev-seed-uuid', 'auto');`,
        [cNdaId, studentIds[i], teacherSharma, sMathId, t1Id, offsetDaysIST(-14, today)]
      );
    }

    // (b) NDA Math Topic 2 ("Complex Numbers"): 2 students submitted 'covered' on offsetDays(-9) => Status: UNVERIFIED (needs 5)
    const t2Id = topicMap['NDA-Mathematics-Complex Numbers & Quadratic Equations'];
    for (let i = 0; i < 2; i++) {
      await query(
        `INSERT INTO entries (course_id, student_id, teacher_id, subject_id, topic_id, class_date, status, device_id, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'covered', 'dev-seed-uuid', 'auto');`,
        [cNdaId, studentIds[i], teacherSharma, sMathId, t2Id, offsetDaysIST(-9, today)]
      );
    }

    // (c) NDA Math Topic 3 ("Matrices"): 1 student submitted 'partial' on offsetDays(-3) => Status: IN_PROGRESS
    const t3Id = topicMap['NDA-Mathematics-Matrices and Determinants'];
    await query(
      `INSERT INTO entries (course_id, student_id, teacher_id, subject_id, topic_id, class_date, status, remarks, device_id, review_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'partial', 'Covered upto matrix multiplication', 'dev-seed-uuid', 'auto');`,
      [cNdaId, studentIds[0], teacherSharma, sMathId, t3Id, offsetDaysIST(-3, today)]
    );

    // (d) NDA GAT English Topic 1 ("Spotting Errors"): 5 students submitted 'covered' on offsetDays(-11) => Status: COVERED
    const tEng1Id = topicMap['NDA-General Ability Test (GAT) - English-Spotting Errors & Sentence Correction'];
    const sEngId = subjectMap['NDA-General Ability Test (GAT) - English'];
    const teacherVerma = teacherIds[1];
    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO entries (course_id, student_id, teacher_id, subject_id, topic_id, class_date, status, device_id, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'covered', 'dev-seed-uuid', 'auto');`,
        [cNdaId, studentIds[i], teacherVerma, sEngId, tEng1Id, offsetDaysIST(-11, today)]
      );
    }

    // (e) 1 Flagged Entry for the Review Queue:
    // Student submitted Topic 5 ("Differential Calculus") without prior topics being covered -> FLAG_SEQUENCE_JUMP
    const t5Id = topicMap['NDA-Mathematics-Differential Calculus & Limits'];
    await query(
      `INSERT INTO entries (course_id, student_id, teacher_id, subject_id, topic_id, class_date, status, remarks, device_id, flags, review_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'covered', 'Skipped ahead to calculus', 'dev-suspicious-device', $7, 'pending');`,
      [
        cNdaId,
        studentIds[2],
        teacherSharma,
        sMathId,
        t5Id,
        today,
        JSON.stringify(['FLAG_SEQUENCE_JUMP']),
      ]
    );

    // Initial audit log record
    await query(
      `INSERT INTO audit_log (actor_label, action, entity, after)
       VALUES ('System Initializer', 'SEED_DATABASE', 'system', $1);`,
      [JSON.stringify({ courses: 4, students: 10, teachers: 3, date: today })]
    );

    console.log('✓ Realistic entries and flagged submission inserted.');
    console.log('--- Database Seeding Complete! ---');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
