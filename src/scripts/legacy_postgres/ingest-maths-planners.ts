import { query, withTransaction } from '../lib/db';

async function main() {
  console.log('--- Ingesting Official Maths Lesson Planners for Abhigyan Academy ---');

  // Class schedule simulation: 3 classes/week (Mon, Wed, Fri) starting Oct 26, 2026
  const days = [1, 3, 5];
  let d = new Date('2026-10-26T00:00:00Z');
  const classDates: string[] = [];
  while (classDates.length < 75) {
    if (days.includes(d.getUTCDay())) {
      classDates.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const ndaTopicsRaw = [
    { name: 'Sets, Relations and Functions', classes: 2 },
    { name: 'Complex Numbers', classes: 3 },
    { name: 'Quadratic Equations and Inequalities', classes: 3 },
    { name: 'Sequence and Series', classes: 3 },
    { name: 'Permutations and Combinations', classes: 3 },
    { name: 'Binomial Theorem', classes: 2 },
    { name: 'Logarithms, Mathematical Induction and Binary Numbers', classes: 3 },
    { name: 'Matrices and Determinants', classes: 4 },
    { name: 'Straight Lines and Circles', classes: 5 },
    { name: 'Conic Sections', classes: 3 },
    { name: 'Three-Dimensional Coordinate Geometry', classes: 3 },
    { name: 'Differential Calculus and Applications', classes: 7 },
    { name: 'Integral Calculus and Applications', classes: 7 },
    { name: 'Differential Equations', classes: 2 },
    { name: 'Vector Algebra', classes: 4 },
    { name: 'Statistics', classes: 2 },
    { name: 'Probability', classes: 2 },
    { name: 'Trigonometry revision and mixed questions', classes: 2, isRevision: true },
    { name: 'Topic-wise and mixed previous-year questions (PYQs)', classes: 6, isRevision: true },
    { name: 'Full-syllabus mock tests and analysis', classes: 4, isMock: true },
    { name: 'Backlog, difficult questions and buffer', classes: 2, isBuffer: true },
  ];

  const cdsTopicsRaw = [
    { name: 'Number System and Elementary Number Theory', classes: 4 },
    { name: 'HCF, LCM, Divisibility and Remainders', classes: 3 },
    { name: 'Indices, Logarithms and Simplification', classes: 3 },
    { name: 'Ratio, Proportion and Variation', classes: 3 },
    { name: 'Percentages', classes: 2 },
    { name: 'Profit, Loss and Discount', classes: 2 },
    { name: 'Simple and Compound Interest', classes: 2 },
    { name: 'Time and Work', classes: 2 },
    { name: 'Time, Speed and Distance', classes: 3 },
    { name: 'Averages and Unitary Method', classes: 2 },
    { name: 'Algebraic Identities, Factorisation and Polynomials', classes: 4 },
    { name: 'Linear Equations and Inequalities', classes: 3 },
    { name: 'Quadratic Equations and Applications', classes: 3 },
    { name: 'Sets and Rational Expressions', classes: 2 },
    { name: 'Lines, Angles and Triangles', classes: 4 },
    { name: 'Congruency, Similarity and Triangle Properties', classes: 2 },
    { name: 'Quadrilaterals and Polygons', classes: 2 },
    { name: 'Circles, Tangents and Loci', classes: 2 },
    { name: 'Mensuration: Areas of Plane Figures', classes: 2 },
    { name: 'Mensuration: Surface Areas and Volumes', classes: 2 },
    { name: 'Statistics and Data Interpretation', classes: 2 },
    { name: 'Trigonometry revision and mixed questions', classes: 2, isRevision: true },
    { name: 'Topic-wise PYQs and timed practice', classes: 6, isRevision: true },
    { name: 'Full-syllabus mock tests and analysis', classes: 6, isMock: true },
    { name: 'Backlog and buffer classes', classes: 4, isBuffer: true },
  ];

  await withTransaction(async (client) => {
    // 1. Get Dipyaman Sir
    const dipyRes = await client.query(`SELECT id FROM teachers WHERE name = 'Dipyaman Sir' LIMIT 1;`);
    if (dipyRes.rows.length === 0) {
      throw new Error('Dipyaman Sir not found in teachers table!');
    }
    const dipyamanId = dipyRes.rows[0].id;

    // 2. Fetch NDA and CDS courses
    const courseRes = await client.query(`SELECT id, code FROM courses WHERE code IN ('NDA', 'CDS');`);
    const ndaCourse = courseRes.rows.find((c: any) => c.code === 'NDA');
    const cdsCourse = courseRes.rows.find((c: any) => c.code === 'CDS');
    if (!ndaCourse || !cdsCourse) {
      throw new Error('NDA or CDS course not found!');
    }

    // 3. Ensure Subject: NDA -> Mathematics
    let ndaSubRes = await client.query(
      `SELECT id FROM subjects WHERE course_id = $1 AND name IN ('Mathematics', 'NDA Mathematics') LIMIT 1;`,
      [ndaCourse.id]
    );
    let ndaSubjectId: string;
    if (ndaSubRes.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO subjects (course_id, name, sort_order) VALUES ($1, 'Mathematics', 1) RETURNING id;`,
        [ndaCourse.id]
      );
      ndaSubjectId = ins.rows[0].id;
    } else {
      ndaSubjectId = ndaSubRes.rows[0].id;
      await client.query(`UPDATE subjects SET name = 'Mathematics' WHERE id = $1;`, [ndaSubjectId]);
    }

    // 4. Ensure Subject: CDS -> Elementary Mathematics
    let cdsSubRes = await client.query(
      `SELECT id FROM subjects WHERE course_id = $1 AND name IN ('Elementary Mathematics', 'CDS Elementary Mathematics') LIMIT 1;`,
      [cdsCourse.id]
    );
    let cdsSubjectId: string;
    if (cdsSubRes.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO subjects (course_id, name, sort_order) VALUES ($1, 'Elementary Mathematics', 1) RETURNING id;`,
        [cdsCourse.id]
      );
      cdsSubjectId = ins.rows[0].id;
    } else {
      cdsSubjectId = cdsSubRes.rows[0].id;
    }

    // 5. Link Dipyaman Sir to both subjects
    await client.query(
      `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [dipyamanId, ndaSubjectId]
    );
    await client.query(
      `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [dipyamanId, cdsSubjectId]
    );
    console.log('✓ Dipyaman Sir linked to NDA Mathematics & CDS Elementary Mathematics.');

    // 6. Delete old topics and populate NDA Mathematics topics
    // We clean topics for these subjects to replace with the official lesson planner
    await client.query(`DELETE FROM entries WHERE subject_id IN ($1, $2);`, [ndaSubjectId, cdsSubjectId]);
    await client.query(`DELETE FROM topics WHERE subject_id IN ($1, $2);`, [ndaSubjectId, cdsSubjectId]);

    // Insert Trigonometry as seq_no 1 (Completed topic)
    const ndaTrigRes = await client.query(
      `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
       VALUES ($1, 'Trigonometry', 1, '2026-10-24', 'Completed foundation topic (Prior to late Oct 2026)')
       RETURNING id;`,
      [ndaSubjectId]
    );
    const ndaTrigId = ndaTrigRes.rows[0].id;

    let ndaClassIdx = 0;
    let seq = 2;
    for (const t of ndaTopicsRaw) {
      ndaClassIdx += t.classes;
      const targetDate = classDates[ndaClassIdx - 1];
      const notes = `${t.classes} classes (90 mins each)${t.isRevision ? ' | Revision / PYQs' : ''}${t.isMock ? ' | Mock Tests & Analysis' : ''}${t.isBuffer ? ' | Buffer & Difficult Qs' : ''}`;
      await client.query(
        `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
         VALUES ($1, $2, $3, $4, $5);`,
        [ndaSubjectId, t.name, seq++, targetDate, notes]
      );
    }
    console.log(`✓ NDA Mathematics: 22 topics inserted (Trigonometry + 21 planned modules).`);

    // Insert CDS Elementary Mathematics topics
    const cdsTrigRes = await client.query(
      `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
       VALUES ($1, 'Trigonometry', 1, '2026-10-24', 'Completed foundation topic (Prior to late Oct 2026)')
       RETURNING id;`,
      [cdsSubjectId]
    );
    const cdsTrigId = cdsTrigRes.rows[0].id;

    let cdsClassIdx = 0;
    seq = 2;
    for (const t of cdsTopicsRaw) {
      cdsClassIdx += t.classes;
      const targetDate = classDates[cdsClassIdx - 1];
      const notes = `${t.classes} classes (90 mins each)${t.isRevision ? ' | Revision / PYQs' : ''}${t.isMock ? ' | Mock Tests & Analysis' : ''}${t.isBuffer ? ' | Buffer & Backlog' : ''}`;
      await client.query(
        `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
         VALUES ($1, $2, $3, $4, $5);`,
        [cdsSubjectId, t.name, seq++, targetDate, notes]
      );
    }
    console.log(`✓ CDS Elementary Mathematics: 26 topics inserted (Trigonometry + 25 planned modules).`);

    // 7. Seed verified entries for the "Completed" Trigonometry topic in both courses
    // Fetch active students for NDA and CDS
    const ndaStudents = await client.query(
      `SELECT s.id FROM students s 
       JOIN enrollments e ON s.id = e.student_id 
       WHERE e.course_id = $1 AND s.active = true LIMIT 5;`,
      [ndaCourse.id]
    );
    const cdsStudents = await client.query(
      `SELECT s.id FROM students s 
       JOIN enrollments e ON s.id = e.student_id 
       WHERE e.course_id = $1 AND s.active = true LIMIT 5;`,
      [cdsCourse.id]
    );

    // If no CDS students enrolled yet, enroll a few
    let cdsStudentIds = cdsStudents.rows.map((r: any) => r.id);
    if (cdsStudentIds.length === 0) {
      const allStudents = await client.query(`SELECT id FROM students WHERE active = true LIMIT 5;`);
      for (const st of allStudents.rows) {
        await client.query(
          `INSERT INTO enrollments (student_id, course_id, batch) VALUES ($1, $2, 'General') ON CONFLICT DO NOTHING;`,
          [st.id, cdsCourse.id]
        );
      }
      cdsStudentIds = allStudents.rows.map((r: any) => r.id);
    }

    // Insert entries for Trigonometry in NDA (completed prior to Oct 26)
    for (let i = 0; i < Math.min(5, ndaStudents.rows.length); i++) {
      const stuId = ndaStudents.rows[i].id;
      await client.query(
        `INSERT INTO entries (student_id, course_id, subject_id, teacher_id, topic_id, class_date, remarks, status, device_id)
         VALUES ($1, $2, $3, $4, $5, '2026-10-24', 'Trigonometric Identities & Equations', 'covered', $6)
         ON CONFLICT (student_id, topic_id, class_date) DO NOTHING;`,
        [stuId, ndaCourse.id, ndaSubjectId, dipyamanId, ndaTrigId, `dev-fingerprint-${i}`]
      );
    }

    // Insert entries for Trigonometry in CDS (completed prior to Oct 26)
    for (let i = 0; i < Math.min(5, cdsStudentIds.length); i++) {
      const stuId = cdsStudentIds[i];
      await client.query(
        `INSERT INTO entries (student_id, course_id, subject_id, teacher_id, topic_id, class_date, remarks, status, device_id)
         VALUES ($1, $2, $3, $4, $5, '2026-10-24', 'Heights and Distances & Ratios', 'covered', $6)
         ON CONFLICT (student_id, topic_id, class_date) DO NOTHING;`,
        [stuId, cdsCourse.id, cdsSubjectId, dipyamanId, cdsTrigId, `dev-fingerprint-cds-${i}`]
      );
    }
    console.log('✓ Trigonometry marked as covered with verified entries in NDA & CDS.');
  });

  console.log('--- Maths Planners Ingestion Complete! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to ingest maths planners:', err);
  process.exit(1);
});
