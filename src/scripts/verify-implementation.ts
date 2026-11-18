import { spawn, ChildProcess } from 'child_process';
import { getPbClient } from '../lib/pb';
import { hashPin, markHashAsTemporary } from '../lib/pin-hash';
import { signPayload } from '../lib/session';
import { changeStudentPinAction, updateTeacherPinAction } from '../app/actions/auth-actions';

const BASE_URL = 'http://127.0.0.1:3006';

interface TestStats {
  passed: number;
  failed: number;
  total: number;
}

const stats: TestStats = { passed: 0, failed: 0, total: 0 };

function assert(condition: boolean, desc: string, details?: any) {
  stats.total++;
  if (condition) {
    stats.passed++;
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    stats.failed++;
    console.error(`  ❌ [FAIL] ${desc}`);
    if (details) console.error('     Details:', details);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('🛡️  COMPREHENSIVE VERIFICATION & SECURITY ATTACK TEST SUITE');
  console.log('================================================================\n');

  const pb = await getPbClient();
  const createdTestIds: {
    students: string[];
    enrollments: string[];
    entries: string[];
  } = {
    students: [],
    enrollments: [],
    entries: [],
  };

  let serverProcess: ChildProcess | null = null;

  try {
    // -------------------------------------------------------------
    // Step 0: Pre-Flight Baseline Audit
    // -------------------------------------------------------------
    console.log('--- Step 0: Verifying Pre-Flight Baseline Records ---');
    const baselineStudents = await pb.collection('students').getFullList();
    const baselineTeachers = await pb.collection('teachers').getFullList();
    const baselineEntries = await pb.collection('entries').getFullList();

    assert(baselineStudents.length === 75, `Baseline genuine students count is 75 (found: ${baselineStudents.length})`);
    assert(baselineTeachers.length === 8, `Baseline genuine teachers count is 8 (found: ${baselineTeachers.length})`);
    assert(baselineEntries.length === 13, `Baseline genuine entries count is 13 (found: ${baselineEntries.length})`);

    const courses = await pb.collection('courses').getFullList();
    const ndaCourse = courses.find((c) => c.code === 'NDA');
    if (!ndaCourse) throw new Error('NDA course not found in database');

    const ndaSubjects = await pb.collection('subjects').getFullList({ filter: `course = "${ndaCourse.id}"` });
    const mathSubject = ndaSubjects.find((s) => s.name.includes('Math')) || ndaSubjects[0];
    if (!mathSubject) throw new Error('No subject found for NDA');

    const mathTopics = await pb.collection('topics').getFullList({ filter: `subject = "${mathSubject.id}"` });
    const testTopic = mathTopics[0];
    if (!testTopic) throw new Error('No topic found for NDA math subject');

    const teacherSubjects = await pb.collection('teacher_subjects').getFullList({ filter: `subject = "${mathSubject.id}"` });
    const testTeacherId = teacherSubjects[0]?.teacher || baselineTeachers[0].id;

    // -------------------------------------------------------------
    // Step 1: Provision Dedicated Test Accounts (A & B)
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Provisioning Dedicated Test Accounts ---');
    const rawTempPinA = '918273';
    const rawStrongPinB = '654321';

    const tempHashA = markHashAsTemporary(await hashPin(rawTempPinA));
    const regularHashB = await hashPin(rawStrongPinB);

    // Create Student A with temporary PIN marker ($temp)
    const testStudentA = await pb.collection('students').create({
      name: 'Test Cadet Alpha',
      roll_no: 'TEST-CADET-A',
      pin: '',
      pin_hash: tempHashA,
      active: true,
      email: 'test.alpha@example.test',
    });
    createdTestIds.students.push(testStudentA.id);
    console.log(`  ✓ Created Student A (ID: ${testStudentA.id}, Roll: TEST-CADET-A) with temporary PIN`);

    // Create Student B with standard personal PIN
    const testStudentB = await pb.collection('students').create({
      name: 'Test Cadet Beta',
      roll_no: 'TEST-CADET-B',
      pin: '',
      pin_hash: regularHashB,
      active: true,
      email: 'test.beta@example.test',
    });
    createdTestIds.students.push(testStudentB.id);
    console.log(`  ✓ Created Student B (ID: ${testStudentB.id}, Roll: TEST-CADET-B) with personal PIN`);

    // Enroll both students in NDA
    const enrollA = await pb.collection('enrollments').create({
      student: testStudentA.id,
      course: ndaCourse.id,
      status: 'active',
      start_date: '2026-01-01',
    });
    createdTestIds.enrollments.push(enrollA.id);

    const enrollB = await pb.collection('enrollments').create({
      student: testStudentB.id,
      course: ndaCourse.id,
      status: 'active',
      start_date: '2026-01-01',
    });
    createdTestIds.enrollments.push(enrollB.id);
    console.log('  ✓ Enrolled both test students in NDA course');

    // -------------------------------------------------------------
    // Step 2: Launch Local Production Next.js Server on Port 3006
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Spawning Next.js Standalone Server on Port 3006 ---');
    serverProcess = spawn('npx', ['next', 'start', '-p', '3006'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '3006', NODE_ENV: 'production' },
    });

    serverProcess.stdout?.on('data', (d) => {
      // debug logging suppressed
    });
    serverProcess.stderr?.on('data', (d) => {
      // debug logging suppressed
    });

    // Wait for server health endpoint
    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.status === 200) {
          serverReady = true;
          break;
        }
      } catch {
        // server still warming up
      }
    }
    assert(serverReady, 'Local Next.js production server started and responding on port 3006');
    if (!serverReady) throw new Error('Failed to start Next.js test server');

    // -------------------------------------------------------------
    // Step 3: Route Access Control & No-Store Caching Headers
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Route Access Control & Redirection Verification ---');

    // Unauthenticated GET /submit -> 307 to /student/login
    const unauthSubmit = await fetch(`${BASE_URL}/submit`, { redirect: 'manual' });
    assert(
      unauthSubmit.status === 307 && (unauthSubmit.headers.get('location') || '').includes('/student/login'),
      'Unauthenticated GET /submit redirects (307) to /student/login',
      { status: unauthSubmit.status, location: unauthSubmit.headers.get('location') }
    );

    // Unauthenticated GET /student -> 307 to /student/login
    const unauthStudent = await fetch(`${BASE_URL}/student`, { redirect: 'manual' });
    assert(
      unauthStudent.status === 307 && (unauthStudent.headers.get('location') || '').includes('/student/login'),
      'Unauthenticated GET /student redirects (307) to /student/login',
      { status: unauthStudent.status, location: unauthStudent.headers.get('location') }
    );

    // Unauthenticated GET /teacher -> 307 to /teacher/login
    const unauthTeacher = await fetch(`${BASE_URL}/teacher`, { redirect: 'manual' });
    assert(
      unauthTeacher.status === 307 && (unauthTeacher.headers.get('location') || '').includes('/teacher/login'),
      'Unauthenticated GET /teacher redirects (307) to /teacher/login',
      { status: unauthTeacher.status, location: unauthTeacher.headers.get('location') }
    );

    // Unauthenticated GET /admin -> 307 to /admin/login
    const unauthAdmin = await fetch(`${BASE_URL}/admin`, { redirect: 'manual' });
    assert(
      unauthAdmin.status === 307 && (unauthAdmin.headers.get('location') || '').includes('/admin/login'),
      'Unauthenticated GET /admin redirects (307) to /admin/login',
      { status: unauthAdmin.status, location: unauthAdmin.headers.get('location') }
    );

    // Unauthenticated GET /dashboard -> 307 to /teacher/login
    const unauthDash = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    assert(
      unauthDash.status === 307 && (unauthDash.headers.get('location') || '').includes('/teacher/login'),
      'Unauthenticated GET /dashboard redirects (307) to /teacher/login',
      { status: unauthDash.status, location: unauthDash.headers.get('location') }
    );

    // Verify Cache-Control: no-store on sensitive routes
    const routesToTestCache = ['/submit', '/student', '/teacher', '/admin', '/dashboard'];
    for (const route of routesToTestCache) {
      const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
      const cacheControl = res.headers.get('cache-control') || '';
      assert(
        cacheControl.includes('no-store'),
        `Cache-Control header on ${route} contains no-store (got: "${cacheControl}")`
      );
    }

    // -------------------------------------------------------------
    // Step 4: UI Sanitization & Homepage Verification
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Homepage & Student Portal CTA Verification ---');
    const homeRes = await fetch(`${BASE_URL}/`);
    const homeHtml = await homeRes.text();

    assert(
      homeHtml.includes('href="/student/login"'),
      'Homepage Student Portal CTA button explicitly links to /student/login'
    );
    assert(
      !homeHtml.includes('href="/submit"') && !homeHtml.includes('href="/student"'),
      'Homepage does NOT link directly to /student or /submit for students'
    );
    assert(
      !homeHtml.toLowerCase().includes('pocketbase') && !homeHtml.includes('3005'),
      'Homepage is sanitized of internal technical jargon ("pocketbase", "3005")'
    );

    // Student Login Page verification
    const studentLoginRes = await fetch(`${BASE_URL}/student/login`);
    const studentLoginHtml = await studentLoginRes.text();
    assert(studentLoginRes.status === 200, 'Student Login page returns HTTP 200');
    assert(
      studentLoginHtml.includes('Roll Number') || studentLoginHtml.includes('Student Profile'),
      'Student Login page renders student profile / roll input'
    );
    assert(
      !studentLoginHtml.includes('Director Master Password') && !studentLoginHtml.includes('Faculty Profile'),
      'Student Login page is strictly isolated from Admin and Teacher forms'
    );

    // -------------------------------------------------------------
    // Step 5: Backend Anti-Spoofing & Identity Locking (/api/submit)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Backend Anti-Spoofing & Tampering Tests ---');

    // Scenario 2: Unauthenticated POST /api/submit -> 401
    const unauthApiSubmit = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: ndaCourse.id,
        teacherId: testTeacherId,
        subjectId: mathSubject.id,
        topicId: testTopic.id,
        studentId: testStudentA.id,
        status: 'covered',
        deviceId: 'device-test-01',
      }),
    });
    assert(
      unauthApiSubmit.status === 401,
      `Unauthenticated POST /api/submit returns HTTP 401 Unauthorized (got: ${unauthApiSubmit.status})`
    );

    // Scenario 13: Temporary PIN blocking submission (mustChangePin: true)
    const tempPinSessionToken = signPayload({
      userId: testStudentA.id,
      role: 'student',
      name: testStudentA.name,
      studentId: testStudentA.id,
      createdAt: Date.now(),
      mustChangePin: true,
    });

    const tempPinSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `abg_auth_session=${tempPinSessionToken}`,
      },
      body: JSON.stringify({
        courseId: ndaCourse.id,
        teacherId: testTeacherId,
        subjectId: mathSubject.id,
        topicId: testTopic.id,
        studentId: testStudentA.id,
        status: 'covered',
        deviceId: 'device-test-01',
      }),
    });
    const tempPinSubmitBody = await tempPinSubmitRes.json();
    assert(
      tempPinSubmitRes.status === 403 && Boolean(tempPinSubmitBody.error?.includes('Mandatory PIN change')),
      `Student with mustChangePin: true is blocked from submitting with HTTP 403 (got: ${tempPinSubmitRes.status})`
    );

    // Legitimate active session for Student A (mustChangePin: false)
    const validStudentASession = signPayload({
      userId: testStudentA.id,
      role: 'student',
      name: testStudentA.name,
      studentId: testStudentA.id,
      createdAt: Date.now(),
      mustChangePin: false,
    });

    // Scenario 3: Identity Spoofing Attack A — Submitting Student B's record ID in body
    const spoofIdRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `abg_auth_session=${validStudentASession}`,
      },
      body: JSON.stringify({
        courseId: ndaCourse.id,
        teacherId: testTeacherId,
        subjectId: mathSubject.id,
        topicId: testTopic.id,
        studentId: testStudentB.id, // ATTACK: claimed student is B
        status: 'covered',
        deviceId: 'device-test-01',
      }),
    });
    const spoofIdBody = await spoofIdRes.json();
    assert(
      spoofIdRes.status === 403 && Boolean(spoofIdBody.error?.includes('Identity mismatch')),
      `Identity Spoofing Attempt 1 (submitting other student's PB ID) blocked with HTTP 403 (got: ${spoofIdRes.status})`
    );

    // Scenario 3: Identity Spoofing Attack B — Submitting Student B's roll number in body
    const spoofRollRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `abg_auth_session=${validStudentASession}`,
      },
      body: JSON.stringify({
        courseId: ndaCourse.id,
        teacherId: testTeacherId,
        subjectId: mathSubject.id,
        topicId: testTopic.id,
        studentId: 'TEST-CADET-B', // ATTACK: claimed roll is B
        status: 'covered',
        deviceId: 'device-test-01',
      }),
    });
    const spoofRollBody = await spoofRollRes.json();
    assert(
      spoofRollRes.status === 403 && Boolean(spoofRollBody.error?.includes('Identity mismatch')),
      `Identity Spoofing Attempt 2 (submitting other student's Roll No) blocked with HTTP 403 (got: ${spoofRollRes.status})`
    );

    // Scenario 3: Identity Spoofing Attack C — Submitting genuine student's ID (e.g. Mafruza Rahman)
    const genuineStudent = baselineStudents[0];
    const spoofGenuineRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `abg_auth_session=${validStudentASession}`,
      },
      body: JSON.stringify({
        courseId: ndaCourse.id,
        teacherId: testTeacherId,
        subjectId: mathSubject.id,
        topicId: testTopic.id,
        studentId: genuineStudent.id, // ATTACK: genuine student ID
        status: 'covered',
        deviceId: 'device-test-01',
      }),
    });
    const spoofGenuineBody = await spoofGenuineRes.json();
    assert(
      spoofGenuineRes.status === 403 && Boolean(spoofGenuineBody.error?.includes('Identity mismatch')),
      `Identity Spoofing Attempt 3 (submitting genuine student ID) blocked with HTTP 403 (got: ${spoofGenuineRes.status})`
    );

    // Scenario 4: Legitimate Submission by Student A (PIN omitted, studentId omitted or matching)
    const validSubmitRes = await fetch(`${BASE_URL}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `abg_auth_session=${validStudentASession}`,
      },
      body: JSON.stringify({
        courseId: ndaCourse.id,
        teacherId: testTeacherId,
        subjectId: mathSubject.id,
        topicId: testTopic.id,
        // studentId omitted: server resolves from session.studentId
        status: 'covered',
        deviceId: 'device-test-01',
      }),
    });
    const validSubmitBody = await validSubmitRes.json();
    assert(
      validSubmitRes.status === 200 && validSubmitBody.success === true && Boolean(validSubmitBody.fullId),
      `Legitimate student submission succeeds with HTTP 200 (created ID: ${validSubmitBody.fullId})`
    );
    if (validSubmitBody.fullId) {
      createdTestIds.entries.push(validSubmitBody.fullId);
    }

    // -------------------------------------------------------------
    // Step 6: Asymmetric PIN Policies (1 Temporary Change Only)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Asymmetric PIN Policy Verification ---');

    // First PIN change with temporary PIN -> MUST SUCCEED
    const firstChangeRes = await changeStudentPinAction(testStudentA.id, rawTempPinA, '837261');
    assert(
      firstChangeRes.success === true,
      'Student A successfully completes mandatory 1st PIN rotation with temporary PIN',
      firstChangeRes
    );

    // Verify in PB that pin_hash no longer ends with $temp
    const studentAPostFirstChange = await pb.collection('students').getOne(testStudentA.id);
    assert(
      !studentAPostFirstChange.pin_hash.endsWith('$temp'),
      'Student A pin_hash purged $temp marker after rotation'
    );

    // Second PIN change attempt -> MUST BE REJECTED (Asymmetric Policy)
    const secondChangeRes = await changeStudentPinAction(testStudentA.id, '837261', '948271');
    assert(
      secondChangeRes.success === false && Boolean(secondChangeRes.error?.includes('PIN change is not permitted')),
      'Student A second self-service PIN change attempt is rejected by asymmetric policy',
      secondChangeRes
    );

    // -------------------------------------------------------------
    // Step 7: Cross-Role Isolation & Session Integrity
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Cross-Role Boundary & Privilege Isolation ---');

    // Student session accessing /teacher -> 307 to /teacher/login
    const studentToTeacher = await fetch(`${BASE_URL}/teacher`, {
      headers: { Cookie: `abg_auth_session=${validStudentASession}` },
      redirect: 'manual',
    });
    assert(
      studentToTeacher.status === 307 && (studentToTeacher.headers.get('location') || '').includes('/teacher/login'),
      'Student session blocked from /teacher (HTTP 307 -> /teacher/login)'
    );

    // Student session accessing /admin -> 307 to /admin/login
    const studentToAdmin = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: `abg_auth_session=${validStudentASession}` },
      redirect: 'manual',
    });
    assert(
      studentToAdmin.status === 307 && (studentToAdmin.headers.get('location') || '').includes('/admin/login'),
      'Student session blocked from /admin (HTTP 307 -> /admin/login)'
    );

    // Faculty session accessing /admin -> 307 to /admin/login
    const facultySession = signPayload({
      userId: testTeacherId,
      role: 'faculty',
      name: 'Faculty Member',
      teacherId: testTeacherId,
      createdAt: Date.now(),
    });

    const teacherToAdmin = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: `abg_auth_session=${facultySession}` },
      redirect: 'manual',
    });
    assert(
      teacherToAdmin.status === 307 && (teacherToAdmin.headers.get('location') || '').includes('/admin/login'),
      'Teacher session blocked from /admin (HTTP 307 -> /admin/login)'
    );

    // Faculty session accessing /student -> 307 to /student/login
    const teacherToStudent = await fetch(`${BASE_URL}/student`, {
      headers: { Cookie: `abg_auth_session=${facultySession}` },
      redirect: 'manual',
    });
    assert(
      teacherToStudent.status === 307 && (teacherToStudent.headers.get('location') || '').includes('/student/login'),
      'Teacher session blocked from /student (HTTP 307 -> /student/login)'
    );

    // Faculty session accessing /dashboard -> HTTP 200 (Executive Dashboard)
    const teacherToDash = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: `abg_auth_session=${facultySession}` },
      redirect: 'manual',
    });
    assert(
      teacherToDash.status === 200,
      'Authorized Teacher session successfully accesses Executive Dashboard /dashboard (HTTP 200)'
    );

    const dashHtml = await teacherToDash.text();
    assert(
      dashHtml.includes('Academy Curriculum Matrix') || dashHtml.includes('Executive') || dashHtml.includes('Pacing'),
      'Executive Dashboard renders academy-wide curriculum coverage matrix'
    );
    assert(
      !dashHtml.includes('roll_no') && !dashHtml.includes('TEST-CADET-A') && !dashHtml.includes('Director Master Password'),
      'Executive Dashboard protects private student details and contains zero admin credentials'
    );

    // Admin session accessing /admin -> HTTP 200
    const adminSession = signPayload({
      userId: 'admin-director-id',
      role: 'admin',
      name: 'Director / Administrator',
      createdAt: Date.now(),
    });

    const adminAccessRes = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: `abg_auth_session=${adminSession}` },
      redirect: 'manual',
    });
    assert(
      adminAccessRes.status === 200,
      'Director/Admin session accesses /admin governance portal (HTTP 200)'
    );

    const adminHtml = await adminAccessRes.text();
    assert(
      adminHtml.includes('Student Oversight') || adminHtml.includes('PIN Management') || adminHtml.includes('Cadet Oversight'),
      'Administrator portal preserves complete administrative controls and Student Oversight'
    );
  } finally {
    // -------------------------------------------------------------
    // Step 8: Complete Cleanup & Baseline Restoration
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Teardown & Baseline Invariant Verification ---');

    // 1. Delete test entries explicitly, and check for any entries tied to test students
    for (const studentId of createdTestIds.students) {
      try {
        const studentEntries = await pb.collection('entries').getFullList({ filter: `student = "${studentId}"` });
        for (const ent of studentEntries) {
          if (!createdTestIds.entries.includes(ent.id)) {
            createdTestIds.entries.push(ent.id);
          }
        }
      } catch (err: any) {
        console.error(`  ✗ Error querying entries for student ${studentId}:`, err.message);
      }
    }

    for (const entryId of createdTestIds.entries) {
      try {
        await pb.collection('entries').delete(entryId);
        console.log(`  ✓ Cleaned up test entry: ${entryId}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to delete test entry ${entryId}:`, err.message);
      }
    }

    // 2. Delete test enrollments
    for (const enrollId of createdTestIds.enrollments) {
      try {
        await pb.collection('enrollments').delete(enrollId);
        console.log(`  ✓ Cleaned up test enrollment: ${enrollId}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to delete test enrollment ${enrollId}:`, err.message);
      }
    }

    // 3. Delete test students
    for (const studentId of createdTestIds.students) {
      try {
        await pb.collection('students').delete(studentId);
        console.log(`  ✓ Cleaned up test student: ${studentId}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to delete test student ${studentId}:`, err.message);
      }
    }

    // 4. Terminate test server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      console.log('  ✓ Terminated local test server on port 3006');
    }

    // 5. Final Invariant Verification
    const finalStudents = await pb.collection('students').getFullList();
    const finalTeachers = await pb.collection('teachers').getFullList();
    const finalEntries = await pb.collection('entries').getFullList();

    assert(
      finalStudents.length === 75,
      `Final student count is exactly 75 genuine students (found: ${finalStudents.length})`
    );
    assert(
      finalTeachers.length === 8,
      `Final teacher count is exactly 8 genuine teachers (found: ${finalTeachers.length})`
    );
    assert(
      finalEntries.length === 13,
      `Final entry count is exactly 13 genuine entries (found: ${finalEntries.length})`
    );

    // Verify key genuine entries are intact
    const genuineMafruza = await pb.collection('entries').getOne('7lhmo4p1mzkw9w2', { expand: 'student' });
    assert(
      genuineMafruza.status === 'covered' && (genuineMafruza.expand as any)?.student?.name === 'Mafruza Rahman',
      'Genuine submission by Mafruza Rahman is 100% intact'
    );

    const genuineSangey = await pb.collection('entries').getOne('pogx003bic5x4pi');
    assert(
      genuineSangey.review_status === 'CLEARED' && genuineSangey.status === 'covered',
      'Genuine submission by Sangey Lhamunamsa is 100% intact'
    );

    console.log('\n================================================================');
    console.log(`📊 TEST RESULTS: ${stats.passed}/${stats.total} PASSED (${stats.failed} FAILED)`);
    console.log('================================================================');

    if (stats.failed > 0) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
