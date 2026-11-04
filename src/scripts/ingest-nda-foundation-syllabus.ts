import { query, withTransaction } from '../lib/db';

// Helper to interpolate target dates evenly across the planning window:
// Start: 2026-11-05 (early Nov 2026) -> End: 2027-04-05 (early April 2027, before 11 April exam)
function generateTargetDates(count: number, startDateStr = '2026-11-05', endDateStr = '2027-04-05'): string[] {
  const start = new Date(startDateStr).getTime();
  const end = new Date(endDateStr).getTime();
  const step = (end - start) / Math.max(1, count - 1);

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start + i * step);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function main() {
  console.log('=== Ingesting NDA Foundation 2027 Comprehensive Syllabus ===');

  const syllabusData: Record<string, { teacherName: string; topics: string[]; notesPrefix?: string }> = {
    'Biology': {
      teacherName: 'Pallabi Bhuyan Ma\'am',
      topics: [
        'Cell',
        'Animal Tissues',
        'Plant Tissues',
        'Life Processes',
        'Control and Coordination in Humans',
        'Control and Coordination in Plants',
        'Reproduction – Introduction',
        'Sexual Reproduction in Flowering Plants',
        'Human Reproduction',
        'Diversity in Organisms',
        'Human Health and Diseases',
        'Important Vitamins and Minerals',
        'Genetics',
      ],
    },
    'Chemistry': {
      teacherName: 'Pallavi Ma\'am',
      topics: [
        'Introduction',
        'Physical Classification of Matter',
        'Elements, Compounds and Mixtures',
        'Structure of Atom',
        'Electronic Configuration',
        'Periodic Table',
        'Chemical Bonding',
        'Acids, Bases and Salts',
        'Metals and Non-Metals',
        'The Iso Species and Carbon',
        'IUPAC Nomenclature and Types of Reactions',
        'Important Industrial Preparations, Corrosion, Water and Types of Hardness',
        'Mole Concept',
        'Chemistry in Everyday Life',
      ],
    },
    'Current Affairs': {
      teacherName: 'Neelav Sir', // Also co-taught by Epsha Ma'am & Swapneel Sir
      topics: [
        'September',
        'October',
        'November',
        'December',
        'January',
      ],
    },
    'Economics': {
      teacherName: 'Swapneel Sir',
      topics: [
        'Basics of Economics',
        'Types of Economy',
        'Planning in India',
        'Five Year Plans',
        'Money',
        'Banking',
        'Current Budget',
        'International Institutions',
      ],
    },
    'English': {
      teacherName: 'Epsha Ma\'am',
      topics: [
        'All About NDA Exam',
        'Vocabulary',
        'Noun',
        'Pronoun',
        'Idioms and Phrases',
        'Conjunction',
        'Adjective',
        'Adverb',
        'Preposition',
        'Fixed Preposition',
        'Articles',
        'Sentence Arrangement',
        'Verb',
        'Tense',
        'Conditional Sentences',
        'Question Tag',
        'Voice',
        'Narration',
        'Modals',
        'Passage',
        'Cloze Test',
        'Previous Year Questions',
        'Homophones',
        'Important Miscellaneous Questions',
      ],
    },
    'Geography': {
      teacherName: 'Neelav Sir',
      topics: [
        'Introduction of Geography & Syllabus',
        'Universe and Cosmology',
        'Solar System',
        'Earth, Latitude & Longitude',
        'Interior of the Earth',
        'Formation of the Continents & Rocks',
        'Plate Tectonics',
        'Geomorphic Process (Endogenetic & Exogenetic)',
        'Formation of Mountains, Plateaus & Plains',
        'Volcanos, Earthquake & Tsunami',
        'Composition & Structure of Atmosphere',
        'Earth Temperature & Atmospheric Pressure',
        'Temperature Zones, Pressure Belts & Winds',
        'Climate & Weather',
        'Precipitation, Cloud, Jet Stream & Cyclones',
        'Ocean & Ocean Relief Features',
        'Ocean Water Properties, Waves, Current & Tides',
        'Other Water Bodies & Formations',
        'World Facts About Continents',
        'Soil, Natural Vegetation & Types',
        'Physiography of India',
        'Indian Mountains',
        'Indian Plateau & Coastal Regions (Ghats)',
        'Plainland, Desert & Islands',
        'Drainage System (Northern)',
        'Drainage System (Peninsula)',
        'Indian Climate & Monsoon',
        'Vegetation & Forest',
        'India Soil & Agriculture (Crops)',
        'Minerals, Energy & Industry',
        'Transportation',
        'Practice Session',
      ],
    },
    'History': {
      teacherName: 'Salma Ma\'am',
      topics: [
        'Introduction',
        'Origin of Human',
        'Indus Valley Civilization',
        'Vedic Civilization',
        'Religious Movement',
        'Mahajanapadas / Foreign Invasions',
        'Mauryan Empire',
        'Post Mauryan Age',
        'Sangam Era',
        'Gupta Empire',
        'Post Gupta Age',
        'Rajput Period',
        'Chola Empire',
        'Delhi Sultanate',
        'Vijaynagar Empire',
        'Bahamani Empire',
        'Bhakti Movement',
        'Sufi Movement',
        'Rise of Mughals',
        'Expansion of Mughal Empire',
        'Aurangzeb and Decline of Mughals',
        'Later Mughals',
        'The Rise of Maratha Empire under Shivaji',
        'Peshwa and Third Battle of Panipat',
        'Arrival of Europeans in India',
        'British Conquest in India',
        'Early Revolts Against British Rule',
        'Indian Renaissance',
        'Rise of British Rule',
        'British Rule',
        'The Revolt of 1857',
        'Crown Rule',
        'National Movement',
        'World History',
      ],
    },
    'Physics': {
      teacherName: 'Ashish Sir',
      topics: [
        'Introduction',
        'Basic Mathematics',
        'Units & Measurements (Errors + Dimensions)',
        'Vector',
        'Motion in Straight Line',
        'Motion in Plane',
        'Newton’s Laws of Motion (NLM)',
        'Friction',
        'Work, Power & Energy (WPE)',
        'Gravitation',
        'Rotation (Basics)',
        'Mechanical Properties of Solids',
        'Mechanical Properties of Fluids',
        'Heat & Thermal Properties',
        'Thermodynamics + Kinetic Theory of Gases',
        'Simple Harmonic Motion (SHM)',
        'Waves & Sound',
        'Electrostatics',
        'Current Electricity',
        'Magnetism & Moving Charges',
        'Electromagnetic Induction (EMI) + AC',
        'Ray Optics + Wave Optics',
        'Modern Physics',
        'Semiconductor Electronics',
        'PYQ + Final Revision',
      ],
    },
    'Polity': {
      teacherName: 'Salma Ma\'am',
      topics: [
        'Introduction',
        'Basics of Polity',
        'Constitutional Development',
        'Making of Constitution',
        'Features and Preamble of Constitution',
        'Union and Its Territories',
        'Citizenship',
        'Fundamental Rights',
        'Directive Principles of State Policy',
        'Fundamental Duties',
        'Parliament',
        'President',
        'Vice President',
        'State Legislature',
        'Governor',
        'Supreme Court',
        'High Court',
        'Emergency',
        'Local Self Government',
        'Constitutional Bodies',
        'Important Amendments',
        'Miscellaneous',
      ],
    },
    'SSB Sessions': {
      teacherName: 'Ashish Sir', // Can be co-instructed
      topics: [
        'Introduction to SSB Process',
        'OIR Lectures',
        'PPDT: Story Writing',
        'PPDT: Narration & Group Discussion',
        'Introduction to GTO & Its Importance',
        'Group Tasks: GD + GPE',
        'Group Tasks: Individual Obstacles (IO) & Group Obstacle Race (GOR)',
        'Group Tasks: PGT/HGT/CT/FGT',
        'Introduction to Lecturette',
        'Introduction to Psychological Tests',
        'Thematic Apperception Test',
        'Word Association Test',
        'Situation Reaction Test',
        'Self Description Test',
        'Introduction to Personal Interview & Understanding PIQ Form',
        'Introduction to CPSS (AFSB)',
      ],
    },
    'Mathematics': {
      teacherName: 'Dipyaman Sir',
      topics: [
        'Introduction',
        'Basic Math – Basic Formulae, Indices',
        'Basic Math – Inequality',
        'Basic Math – Modulus Basic',
        'Basic Math – Modulus Advanced',
        'Logarithms – Logarithms Properties',
        'Logarithms – Logarithms and Exponential Function',
        'Logarithms – PYQs and Doubts',
        'Sets – Sets and Their Representations',
        'Sets – Types of Set',
        'Sets – Venn Diagram',
        'Sets – Operation on Sets (Union, Intersection, Difference of Sets)',
        'Sets – PYQs and Doubts',
        'Quadratic Equations – Basics of Roots, Solution and Nature of Roots',
        'Quadratic Equations – Properties of Roots',
        'Quadratic Equations – Graph and Location of Roots',
        'Quadratic Equations – PYQs and Doubts',
        'Sequence and Series – Basics of Progression and Series',
        'Sequence and Series – Arithmetic Progression',
        'Sequence and Series – Arithmetic and Harmonic Progression',
        'Sequence and Series – Geometric Progression',
        'Sequence and Series – Relation Between AM and GM',
        'Sequence and Series – PYQs and Doubts',
        'Relations and Functions – Cartesian Products of Sets',
        'Relations and Functions – Relations',
        'Relations and Functions – Functions',
        'Relations and Functions – Some Functions and Their Graphs',
        'Relations and Functions – Domain and Range',
        'Relations and Functions – PYQs and Doubts',
        'Trigonometry – Introduction to Trigonometry & Identities, Quadrants and Conversion of Angle',
        'Trigonometry – Compound Angle and Transformation of Angles',
        'Trigonometry – Multiple Angle Formulas',
        'Trigonometry – PYQs and Doubts',
        'Trigonometric Equations – General Solutions of Trigonometric Equations',
        'Trigonometric Equations – PYQs and Doubts',
        'Applications of Trigonometry – Heights and Distances',
        'Applications of Trigonometry – Properties of Triangle',
        'Applications of Trigonometry – PYQs and Doubts',
        'Complex Numbers – Imaginary Number, Power of Iota, Basics of Complex',
        'Complex Numbers – Conjugate and Modulus, Amplitude, Polar Form',
        'Complex Numbers – Eulerian Form, Square Root, Cube Root of Unity',
        'Complex Numbers – Maximum, Minimum',
        'Permutations & Combinations – Permutations',
        'Permutations & Combinations – Combinations',
        'Permutations & Combinations – Mixed Problems',
        'Permutations & Combinations – PYQs and Doubts',
        'Binomial Theorem – Number of Terms, General Term',
        'Binomial Theorem – Coefficient of Terms, Middle Term, Greatest Term',
        'Binomial Theorem – NGT and Special Formula',
        'Binomial Theorem – PYQs and Doubts',
        'Probability – Random Experiments, Outcomes and Sample Space, Event, Occurrence of an Event',
        'Probability – Types of Events, Algebra of Events',
        'Probability – Axiomatic Approach to Probability',
        'Probability – Probability (Advanced)',
        'Probability – Conditional Probability',
        'Probability – Total Probability Theorem',
        'Probability – Bayes’ Theorem',
        'Probability – Probability Distribution',
        'Probability – PYQs and Doubts',
        'Co-ordinate Geometry – Cartesian Coordinate System and Section Formula',
        'Co-ordinate Geometry – Slope, Equation of Line, Angle Between Two Lines',
        'Co-ordinate Geometry – Various Forms of the Equation of a Line',
        'Co-ordinate Geometry – Distance of a Point From a Line',
        'Co-ordinate Geometry – Pairs of Straight Line and Miscellaneous',
        'Co-ordinate Geometry – Term Related to Triangles',
        'Co-ordinate Geometry – PYQs and Doubts',
        'Conic Section – Basics of Circles',
        'Conic Section – Intersections of Circle and Parametric Form of Circle',
        'Conic Section – Tangent and Normal of Circles',
        'Conic Section – Introduction to Parabola and Standard Form',
        'Conic Section – Shifting of Parabola',
        'Conic Section – Ellipse',
        'Conic Section – Hyperbola',
        'Conic Section – PYQs and Doubts',
        'Three Dimensional Geometry – Basics of Three Dimensional Geometry',
        'Limits and Derivatives – Basics of Limits',
        'Limits and Derivatives – Existence of Limits',
        'Limits and Derivatives – Limits and Evaluation of Limits',
        'Limits and Derivatives – Derivatives',
        'Limits and Derivatives – L’Hôpital Rule of Limit',
        'Limits and Derivatives – First Principle of Differentiation',
        'Limits and Derivatives – Chain Rule of Derivative',
        'Limits and Derivatives – Algebra of Derivative (Product and Division Rule)',
        'Limits and Derivatives – Parametric Form of Derivative',
        'Limits and Derivatives – Logarithmic & Implicit Differentiation',
        'Statistics',
        'Binary Numbers',
      ],
    },
  };

  await withTransaction(async (client) => {
    // 1. Get NDA Course
    const courseRes = await client.query(`SELECT id FROM courses WHERE code = 'NDA' LIMIT 1;`);
    if (courseRes.rows.length === 0) throw new Error('NDA course not found!');
    const ndaCourseId = courseRes.rows[0].id;

    // 2. Fetch all active teachers map
    const teachersRes = await client.query(`SELECT id, name FROM teachers WHERE active = true;`);
    const teacherMap = new Map<string, string>();
    teachersRes.rows.forEach((t: any) => teacherMap.set(t.name, t.id));

    // Also fetch NDA students for re-linking verified entries
    const studentsRes = await client.query(
      `SELECT s.id FROM students s JOIN enrollments e ON s.id = e.student_id WHERE e.course_id = $1 AND s.active = true;`,
      [ndaCourseId]
    );
    const ndaStudentIds = studentsRes.rows.map((r: any) => r.id);

    let totalSubjectsUpdated = 0;
    let totalTopicsInserted = 0;

    for (const [subjectName, data] of Object.entries(syllabusData)) {
      // Find or insert Subject
      let subRes = await client.query(
        `SELECT id FROM subjects WHERE course_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1;`,
        [ndaCourseId, subjectName]
      );
      let subjectId: string;
      if (subRes.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO subjects (course_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id;`,
          [ndaCourseId, subjectName, totalSubjectsUpdated + 1]
        );
        subjectId = ins.rows[0].id;
      } else {
        subjectId = subRes.rows[0].id;
      }

      // Link Teacher(s)
      const primaryTeacherId = teacherMap.get(data.teacherName);
      if (primaryTeacherId) {
        await client.query(
          `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [primaryTeacherId, subjectId]
        );
      }

      // If Current Affairs, also link Epsha Ma'am and Swapneel Sir
      if (subjectName === 'Current Affairs') {
        const epshaId = teacherMap.get('Epsha Ma\'am');
        const swapneelId = teacherMap.get('Swapneel Sir');
        if (epshaId) {
          await client.query(
            `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [epshaId, subjectId]
          );
        }
        if (swapneelId) {
          await client.query(
            `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [swapneelId, subjectId]
          );
        }
      }

      // Remove existing entries and topics for this subject to load fresh comprehensive topics
      await client.query(`DELETE FROM entries WHERE subject_id = $1;`, [subjectId]);
      await client.query(`DELETE FROM topics WHERE subject_id = $1;`, [subjectId]);

      // Generate target dates evenly across the syllabus
      const targetDates = generateTargetDates(data.topics.length);

      let seq = 1;
      let trigTopicIds: string[] = [];
      for (let i = 0; i < data.topics.length; i++) {
        const topicTitle = data.topics[i];
        const targetDate = targetDates[i];
        const isTrig = subjectName === 'Mathematics' && topicTitle.toLowerCase().startsWith('trigonometr');

        const topIns = await client.query(
          `INSERT INTO topics (subject_id, name, seq_no, target_date, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id;`,
          [
            subjectId,
            topicTitle,
            seq++,
            isTrig ? '2026-10-24' : targetDate,
            isTrig ? 'Completed foundation module (Prior to late Oct 2026)' : 'NDA Foundation 2027 Comprehensive Module',
          ]
        );

        if (isTrig) {
          trigTopicIds.push(topIns.rows[0].id);
        }
        totalTopicsInserted++;
      }

      // Re-link verified entries for completed Trigonometry in Mathematics
      if (subjectName === 'Mathematics' && trigTopicIds.length > 0 && primaryTeacherId) {
        // Mark the primary Trigonometry modules as covered with verified student submissions
        for (const trigId of trigTopicIds) {
          for (let s = 0; s < Math.min(6, ndaStudentIds.length); s++) {
            await client.query(
              `INSERT INTO entries (student_id, course_id, subject_id, teacher_id, topic_id, class_date, remarks, status, device_id)
               VALUES ($1, $2, $3, $4, $5, '2026-10-24', 'Completed foundation topic (Prior to late Oct 2026)', 'covered', $6)
               ON CONFLICT (student_id, topic_id, class_date) DO NOTHING;`,
              [ndaStudentIds[s], ndaCourseId, subjectId, primaryTeacherId, trigId, `dev-trig-${s}`]
            );
          }
        }
      }

      totalSubjectsUpdated++;
      console.log(`✓ [${subjectName}]: ${data.topics.length} topics inserted -> Faculty: ${data.teacherName}`);
    }

    console.log(`\nAll Done! ${totalSubjectsUpdated} subjects updated with ${totalTopicsInserted} total topics.`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to ingest comprehensive syllabus:', err);
  process.exit(1);
});
