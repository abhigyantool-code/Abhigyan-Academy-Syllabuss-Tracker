/**
 * Synthetic Test Account Scaffolding Script
 * Milestone 1: Test Harness & Data Scaffolding
 *
 * Requirements:
 * 1. Connects to PocketBase using getPbClient() in src/lib/pb.ts.
 * 2. Runs pre-flight invariant check against database/backups verifying 75 genuine students,
 *    8 genuine teachers, 13 genuine historical submissions exist and match baseline.
 * 3. Idempotently provisions 99 additional synthetic students (BOT-STU-002 through BOT-STU-100,
 *    names ZZ_TEST_STUDENT_002 through ZZ_TEST_STUDENT_100) with PIN 4321 (isTemporary = false),
 *    enrolled strictly in TEST_COURSE (2j6b8pjusevzyqt), batch 'BOT-Sandbox'.
 * 4. Idempotently provisions 14 additional synthetic teachers (BOT-TEA-002 through BOT-TEA-015,
 *    names ZZ_TEST_TEACHER_002 through ZZ_TEST_TEACHER_015) with PIN 4321 (isTemporary = false),
 *    allocated strictly to Sandbox Subject (lphg44ud28m9zu3) under TEST_COURSE.
 * 5. Verifies existing BOT-STU-001 and BOT-TEA-001 remain functional with PIN 4321.
 * 6. Runs post-flight invariant assertion confirming all 75 genuine students, 8 genuine teachers,
 *    and 13 historical entries are 100% untouched.
 */

import fs from 'fs';
import path from 'path';
import { getPbClient } from '../lib/pb';
import { hashPin, verifyPinDual, isTemporaryPinHash } from '../lib/pin-hash';

// Load .env.local if present
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile('.env.local');
  } catch {}
}

export const TEST_COURSE_ID = '2j6b8pjusevzyqt';
export const TEST_COURSE_CODE = 'TEST_COURSE';
export const SANDBOX_SUBJECT_ID = 'lphg44ud28m9zu3';
export const SANDBOX_BATCH = 'BOT-Sandbox';
export const DEFAULT_BOT_PIN = '4321';

export interface InvariantResult {
  intact: boolean;
  backupDir: string;
  details: {
    genuineStudentsCount: number;
    genuineTeachersCount: number;
    genuineEntriesCount: number;
    totalStudentsCount: number;
    totalTeachersCount: number;
    totalEntriesCount: number;
  };
}

/**
 * Finds the latest dated backup directory in database/backups
 */
export function findBaselineBackupDir(): string {
  const backupsRoot = path.join(process.cwd(), 'database/backups');
  if (!fs.existsSync(backupsRoot)) {
    throw new Error(`Backups root directory not found at ${backupsRoot}`);
  }
  const dirs = fs
    .readdirSync(backupsRoot)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && fs.existsSync(path.join(backupsRoot, d, 'students.json')))
    .sort()
    .reverse();

  if (dirs.length === 0) {
    throw new Error(`No valid dated backup directories found in ${backupsRoot}`);
  }
  return path.join(backupsRoot, dirs[0]);
}

/**
 * Validates that all genuine records (75 students, 8 teachers, 13 entries)
 * exist in live PocketBase and match baseline backup records exactly.
 */
export async function verifyBaselineInvariants(): Promise<InvariantResult> {
  const backupDir = findBaselineBackupDir();
  const rawStudents = JSON.parse(fs.readFileSync(path.join(backupDir, 'students.json'), 'utf8'));
  const rawTeachers = JSON.parse(fs.readFileSync(path.join(backupDir, 'teachers.json'), 'utf8'));
  const rawEntries = JSON.parse(fs.readFileSync(path.join(backupDir, 'entries.json'), 'utf8'));

  const baselineStudents = rawStudents.filter((s: any) => !s.name.includes('TEST') && !s.roll_no?.startsWith('BOT-'));
  const baselineTeachers = rawTeachers.filter((t: any) => !t.name.includes('TEST') && !t.phone?.startsWith('BOT-'));
  const baselineEntries = rawEntries.filter((e: any) => e.course !== TEST_COURSE_ID);

  if (baselineStudents.length !== 75) {
    throw new Error(`Baseline backup error: Expected 75 genuine students, found ${baselineStudents.length}`);
  }
  if (baselineTeachers.length !== 8) {
    throw new Error(`Baseline backup error: Expected 8 genuine teachers, found ${baselineTeachers.length}`);
  }
  if (baselineEntries.length !== 13) {
    throw new Error(`Baseline backup error: Expected 13 genuine historical entries, found ${baselineEntries.length}`);
  }

  const pb = await getPbClient();
  const liveStudents = await pb.collection('students').getFullList();
  const liveTeachers = await pb.collection('teachers').getFullList();
  const liveEntries = await pb.collection('entries').getFullList();

  const liveGenuineStudents = liveStudents.filter((s: any) => !s.name.includes('TEST') && !s.roll_no?.startsWith('BOT-'));
  const liveGenuineTeachers = liveTeachers.filter((t: any) => !t.name.includes('TEST') && !t.phone?.startsWith('BOT-'));
  const liveGenuineEntries = liveEntries.filter((e: any) => e.course !== TEST_COURSE_ID);

  if (liveGenuineStudents.length !== 75) {
    throw new Error(`DATA INVARIANT VIOLATION: Live database has ${liveGenuineStudents.length} genuine students (expected 75)`);
  }
  if (liveGenuineTeachers.length !== 8) {
    throw new Error(`DATA INVARIANT VIOLATION: Live database has ${liveGenuineTeachers.length} genuine teachers (expected 8)`);
  }
  if (liveGenuineEntries.length !== 13) {
    throw new Error(`DATA INVARIANT VIOLATION: Live database has ${liveGenuineEntries.length} genuine entries (expected 13)`);
  }

  // Deep field validation for students
  for (const bStu of baselineStudents) {
    const live = liveGenuineStudents.find((s) => s.id === bStu.id);
    if (!live) {
      throw new Error(`DATA INVARIANT VIOLATION: Genuine student ${bStu.name} (${bStu.id}) is missing in live database!`);
    }
    if (live.roll_no !== bStu.roll_no || live.name !== bStu.name || live.pin_hash !== bStu.pin_hash) {
      throw new Error(`DATA INVARIANT VIOLATION: Genuine student ${bStu.name} (${bStu.id}) was altered!`);
    }
  }

  // Deep field validation for teachers
  for (const bTea of baselineTeachers) {
    const live = liveGenuineTeachers.find((t) => t.id === bTea.id);
    if (!live) {
      throw new Error(`DATA INVARIANT VIOLATION: Genuine teacher ${bTea.name} (${bTea.id}) is missing in live database!`);
    }
    if (live.phone !== bTea.phone || live.name !== bTea.name || live.pin_hash !== bTea.pin_hash) {
      throw new Error(`DATA INVARIANT VIOLATION: Genuine teacher ${bTea.name} (${bTea.id}) was altered!`);
    }
  }

  // Deep field validation for entries
  for (const bEnt of baselineEntries) {
    const live = liveGenuineEntries.find((e) => e.id === bEnt.id);
    if (!live) {
      throw new Error(`DATA INVARIANT VIOLATION: Historical entry ${bEnt.id} is missing in live database!`);
    }
    if (live.student !== bEnt.student || live.topic !== bEnt.topic || live.course !== bEnt.course) {
      throw new Error(`DATA INVARIANT VIOLATION: Historical entry ${bEnt.id} was altered!`);
    }
  }

  return {
    intact: true,
    backupDir,
    details: {
      genuineStudentsCount: liveGenuineStudents.length,
      genuineTeachersCount: liveGenuineTeachers.length,
      genuineEntriesCount: liveGenuineEntries.length,
      totalStudentsCount: liveStudents.length,
      totalTeachersCount: liveTeachers.length,
      totalEntriesCount: liveEntries.length,
    },
  };
}

/**
 * Concurrency-controlled promise runner with retry and exponential backoff
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      const item = items[idx];
      let lastErr: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          results[idx] = await task(item, idx);
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, attempt * 200));
          }
        }
      }
      if (lastErr) {
        throw new Error(`Task failed for item at index ${idx} after 3 attempts: ${lastErr.message || lastErr}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function scaffoldSyntheticAccounts(): Promise<{
  studentsProvisioned: number;
  teachersProvisioned: number;
  bot1Verification: { studentBotValid: boolean; teacherBotValid: boolean };
}> {
  console.log('================================================================');
  console.log('🚀 SCAFFOLD SYNTHETIC ACCOUNTS (Milestone 1)');
  console.log('================================================================\n');

  // Step 1: Pre-flight Invariant Check
  console.log('--- Step 1: Pre-Flight Invariant Verification ---');
  const preCheck = await verifyBaselineInvariants();
  console.log(`  ✓ Baseline verified against ${preCheck.backupDir}`);
  console.log(`  ✓ Genuine Students: ${preCheck.details.genuineStudentsCount} (expected 75)`);
  console.log(`  ✓ Genuine Teachers: ${preCheck.details.genuineTeachersCount} (expected 8)`);
  console.log(`  ✓ Genuine Entries: ${preCheck.details.genuineEntriesCount} (expected 13)`);
  console.log('  ✅ Pre-flight invariant check passed 100%.\n');

  const pb = await getPbClient();

  // Verify TEST_COURSE exists
  const testCourse = await pb.collection('courses').getOne(TEST_COURSE_ID);
  if (!testCourse || testCourse.code !== TEST_COURSE_CODE) {
    throw new Error(`TEST_COURSE with ID ${TEST_COURSE_ID} not found or code mismatch!`);
  }
  console.log(`  ℹ Verified Sandbox Course: ${testCourse.name} (${testCourse.id})`);

  // Verify Sandbox Subject exists
  const sandboxSubject = await pb.collection('subjects').getOne(SANDBOX_SUBJECT_ID);
  if (!sandboxSubject || sandboxSubject.course !== TEST_COURSE_ID) {
    throw new Error(`Sandbox Subject with ID ${SANDBOX_SUBJECT_ID} not found or course mismatch!`);
  }
  console.log(`  ℹ Verified Sandbox Subject: ${sandboxSubject.name} (${sandboxSubject.id})`);

  // Step 2: Verify existing BOT-STU-001 and BOT-TEA-001
  console.log('\n--- Step 2: Verifying Existing BOT-STU-001 & BOT-TEA-001 ---');
  const existingStu1List = await pb.collection('students').getFullList({ filter: 'roll_no = "BOT-STU-001"' });
  if (existingStu1List.length === 0) {
    throw new Error('BOT-STU-001 is missing from database!');
  }
  const stu1 = existingStu1List[0];
  const stu1Verification = await verifyPinDual(DEFAULT_BOT_PIN, stu1.pin_hash);
  if (!stu1.active || !stu1Verification.valid || stu1Verification.isTemporary) {
    console.log('  ⚠️ Updating BOT-STU-001 to active and non-temporary PIN 4321...');
    const pinHash = await hashPin(DEFAULT_BOT_PIN);
    await pb.collection('students').update(stu1.id, {
      active: true,
      pin: '',
      pin_hash: pinHash,
    });
  }
  console.log(`  ✓ BOT-STU-001 (${stu1.name}, ID: ${stu1.id}) verified functional with PIN ${DEFAULT_BOT_PIN}`);

  const existingTea1List = await pb.collection('teachers').getFullList({ filter: 'phone = "BOT-TEA-001"' });
  if (existingTea1List.length === 0) {
    throw new Error('BOT-TEA-001 is missing from database!');
  }
  const tea1 = existingTea1List[0];
  const tea1Verification = await verifyPinDual(DEFAULT_BOT_PIN, tea1.pin_hash);
  if (!tea1.active || !tea1Verification.valid || tea1Verification.isTemporary) {
    console.log('  ⚠️ Updating BOT-TEA-001 to active and non-temporary PIN 4321...');
    const pinHash = await hashPin(DEFAULT_BOT_PIN);
    await pb.collection('teachers').update(tea1.id, {
      active: true,
      pin: '',
      pin_hash: pinHash,
    });
  }
  console.log(`  ✓ BOT-TEA-001 (${tea1.name}, ID: ${tea1.id}) verified functional with PIN ${DEFAULT_BOT_PIN}`);

  // Step 3: Provision 99 Synthetic Students (BOT-STU-002 through BOT-STU-100)
  console.log('\n--- Step 3: Provisioning Synthetic Students (BOT-STU-002..100) ---');
  // Generate hashed PIN for 4321 once (without $temp$)
  const studentPinHash = await hashPin(DEFAULT_BOT_PIN);

  // Fetch all existing students
  const currentStudents = await pb.collection('students').getFullList();
  const studentByRoll = new Map(currentStudents.map((s) => [s.roll_no, s]));

  // Define synthetic students list: 002 to 100
  const studentTargets = Array.from({ length: 99 }, (_, i) => {
    const num = String(i + 2).padStart(3, '0');
    return {
      roll_no: `BOT-STU-${num}`,
      name: `ZZ_TEST_STUDENT_${num}`,
    };
  });

  // Provision students
  let studentsCreated = 0;
  let studentsUpdated = 0;

  const provisionedStudents = await runWithConcurrency(studentTargets, 4, async (target) => {
    const existing = studentByRoll.get(target.roll_no);
    if (existing) {
      const pinVer = await verifyPinDual(DEFAULT_BOT_PIN, existing.pin_hash);
      const needsUpdate =
        !existing.active ||
        existing.name !== target.name ||
        !pinVer.valid ||
        pinVer.isTemporary ||
        isTemporaryPinHash(existing.pin_hash);

      if (needsUpdate) {
        const updated = await pb.collection('students').update(existing.id, {
          name: target.name,
          active: true,
          pin: '',
          pin_hash: studentPinHash,
        });
        studentsUpdated++;
        return updated;
      }
      return existing;
    } else {
      const created = await pb.collection('students').create({
        name: target.name,
        roll_no: target.roll_no,
        active: true,
        pin: '',
        pin_hash: studentPinHash,
      });
      studentsCreated++;
      return created;
    }
  });

  console.log(`  ✓ Students provisioned: ${studentsCreated} created, ${studentsUpdated} updated, ${provisionedStudents.length} total.`);

  // Step 4: Ensure Student Enrollments strictly in TEST_COURSE (batch: BOT-Sandbox)
  console.log('--- Step 4: Configuring Student Enrollments in TEST_COURSE ---');
  const allBotStudents = [stu1, ...provisionedStudents];
  const allEnrollments = await pb.collection('enrollments').getFullList();

  let enrollmentsCreated = 0;
  let enrollmentsPruned = 0;

  await runWithConcurrency(allBotStudents, 4, async (botStu) => {
    const studentEnrollments = allEnrollments.filter((e) => e.student === botStu.id);
    const inTestCourse = studentEnrollments.find((e) => e.course === TEST_COURSE_ID);

    if (!inTestCourse) {
      await pb.collection('enrollments').create({
        student: botStu.id,
        course: TEST_COURSE_ID,
        batch: SANDBOX_BATCH,
      });
      enrollmentsCreated++;
    } else if (inTestCourse.batch !== SANDBOX_BATCH) {
      await pb.collection('enrollments').update(inTestCourse.id, {
        batch: SANDBOX_BATCH,
      });
    }

    // Remove any unintended non-test course enrollments for this bot student
    for (const enr of studentEnrollments) {
      if (enr.course !== TEST_COURSE_ID) {
        await pb.collection('enrollments').delete(enr.id);
        enrollmentsPruned++;
      }
    }
  });

  console.log(`  ✓ Enrollments configured: ${enrollmentsCreated} created, ${enrollmentsPruned} pruned.`);

  // Step 5: Provision 14 Synthetic Teachers (BOT-TEA-002 through BOT-TEA-015)
  console.log('\n--- Step 5: Provisioning Synthetic Teachers (BOT-TEA-002..015) ---');
  const teacherPinHash = await hashPin(DEFAULT_BOT_PIN);

  // Fetch all existing teachers
  const currentTeachers = await pb.collection('teachers').getFullList();
  const teacherByPhone = new Map(currentTeachers.map((t) => [t.phone, t]));

  // Define synthetic teachers list: 002 to 015
  const teacherTargets = Array.from({ length: 14 }, (_, i) => {
    const num = String(i + 2).padStart(3, '0');
    return {
      phone: `BOT-TEA-${num}`,
      name: `ZZ_TEST_TEACHER_${num}`,
    };
  });

  let teachersCreated = 0;
  let teachersUpdated = 0;

  const provisionedTeachers = await runWithConcurrency(teacherTargets, 3, async (target) => {
    const existing = teacherByPhone.get(target.phone);
    if (existing) {
      const pinVer = await verifyPinDual(DEFAULT_BOT_PIN, existing.pin_hash);
      const needsUpdate =
        !existing.active ||
        existing.name !== target.name ||
        !pinVer.valid ||
        pinVer.isTemporary ||
        isTemporaryPinHash(existing.pin_hash);

      if (needsUpdate) {
        const updated = await pb.collection('teachers').update(existing.id, {
          name: target.name,
          active: true,
          pin: '',
          pin_hash: teacherPinHash,
        });
        teachersUpdated++;
        return updated;
      }
      return existing;
    } else {
      const created = await pb.collection('teachers').create({
        name: target.name,
        phone: target.phone,
        active: true,
        pin: '',
        pin_hash: teacherPinHash,
      });
      teachersCreated++;
      return created;
    }
  });

  console.log(`  ✓ Teachers provisioned: ${teachersCreated} created, ${teachersUpdated} updated, ${provisionedTeachers.length} total.`);

  // Step 6: Ensure Teacher Allocations strictly to Sandbox Subject
  console.log('--- Step 6: Configuring Teacher Allocations in Sandbox Subject ---');
  const allBotTeachers = [tea1, ...provisionedTeachers];
  const allTeacherSubjects = await pb.collection('teacher_subjects').getFullList();

  let allocationsCreated = 0;
  let allocationsPruned = 0;

  await runWithConcurrency(allBotTeachers, 3, async (botTea) => {
    const teacherSubjects = allTeacherSubjects.filter((ts) => ts.teacher === botTea.id);
    const hasSandboxSubject = teacherSubjects.some((ts) => ts.subject === SANDBOX_SUBJECT_ID);

    if (!hasSandboxSubject) {
      await pb.collection('teacher_subjects').create({
        teacher: botTea.id,
        subject: SANDBOX_SUBJECT_ID,
      });
      allocationsCreated++;
    }

    // Remove any unintended allocations to genuine subjects
    for (const ts of teacherSubjects) {
      if (ts.subject !== SANDBOX_SUBJECT_ID) {
        await pb.collection('teacher_subjects').delete(ts.id);
        allocationsPruned++;
      }
    }
  });

  console.log(`  ✓ Teacher allocations configured: ${allocationsCreated} created, ${allocationsPruned} pruned.`);

  // Step 7: Post-flight Invariant Check
  console.log('\n--- Step 7: Post-Flight Invariant Assertion ---');
  const postCheck = await verifyBaselineInvariants();
  console.log(`  ✓ Genuine Students: ${postCheck.details.genuineStudentsCount} (expected 75)`);
  console.log(`  ✓ Genuine Teachers: ${postCheck.details.genuineTeachersCount} (expected 8)`);
  console.log(`  ✓ Genuine Entries: ${postCheck.details.genuineEntriesCount} (expected 13)`);
  console.log(`  ✓ Total Live Students: ${postCheck.details.totalStudentsCount} (75 genuine + 100 bots)`);
  console.log(`  ✓ Total Live Teachers: ${postCheck.details.totalTeachersCount} (8 genuine + 15 bots)`);
  console.log(`  ✓ Total Live Entries: ${postCheck.details.totalEntriesCount}`);
  console.log('  ✅ Post-flight invariant assertion PASSED 100% — Zero genuine records touched.');

  console.log('\n================================================================');
  console.log('🎉 SYNTHETIC ACCOUNT SCAFFOLDING COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');

  return {
    studentsProvisioned: provisionedStudents.length,
    teachersProvisioned: provisionedTeachers.length,
    bot1Verification: {
      studentBotValid: stu1Verification.valid,
      teacherBotValid: tea1Verification.valid,
    },
  };
}

// Direct execution CLI entrypoint
if (require.main === module || process.argv[1]?.endsWith('scaffold-synthetic-accounts.ts')) {
  scaffoldSyntheticAccounts()
    .then((res) => {
      console.log('Result:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ FATAL SCAFFOLDING ERROR:', err);
      process.exit(1);
    });
}
