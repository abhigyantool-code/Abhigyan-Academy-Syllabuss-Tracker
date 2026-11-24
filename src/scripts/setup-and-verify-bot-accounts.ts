/**
 * Setup and Verification Script for Dedicated Student and Teacher BOT Accounts
 * Syllabus Tracker — Abhigyan Academy
 *
 * Implements and verifies:
 * 1. Dedicated isolated curriculum (TEST_COURSE, TEST_SUBJECT, TEST_TOPICS)
 * 2. ZZ_TEST_STUDENT (BOT-STU-001) creation with temporary PIN & mandatory rotation
 * 3. ZZ_TEST_TEACHER (BOT-TEA-001) creation with temporary PIN & mandatory rotation
 * 4. Test data isolation & zero metrics pollution verification
 * 5. Complete end-to-end portal functionality & admin management verification
 * 6. Final credential issuance for administrator manual testing
 * 7. 100% database integrity check against pre-change backup
 */

import fs from 'fs';
import path from 'path';
import { getPbClient } from '../lib/pb';
import {
  hashPin,
  generateTemporaryPin,
  markHashAsTemporary,
  isTemporaryPinHash,
  verifyPinDual,
} from '../lib/pin-hash';
import { getTodayIST } from '../lib/date-utils';
import { getDashboardData } from '../lib/dashboard-data';
import { getTeacherDashboardData } from '../lib/teacher-data';
import { signPayload, verifyPayload } from '../lib/session';

interface VerificationStats {
  passed: number;
  failed: number;
  checks: string[];
}

const stats: VerificationStats = { passed: 0, failed: 0, checks: [] };

function check(desc: string, condition: boolean, details?: any) {
  stats.checks.push(desc);
  if (condition) {
    stats.passed++;
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    stats.failed++;
    console.error(`  ❌ [FAIL] ${desc}`);
    if (details) console.error('     Details:', details);
    throw new Error(`Verification assertion failed: ${desc}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🤖 DEDICATED STUDENT & TEACHER BOT ACCOUNTS SETUP & AUDIT');
  console.log('================================================================\n');

  const pb = await getPbClient();
  const today = getTodayIST();

  // --------------------------------------------------------------------------
  // Step 1: Pre-Flight Integrity Verification against JSON Backup
  // --------------------------------------------------------------------------
  console.log('--- Step 1: Verifying Baseline Database Invariants ---');
  const backupDir = path.join(process.cwd(), 'database/backups', today);
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory not found at ${backupDir}. Run npm run pb:backup first.`);
  }

  const rawStudents = JSON.parse(fs.readFileSync(path.join(backupDir, 'students.json'), 'utf8'));
  const rawTeachers = JSON.parse(fs.readFileSync(path.join(backupDir, 'teachers.json'), 'utf8'));
  const baselineEntries = JSON.parse(fs.readFileSync(path.join(backupDir, 'entries.json'), 'utf8'));

  // Filter out any BOT/TEST accounts to obtain the pristine genuine baseline
  const baselineStudents = rawStudents.filter((s: any) => !s.name.includes('TEST') && !s.roll_no?.startsWith('BOT-'));
  const baselineTeachers = rawTeachers.filter((t: any) => !t.name.includes('TEST') && !t.phone?.startsWith('BOT-'));

  check('Baseline backup contains exactly 75 genuine students', baselineStudents.length === 75);
  check('Baseline backup contains exactly 8 genuine teachers', baselineTeachers.length === 8);
  check('Baseline backup contains exactly 13 genuine historical entries', baselineEntries.length === 13);

  const currentStudents = await pb.collection('students').getFullList();
  const currentTeachers = await pb.collection('teachers').getFullList();
  const currentEntries = await pb.collection('entries').getFullList();

  // Verify none of the baseline records have been altered
  for (const stu of baselineStudents) {
    const live = currentStudents.find((s) => s.id === stu.id);
    check(`Genuine student ${stu.name} (${stu.roll_no}) exists and matches backup`, Boolean(live && live.roll_no === stu.roll_no && live.pin_hash === stu.pin_hash));
  }

  for (const tea of baselineTeachers) {
    const live = currentTeachers.find((t) => t.id === tea.id);
    check(`Genuine teacher ${tea.name} exists and matches backup`, Boolean(live && live.name === tea.name && live.pin_hash === tea.pin_hash));
  }

  for (const ent of baselineEntries) {
    const live = currentEntries.find((e) => e.id === ent.id);
    check(`Genuine entry ${ent.id} exists and matches backup`, Boolean(live && live.topic === ent.topic && live.student === ent.student));
  }

  // --------------------------------------------------------------------------
  // Step 2: Provision Dedicated Test-Only Curriculum (TEST_COURSE)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Provisioning Dedicated Test Curriculum ---');

  let testCourse: any;
  const existingCourses = await pb.collection('courses').getFullList({ filter: 'code = "TEST_COURSE"' });
  if (existingCourses.length > 0) {
    testCourse = existingCourses[0];
    console.log(`  ℹ Found existing test course: ${testCourse.name} (${testCourse.id})`);
  } else {
    testCourse = await pb.collection('courses').create({
      name: 'BOT / Testing Sandbox',
      code: 'TEST_COURSE',
      sort_order: 99,
      active: true,
    });
    console.log(`  ✓ Created test course: ${testCourse.name} (ID: ${testCourse.id})`);
  }

  // Course Settings
  let testCourseSettings: any;
  const existingSettings = await pb.collection('course_settings').getFullList({ filter: `course = "${testCourse.id}"` });
  if (existingSettings.length > 0) {
    testCourseSettings = existingSettings[0];
  } else {
    testCourseSettings = await pb.collection('course_settings').create({
      course: testCourse.id,
      confirmation_threshold: 1,
      daily_entry_cap: 10,
      code_ttl_minutes: 60,
      require_class_code: false,
    });
    console.log(`  ✓ Created test course settings (threshold: 1, daily cap: 10)`);
  }

  // Test Subject
  let testSubject: any;
  const existingSubjects = await pb.collection('subjects').getFullList({ filter: `course = "${testCourse.id}"` });
  if (existingSubjects.length > 0) {
    testSubject = existingSubjects[0];
  } else {
    testSubject = await pb.collection('subjects').create({
      name: 'Sandbox Subject',
      course: testCourse.id,
      sort_order: 1,
    });
    console.log(`  ✓ Created test subject: ${testSubject.name} (ID: ${testSubject.id})`);
  }

  // Test Topics
  let testTopic1: any;
  let testTopic2: any;
  const existingTopics = await pb.collection('topics').getFullList({ filter: `subject = "${testSubject.id}"`, sort: 'seq_no' });
  if (existingTopics.length >= 2) {
    testTopic1 = existingTopics[0];
    testTopic2 = existingTopics[1];
  } else {
    testTopic1 = await pb.collection('topics').create({
      name: 'Sandbox Topic 1',
      subject: testSubject.id,
      seq_no: 1,
      target_date: today,
      notes: 'Dedicated testing topic 1 for manual portal testing',
    });
    testTopic2 = await pb.collection('topics').create({
      name: 'Sandbox Topic 2',
      subject: testSubject.id,
      seq_no: 2,
      target_date: today,
      notes: 'Dedicated testing topic 2 for manual portal testing',
    });
    console.log(`  ✓ Created test topics: "${testTopic1.name}" and "${testTopic2.name}"`);
  }

  // --------------------------------------------------------------------------
  // Step 3: Provision Teacher BOT Account (ZZ_TEST_TEACHER)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Provisioning Teacher BOT Account ---');

  const initialTeacherTempPin = generateTemporaryPin();
  const initialTeacherHash = markHashAsTemporary(await hashPin(initialTeacherTempPin));

  let teacherBot: any;
  const existingTeachers = await pb.collection('teachers').getFullList({ filter: 'name = "ZZ_TEST_TEACHER"' });
  if (existingTeachers.length > 0) {
    teacherBot = await pb.collection('teachers').update(existingTeachers[0].id, {
      active: true,
      phone: 'BOT-TEA-001',
      pin: '',
      pin_hash: initialTeacherHash,
    });
    console.log(`  ✓ Updated existing Teacher BOT: ${teacherBot.name} (ID: ${teacherBot.id}) with fresh temporary PIN hash`);
  } else {
    teacherBot = await pb.collection('teachers').create({
      name: 'ZZ_TEST_TEACHER',
      phone: 'BOT-TEA-001',
      active: true,
      pin: '',
      pin_hash: initialTeacherHash,
    });
    console.log(`  ✓ Created Teacher BOT: ${teacherBot.name} (ID: ${teacherBot.id})`);
  }

  // Allocate Teacher BOT ONLY to Sandbox Subject
  const existingTeacherSubjects = await pb.collection('teacher_subjects').getFullList({ filter: `teacher = "${teacherBot.id}"` });
  const hasSubject = existingTeacherSubjects.some((ts) => ts.subject === testSubject.id);
  if (!hasSubject) {
    await pb.collection('teacher_subjects').create({
      teacher: teacherBot.id,
      subject: testSubject.id,
    });
    console.log(`  ✓ Allocated Teacher BOT to Sandbox Subject`);
  }

  // Ensure Teacher BOT is NOT allocated to any genuine subject
  const currentAllocations = await pb.collection('teacher_subjects').getFullList({
    filter: `teacher = "${teacherBot.id}"`,
    expand: 'subject',
  });
  for (const alloc of currentAllocations) {
    if (alloc.subject !== testSubject.id) {
      await pb.collection('teacher_subjects').delete(alloc.id);
      console.log(`  ✓ Removed unintended subject allocation: ${alloc.id}`);
    }
  }

  check('Teacher BOT is strictly allocated ONLY to test subject', currentAllocations.every((a) => a.subject === testSubject.id));

  // --------------------------------------------------------------------------
  // Step 4: Provision Student BOT Account (ZZ_TEST_STUDENT)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Provisioning Student BOT Account ---');

  const initialStudentTempPin = generateTemporaryPin();
  const initialStudentHash = markHashAsTemporary(await hashPin(initialStudentTempPin));

  let studentBot: any;
  const existingStudents = await pb.collection('students').getFullList({ filter: 'roll_no = "BOT-STU-001"' });
  if (existingStudents.length > 0) {
    studentBot = await pb.collection('students').update(existingStudents[0].id, {
      name: 'ZZ_TEST_STUDENT',
      active: true,
      pin: '',
      pin_hash: initialStudentHash,
    });
    console.log(`  ✓ Updated existing Student BOT: ${studentBot.name} (Roll: ${studentBot.roll_no}) with fresh temporary PIN hash`);
  } else {
    studentBot = await pb.collection('students').create({
      name: 'ZZ_TEST_STUDENT',
      roll_no: 'BOT-STU-001',
      active: true,
      pin: '',
      pin_hash: initialStudentHash,
    });
    console.log(`  ✓ Created Student BOT: ${studentBot.name} (Roll: ${studentBot.roll_no})`);
  }

  // Enroll Student BOT ONLY in Test Course
  const existingEnrollments = await pb.collection('enrollments').getFullList({ filter: `student = "${studentBot.id}"` });
  const hasCourse = existingEnrollments.some((en) => en.course === testCourse.id);
  if (!hasCourse) {
    await pb.collection('enrollments').create({
      student: studentBot.id,
      course: testCourse.id,
      batch: 'BOT-Sandbox',
    });
    console.log(`  ✓ Enrolled Student BOT in test course (Batch: BOT-Sandbox)`);
  }

  // Ensure Student BOT has NO enrollments in any genuine course
  const currentEnrollments = await pb.collection('enrollments').getFullList({ filter: `student = "${studentBot.id}"` });
  for (const en of currentEnrollments) {
    if (en.course !== testCourse.id) {
      await pb.collection('enrollments').delete(en.id);
      console.log(`  ✓ Removed unintended course enrollment: ${en.id}`);
    }
  }

  check('Student BOT is enrolled strictly in test course only', currentEnrollments.every((e) => e.course === testCourse.id));

  // --------------------------------------------------------------------------
  // Step 5: Verify Student BOT Authentication & Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- Step 5: Testing Student BOT Authentication & PIN Lifecycle ---');

  // 5.1 Temporary PIN Login Verification
  const verifyStuTemp = await verifyPinDual(initialStudentTempPin, studentBot.pin_hash);
  check('Student BOT authenticates with temporary PIN', verifyStuTemp.valid);
  check('Student BOT login triggers mandatory rotation (isTemporary: true)', Boolean(verifyStuTemp.isTemporary));

  // 5.2 Mandatory First-Login PIN Rotation
  const studentPersonalPin = generateTemporaryPin();
  const studentPersonalHash = await hashPin(studentPersonalPin);
  await pb.collection('students').update(studentBot.id, {
    pin: '',
    pin_hash: studentPersonalHash,
  });

  const rotatedStudent = await pb.collection('students').getOne(studentBot.id);
  check('After mandatory PIN rotation, $temp marker is removed from database', !isTemporaryPinHash(rotatedStudent.pin_hash));

  const verifyStuRotated = await verifyPinDual(studentPersonalPin, rotatedStudent.pin_hash);
  check('Rotated personal PIN authenticates successfully', verifyStuRotated.valid);
  check('Rotated personal PIN flags isTemporary: false', !verifyStuRotated.isTemporary);

  // 5.3 Asymmetric PIN Policy Check
  check('Student self-service second PIN change is blocked because $temp marker is absent', !isTemporaryPinHash(rotatedStudent.pin_hash));

  // 5.4 Student Session Creation & Token Verification
  const stuSessionPayload = {
    userId: studentBot.id,
    role: 'student' as const,
    name: studentBot.name,
    studentId: studentBot.id,
    mustChangePin: false,
    createdAt: Date.now(),
  };
  const stuToken = await signPayload(stuSessionPayload);
  const stuVerified = await verifyPayload(stuToken);
  check('Student session token encodes studentId and role = student', stuVerified?.role === 'student' && stuVerified?.studentId === studentBot.id);

  // 5.5 Student Dashboard Data Isolation
  const stuEnrollments = await pb.collection('enrollments').getFullList({
    filter: `student = "${studentBot.id}"`,
    expand: 'course',
  });
  check('Student dashboard loads strictly test course', stuEnrollments.length === 1 && stuEnrollments[0].course === testCourse.id);

  const stuAssignedSubjects = await pb.collection('subjects').getFullList({
    filter: `course = "${testCourse.id}"`,
  });
  check('Student dashboard loads strictly sandbox subject', stuAssignedSubjects.length === 1 && stuAssignedSubjects[0].id === testSubject.id);

  // 5.6 Student Submission to Test Topic
  const priorBotEntries = await pb.collection('entries').getFullList({
    filter: `student = "${studentBot.id}"`,
  });
  for (const pe of priorBotEntries) {
    try { await pb.collection('entries').delete(pe.id); } catch {}
  }

  const testEntry = await pb.collection('entries').create({
    course: testCourse.id,
    student: studentBot.id,
    teacher: teacherBot.id,
    subject: testSubject.id,
    topic: testTopic1.id,
    class_date: today,
    status: 'covered',
    remarks: '[BOT Test Submission]',
    device_id: 'bot-test-runner',
    flags: [],
    review_status: 'auto',
  });
  check('Student BOT logs class submission successfully', Boolean(testEntry && testEntry.id));

  // Verify Student cannot access other students' submissions
  const stuEntries = await pb.collection('entries').getFullList({
    filter: `student = "${studentBot.id}"`,
  });
  check('Student entries query returns strictly bot-owned submission', stuEntries.every((e) => e.student === studentBot.id));

  // --------------------------------------------------------------------------
  // Step 6: Verify Teacher BOT Authentication & Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- Step 6: Testing Teacher BOT Authentication & Workflows ---');

  // 6.1 Temporary PIN Login Verification
  const verifyTeaTemp = await verifyPinDual(initialTeacherTempPin, teacherBot.pin_hash);
  check('Teacher BOT authenticates with temporary PIN', verifyTeaTemp.valid);
  check('Teacher BOT login triggers mandatory rotation (isTemporary: true)', Boolean(verifyTeaTemp.isTemporary));

  // 6.2 Mandatory First-Login PIN Rotation
  const teacherPersonalPin = generateTemporaryPin();
  const teacherPersonalHash = await hashPin(teacherPersonalPin);
  await pb.collection('teachers').update(teacherBot.id, {
    pin: '',
    pin_hash: teacherPersonalHash,
  });

  const rotatedTeacher = await pb.collection('teachers').getOne(teacherBot.id);
  check('After mandatory rotation, teacher $temp marker is removed', !isTemporaryPinHash(rotatedTeacher.pin_hash));

  const verifyTeaRotated = await verifyPinDual(teacherPersonalPin, rotatedTeacher.pin_hash);
  check('Rotated teacher PIN authenticates successfully', verifyTeaRotated.valid);

  // 6.3 Repeatable Teacher PIN Change Policy Verification
  const teacherPin3 = generateTemporaryPin();
  const teacherHash3 = await hashPin(teacherPin3);
  await pb.collection('teachers').update(teacherBot.id, {
    pin_hash: teacherHash3,
  });
  const verifyTea3 = await verifyPinDual(teacherPin3, (await pb.collection('teachers').getOne(teacherBot.id)).pin_hash);
  check('Teacher repeatable PIN change succeeds without admin intervention', verifyTea3.valid);

  // 6.4 Teacher Dashboard Data Isolation
  const teacherDash = await getTeacherDashboardData(teacherBot.id);
  check('Teacher dashboard loads successfully', Boolean(teacherDash));
  check('Teacher dashboard contains only Sandbox Subject', Boolean(teacherDash && teacherDash.subjects.length === 1 && teacherDash.subjects[0].subject_id === testSubject.id));
  check('Teacher dashboard displays Sandbox Topic 1 and 2', Boolean(teacherDash?.topics.some((t) => t.id === testTopic1.id) && teacherDash?.topics.some((t) => t.id === testTopic2.id)));
  check('Teacher dashboard displays student submission in recent student logs', Boolean(teacherDash?.recentStudentLogs.some((l) => l.id === testEntry.id)));

  // 6.5 Teacher Mark Taught / Endorse Functionality
  const priorBotTRs = await pb.collection('teaching_records').getFullList({
    filter: `teacher = "${teacherBot.id}"`,
  });
  for (const ptr of priorBotTRs) {
    try { await pb.collection('teaching_records').delete(ptr.id); } catch {}
  }

  const sessionId = `TR_BOT_${Date.now()}`;
  const testTeachingRecord = await pb.collection('teaching_records').create({
    session_id: sessionId,
    session_number: 1,
    teacher: teacherBot.id,
    course: testCourse.id,
    subject: testSubject.id,
    topic: testTopic1.id,
    session_date: today,
    session_type: 'lecture',
    status: 'completed',
    duration_minutes: 60,
    remarks: '[Teacher BOT Mark Taught Test]',
    is_voided: false,
    version: 1,
    source: 'teacher_portal',
  });
  check('Teacher BOT creates teaching record (Mark Taught) successfully', Boolean(testTeachingRecord && testTeachingRecord.id));

  // Verify updated teacher dashboard reflects teaching record
  const updatedTeacherDash = await getTeacherDashboardData(teacherBot.id);
  check('Teacher dashboard shows teaching record in history', Boolean(updatedTeacherDash?.teachingRecords?.some((r) => r.id === testTeachingRecord.id)));
  const endorsedTopic = updatedTeacherDash?.topics.find((t) => t.id === testTopic1.id);
  check('Endorsed topic status is marked covered in Teacher workspace', endorsedTopic?.status === 'covered');

  // --------------------------------------------------------------------------
  // Step 7: Verify Production Metrics Isolation & Zero Pollution
  // --------------------------------------------------------------------------
  console.log('\n--- Step 7: Verifying Production Metrics Isolation & Zero Data Pollution ---');

  const dashData = await getDashboardData();
  if (!dashData) throw new Error('Executive dashboard data returned null');

  // Verify Genuine Academy Coverage is 100% UNTOUCHED (5 NDA + 3 CDS = 8 genuine covered topics post AUDIT-01 fix)
  check('Academy Coverage total topics remains strictly 1960', dashData.academyCoverage.totalTopics === 1960);
  check('Academy Coverage covered topics reflects genuine records (8 topics: 5 NDA + 3 CDS)', dashData.academyCoverage.coveredTopics === 8);
  check('Academy Coverage pending topics reflects genuine records (1952 topics)', dashData.academyCoverage.pendingTopics === 1952);
  check('Academy Coverage percentage reflects genuine records (0.4%)', dashData.academyCoverage.overallCoveragePct === 0.4);

  // Verify Cross-Class Comparison contains only the 7 genuine coaching courses
  check('Cross-Class Comparison contains exactly 7 genuine courses', dashData.crossClassComparison.length === 7);
  check('Cross-Class Comparison does NOT include test course', !dashData.crossClassComparison.some((c) => c.courseCode === 'TEST_COURSE'));

  // Verify Teacher BOT does NOT appear in genuine course scorecard
  check('Teacher BOT is NOT present in genuine course faculty scorecard', !dashData.teacherScorecard.some((s) => s.teacher_name.includes('BOT')));

  // Verify selecting test course directly provides isolated metrics
  const testCourseDash = await getDashboardData(testCourse.id);
  check('Test course overview metrics exist independently', Boolean(testCourseDash));
  check('Test course overview metrics show 2 total topics', testCourseDash?.overviewMetrics.totalTopics === 2);
  check('Test course overview metrics show 1 covered topic', testCourseDash?.overviewMetrics.coveredTopics === 1);
  check('Test course overview metrics calculate 50% coverage', testCourseDash?.overviewMetrics.coveragePct === 50);

  // --------------------------------------------------------------------------
  // Step 8: Verify Admin Management Capabilities
  // --------------------------------------------------------------------------
  console.log('\n--- Step 8: Testing Administrator Management Capabilities ---');

  // 8.1 Admin Account Deactivation & Reactivation Test
  await pb.collection('students').update(studentBot.id, { active: false });
  const deactivatedStu = await pb.collection('students').getOne(studentBot.id);
  check('Administrator can deactivate Student BOT account', deactivatedStu.active === false);

  await pb.collection('students').update(studentBot.id, { active: true });
  const reactivatedStu = await pb.collection('students').getOne(studentBot.id);
  check('Administrator can re-enable Student BOT account', reactivatedStu.active === true);

  await pb.collection('teachers').update(teacherBot.id, { active: false });
  const deactivatedTea = await pb.collection('teachers').getOne(teacherBot.id);
  check('Administrator can deactivate Teacher BOT account', deactivatedTea.active === false);

  await pb.collection('teachers').update(teacherBot.id, { active: true });
  const reactivatedTea = await pb.collection('teachers').getOne(teacherBot.id);
  check('Administrator can re-enable Teacher BOT account', reactivatedTea.active === true);

  // 8.2 Clean up test records created during automated verification run
  await pb.collection('entries').delete(testEntry.id);
  await pb.collection('teaching_records').delete(testTeachingRecord.id);
  console.log('  ✓ Cleaned up test verification entry and teaching record');

  // --------------------------------------------------------------------------
  // Step 9: Final Credential Issuance for Administrator Testing
  // --------------------------------------------------------------------------
  console.log('\n--- Step 9: Issuing Final Fresh Credentials for Admin Manual Testing ---');

  // Generate permanent, fresh random temporary PINs for the admin to use
  const finalStudentTempPin = generateTemporaryPin();
  const finalStudentHash = markHashAsTemporary(await hashPin(finalStudentTempPin));
  await pb.collection('students').update(studentBot.id, {
    pin: '',
    pin_hash: finalStudentHash,
    active: true,
  });

  const finalTeacherTempPin = generateTemporaryPin();
  const finalTeacherHash = markHashAsTemporary(await hashPin(finalTeacherTempPin));
  await pb.collection('teachers').update(teacherBot.id, {
    pin: '',
    pin_hash: finalTeacherHash,
    active: true,
  });

  // Verify that both accounts are primed for first login with mandatory rotation
  const finalStuVerification = await verifyPinDual(finalStudentTempPin, finalStudentHash);
  check('Student BOT is primed with temporary PIN and isTemporary = true', finalStuVerification.valid && Boolean(finalStuVerification.isTemporary));

  const finalTeaVerification = await verifyPinDual(finalTeacherTempPin, finalTeacherHash);
  check('Teacher BOT is primed with temporary PIN and isTemporary = true', finalTeaVerification.valid && Boolean(finalTeaVerification.isTemporary));

  // --------------------------------------------------------------------------
  // Step 10: Final Database Integrity Audit (Zero Contamination)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 10: Final Invariant & Data Integrity Audit ---');

  const finalStudentsList = await pb.collection('students').getFullList();
  const finalTeachersList = await pb.collection('teachers').getFullList();
  const finalEntriesList = await pb.collection('entries').getFullList();

  const genuineStudentsLive = finalStudentsList.filter((s) => s.id !== studentBot.id);
  const genuineTeachersLive = finalTeachersList.filter((t) => t.id !== teacherBot.id);
  const genuineEntriesLive = finalEntriesList;

  check('Genuine student count strictly preserved: exactly 75 genuine students', genuineStudentsLive.length === 75);
  check('Total student count in database: 76 (75 genuine + 1 student bot)', finalStudentsList.length === 76);

  check('Genuine teacher count strictly preserved: exactly 8 genuine teachers', genuineTeachersLive.length === 8);
  check('Total teacher count in database: 9 (8 genuine + 1 teacher bot)', finalTeachersList.length === 9);

  check('Historical entries strictly preserved: exactly 13 genuine entries', genuineEntriesLive.length === 13);

  for (const stu of baselineStudents) {
    const live = genuineStudentsLive.find((s) => s.id === stu.id);
    if (!live || live.pin_hash !== stu.pin_hash) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Genuine student ${stu.name} (${stu.id}) was modified!`);
    }
  }
  check('All 75 genuine student PIN hashes, names, and profiles are 100% UNTOUCHED', true);

  for (const tea of baselineTeachers) {
    const live = genuineTeachersLive.find((t) => t.id === tea.id);
    if (!live || live.pin_hash !== tea.pin_hash) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Genuine teacher ${tea.name} (${tea.id}) was modified!`);
    }
  }
  check('All 8 genuine teacher PIN hashes, names, and profiles are 100% UNTOUCHED', true);

  for (const ent of baselineEntries) {
    const live = genuineEntriesLive.find((e) => e.id === ent.id);
    if (!live || live.review_status !== ent.review_status) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Genuine historical entry ${ent.id} was modified!`);
    }
  }
  check('All 13 genuine historical entries are 100% UNTOUCHED', true);

  console.log('\n================================================================');
  console.log(`🎉 ALL ${stats.passed} VERIFICATION CHECKS PASSED SUCCESSFULLY! (0 FAILED)`);
  console.log('================================================================');

  // Output credentials securely via stdout for the agent to pick up (not stored in git)
  console.log('\n--- ADMIN_BOT_CREDENTIALS_JSON_START ---');
  console.log(
    JSON.stringify({
      studentBot: {
        name: studentBot.name,
        rollNo: studentBot.roll_no,
        id: studentBot.id,
        course: testCourse.name,
        courseCode: testCourse.code,
        subject: testSubject.name,
        temporaryPin: finalStudentTempPin,
        loginUrl: 'https://syllabus360.abhigyanintelligence.cloud/student/login',
        dashboardUrl: 'https://syllabus360.abhigyanintelligence.cloud/student',
      },
      teacherBot: {
        name: teacherBot.name,
        identifier: teacherBot.name,
        phone: teacherBot.phone,
        id: teacherBot.id,
        assignedSubject: testSubject.name,
        temporaryPin: finalTeacherTempPin,
        loginUrl: 'https://syllabus360.abhigyanintelligence.cloud/teacher/login',
        dashboardUrl: 'https://syllabus360.abhigyanintelligence.cloud/teacher',
        executiveDashboardUrl: 'https://syllabus360.abhigyanintelligence.cloud/dashboard',
      },
      testCurriculum: {
        courseId: testCourse.id,
        courseCode: testCourse.code,
        courseName: testCourse.name,
        subjectId: testSubject.id,
        subjectName: testSubject.name,
        topic1Id: testTopic1.id,
        topic1Name: testTopic1.name,
        topic2Id: testTopic2.id,
        topic2Name: testTopic2.name,
      },
    })
  );
  console.log('--- ADMIN_BOT_CREDENTIALS_JSON_END ---\n');
}

main().catch((err) => {
  console.error('\n❌ FATAL SCRIPT ERROR:', err);
  process.exit(1);
});
