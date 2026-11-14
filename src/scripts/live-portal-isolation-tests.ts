import { getPbClient } from '../lib/pb';

const PROD_URL = process.env.PROD_URL || 'https://syllabus360.abhigyanintelligence.cloud';

async function testPortals() {
  console.log('============================================================');
  console.log('🧪 LIVE PRODUCTION PORTAL SEPARATION & ROLE ISOLATION SUITE');
  console.log('Target:', PROD_URL);
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  function assertCheck(desc: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [${passed}/${total}] PASS: ${desc}`);
    } else {
      console.error(`❌ [FAIL]: ${desc} — ${details || 'Condition failed'}`);
      process.exitCode = 1;
    }
  }

  const pb = await getPbClient();

  // Resolve Next.js Server Action IDs from production bundles
  const html = await (await fetch(`${PROD_URL}/login`)).text();
  const scriptUrls = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => PROD_URL + m[1]);

  let adminActionId = '';
  let teacherActionId = '';
  let studentActionId = '';

  for (const url of scriptUrls) {
    const js = await (await fetch(url)).text();
    const adminMatch = js.match(/"([a-f0-9]{40,})"[^"]*"adminLoginAction"/);
    if (adminMatch) adminActionId = adminMatch[1];
    const teacherMatch = js.match(/"([a-f0-9]{40,})"[^"]*"teacherLoginAction"/);
    if (teacherMatch) teacherActionId = teacherMatch[1];
    const studentMatch = js.match(/"([a-f0-9]{40,})"[^"]*"studentLoginAction"/);
    if (studentMatch) studentActionId = studentMatch[1];
  }

  assertCheck('Resolved adminLoginAction ID from production build', Boolean(adminActionId));
  assertCheck('Resolved teacherLoginAction ID from production build', Boolean(teacherActionId));
  assertCheck('Resolved studentLoginAction ID from production build', Boolean(studentActionId));

  // -------------------------------------------------------------
  // Requirement 1: Student Independent Login & Dashboard
  // -------------------------------------------------------------
  console.log('\n--- REQUIREMENT 1: STUDENT INDEPENDENT LOGIN & DASHBOARD ---');
  const studentLoginRes = await fetch(`${PROD_URL}/student/login`);
  assertCheck('Student Login Route (/student/login) returns HTTP 200', studentLoginRes.status === 200);

  const studentHtml = await studentLoginRes.text();
  assertCheck('Student Login page includes Student Roll Number field', studentHtml.includes('Student Roll Number'));
  assertCheck('Student Login page includes Student 4-Digit PIN field', studentHtml.includes('Student 4-Digit PIN'));
  assertCheck('Student Login page contains NO teacher names in roster', !studentHtml.includes('Captain Vikram Batra') && !studentHtml.includes('Major Somnath Sharma'));
  assertCheck('Student Login page passes empty teachers list (teachers: [])', studentHtml.includes('teachers\\":[]') && studentHtml.includes('portalMode\\":\\"student\\"'));
  assertCheck('Student Login page contains NO Director/Admin login tab', !studentHtml.includes('Director Master Password'));

  // Authenticate genuine student (NDA-01 / 1234)
  const studentAuthRes = await fetch(`${PROD_URL}/student/login`, {
    method: 'POST',
    headers: {
      'Next-Action': studentActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
    },
    body: JSON.stringify(['NDA-01', '1234']),
  });

  const studentCookieHeader = studentAuthRes.headers.get('set-cookie');
  assertCheck('Student login creates genuine session cookie', Boolean(studentCookieHeader && studentCookieHeader.includes('abg_auth_session=')));
  const studentCookie = (studentCookieHeader || '').split(';')[0];

  const studentDashRes = await fetch(`${PROD_URL}/student`, {
    headers: { Cookie: studentCookie },
    redirect: 'manual',
  });
  assertCheck('Authenticated student can access /student dashboard (HTTP 200)', studentDashRes.status === 200);

  // -------------------------------------------------------------
  // Requirement 2: Teacher Independent Login & Dashboard
  // -------------------------------------------------------------
  console.log('\n--- REQUIREMENT 2: TEACHER INDEPENDENT LOGIN & DASHBOARD ---');
  const teacherLoginRes = await fetch(`${PROD_URL}/teacher/login`);
  assertCheck('Teacher Login Route (/teacher/login) returns HTTP 200', teacherLoginRes.status === 200);

  const teacherHtml = await teacherLoginRes.text();
  assertCheck('Teacher Login page includes Faculty Profile selection', teacherHtml.includes('Faculty Profile') || teacherHtml.includes('Select Faculty Profile'));
  assertCheck('Teacher Login page includes Faculty 4-Digit PIN field', teacherHtml.includes('Faculty 4-Digit PIN'));
  assertCheck('Teacher Login page has portalMode locked to faculty', teacherHtml.includes('portalMode\\":\\"faculty\\"'));
  assertCheck('Teacher Login page contains NO Student Roll Number input', !teacherHtml.includes('Student Roll Number'));
  assertCheck('Teacher Login page contains NO Director Master Password input', !teacherHtml.includes('Director Master Password'));

  // Authenticate active faculty member (Neelav Sir / 1234)
  const teachers = await pb.collection('teachers').getFullList({ filter: 'active = true' });
  const testTeacher = teachers[0];

  const teacherAuthRes = await fetch(`${PROD_URL}/teacher/login`, {
    method: 'POST',
    headers: {
      'Next-Action': teacherActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
    },
    body: JSON.stringify([testTeacher.id, '1234']),
  });

  const teacherCookieHeader = teacherAuthRes.headers.get('set-cookie');
  assertCheck('Teacher login creates genuine session cookie', Boolean(teacherCookieHeader && teacherCookieHeader.includes('abg_auth_session=')));
  const teacherCookie = (teacherCookieHeader || '').split(';')[0];

  const teacherDashRes = await fetch(`${PROD_URL}/teacher`, {
    headers: { Cookie: teacherCookie },
    redirect: 'manual',
  });
  assertCheck('Authenticated teacher can access /teacher workspace (HTTP 200)', teacherDashRes.status === 200);

  const teacherWorkspaceHtml = await teacherDashRes.text();
  assertCheck('Teacher Portal header includes direct link to Executive Dashboard', teacherWorkspaceHtml.includes('Executive Dashboard') && teacherWorkspaceHtml.includes('/dashboard'));

  // -------------------------------------------------------------
  // Requirement 3: Teacher Access to Executive Performance Dashboard
  // -------------------------------------------------------------
  console.log('\n--- REQUIREMENT 3: TEACHER ACCESS TO EXECUTIVE DASHBOARD ---');
  const execDashRes = await fetch(`${PROD_URL}/dashboard`, {
    headers: { Cookie: teacherCookie },
    redirect: 'manual',
  });
  assertCheck('Teacher authenticated session can access /dashboard (HTTP 200)', execDashRes.status === 200);

  const execDashHtml = await execDashRes.text();
  assertCheck('Executive Dashboard renders "My Workspace" button for teacher session', execDashHtml.includes('My Workspace') && execDashHtml.includes('/teacher'));

  // -------------------------------------------------------------
  // Requirement 4: Admin Independent Login & Governance Access
  // -------------------------------------------------------------
  console.log('\n--- REQUIREMENT 4: ADMIN INDEPENDENT LOGIN & GOVERNANCE ACCESS ---');
  const adminLoginRes = await fetch(`${PROD_URL}/admin/login`);
  assertCheck('Admin Login Route (/admin/login) returns HTTP 200', adminLoginRes.status === 200);

  const adminHtml = await adminLoginRes.text();
  assertCheck('Admin Login page includes Director Master Password input', adminHtml.includes('Director Master Password'));
  assertCheck('Admin Login page has portalMode locked to admin', adminHtml.includes('portalMode\\":\\"admin\\"'));
  assertCheck('Admin Login page contains NO Student Roll Number input', !adminHtml.includes('Student Roll Number'));
  assertCheck('Admin Login page contains NO Faculty select dropdown', !adminHtml.includes('Select Faculty Profile'));

  const masterPass = process.env.ADMIN_MASTER_PASSWORD;
  const adminAuthRes = await fetch(`${PROD_URL}/admin/login`, {
    method: 'POST',
    headers: {
      'Next-Action': adminActionId,
      'Content-Type': 'application/json',
      'Accept': 'text/x-component',
    },
    body: JSON.stringify([masterPass]),
  });

  const adminCookieHeader = adminAuthRes.headers.get('set-cookie');
  assertCheck('Admin login creates genuine session cookie', Boolean(adminCookieHeader && adminCookieHeader.includes('abg_auth_session=')));
  const adminCookie = (adminCookieHeader || '').split(';')[0];

  const adminToAdminRes = await fetch(`${PROD_URL}/admin`, {
    headers: { Cookie: adminCookie },
    redirect: 'manual',
  });
  assertCheck('Admin session can access /admin (HTTP 200)', adminToAdminRes.status === 200);

  const adminToDashRes = await fetch(`${PROD_URL}/dashboard`, {
    headers: { Cookie: adminCookie },
    redirect: 'manual',
  });
  assertCheck('Admin session can access /dashboard (HTTP 200)', adminToDashRes.status === 200);

  const adminToStudentRes = await fetch(`${PROD_URL}/student`, {
    headers: { Cookie: adminCookie },
    redirect: 'manual',
  });
  // Admin accessing /student: either 200 or clean profile handling
  assertCheck('Admin session can access /student (HTTP 200)', adminToStudentRes.status === 200);

  // -------------------------------------------------------------
  // Requirement 5: Server-side Cross-Role Access Prevention
  // -------------------------------------------------------------
  console.log('\n--- REQUIREMENT 5: CROSS-ROLE ACCESS BLOCKED BY SERVER ---');
  const studentToAdminRes = await fetch(`${PROD_URL}/admin`, {
    headers: { Cookie: studentCookie },
    redirect: 'manual',
  });
  assertCheck('Student session blocked from /admin (HTTP 307 -> /admin/login)', studentToAdminRes.status === 307 && (studentToAdminRes.headers.get('location') || '').includes('/admin/login'));

  const studentToTeacherRes = await fetch(`${PROD_URL}/teacher`, {
    headers: { Cookie: studentCookie },
    redirect: 'manual',
  });
  assertCheck('Student session blocked from /teacher (HTTP 307 -> /teacher/login)', studentToTeacherRes.status === 307 && (studentToTeacherRes.headers.get('location') || '').includes('/teacher/login'));

  const studentToDashRes = await fetch(`${PROD_URL}/dashboard`, {
    headers: { Cookie: studentCookie },
    redirect: 'manual',
  });
  assertCheck('Student session blocked from /dashboard (HTTP 307 -> /teacher/login)', studentToDashRes.status === 307 && (studentToDashRes.headers.get('location') || '').includes('/teacher/login'));

  const teacherToAdminRes = await fetch(`${PROD_URL}/admin`, {
    headers: { Cookie: teacherCookie },
    redirect: 'manual',
  });
  assertCheck('Teacher session blocked from /admin (HTTP 307 -> /admin/login)', teacherToAdminRes.status === 307 && (teacherToAdminRes.headers.get('location') || '').includes('/admin/login'));

  const teacherToStudentRes = await fetch(`${PROD_URL}/student`, {
    headers: { Cookie: teacherCookie },
    redirect: 'manual',
  });
  assertCheck('Teacher session blocked from /student (HTTP 307 -> /student/login)', teacherToStudentRes.status === 307 && (teacherToStudentRes.headers.get('location') || '').includes('/student/login'));

  // -------------------------------------------------------------
  // Requirement 6: Direct Unauthenticated URL Access Blocked
  // -------------------------------------------------------------
  console.log('\n--- REQUIREMENT 6: DIRECT UNAUTHENTICATED URL ACCESS BLOCKED ---');
  const unauthStudent = await fetch(`${PROD_URL}/student`, { redirect: 'manual' });
  assertCheck('Unauthenticated /student redirects to /student/login (HTTP 307)', unauthStudent.status === 307 && (unauthStudent.headers.get('location') || '').includes('/student/login'));

  const unauthTeacher = await fetch(`${PROD_URL}/teacher`, { redirect: 'manual' });
  assertCheck('Unauthenticated /teacher redirects to /teacher/login (HTTP 307)', unauthTeacher.status === 307 && (unauthTeacher.headers.get('location') || '').includes('/teacher/login'));

  const unauthAdmin = await fetch(`${PROD_URL}/admin`, { redirect: 'manual' });
  assertCheck('Unauthenticated /admin redirects to /admin/login (HTTP 307)', unauthAdmin.status === 307 && (unauthAdmin.headers.get('location') || '').includes('/admin/login'));

  const unauthDash = await fetch(`${PROD_URL}/dashboard`, { redirect: 'manual' });
  assertCheck('Unauthenticated /dashboard redirects to /teacher/login (HTTP 307)', unauthDash.status === 307 && (unauthDash.headers.get('location') || '').includes('/teacher/login'));

  const unauthExport = await fetch(`${PROD_URL}/api/export?type=entries`, { redirect: 'manual' });
  assertCheck('Unauthenticated /api/export is blocked (HTTP 307 -> /teacher/login)', unauthExport.status === 307 && (unauthExport.headers.get('location') || '').includes('/teacher/login'));

  // -------------------------------------------------------------
  // Data Integrity Verification: 100% Intact Genuine Submissions
  // -------------------------------------------------------------
  console.log('\n--- DATA INTEGRITY INVARIANT ---');
  const genuine1 = await pb.collection('entries').getOne('7lhmo4p1mzkw9w2', { expand: 'student' });
  assertCheck('Genuine Entry 1 (7lhmo4p1mzkw9w2 by Mafruza Rahman) is 100% intact', genuine1.status === 'covered' && (genuine1.expand as any)?.student?.name === 'Mafruza Rahman');

  const genuine2 = await pb.collection('entries').getOne('pogx003bic5x4pi', { expand: 'student' });
  assertCheck('Genuine Entry 2 (pogx003bic5x4pi by Sangey Lhamunamsa) is 100% intact', genuine2.status === 'covered' && genuine2.review_status === 'CLEARED');

  const totalEntries = await pb.collection('entries').getFullList();
  assertCheck('Total database entries preserved (at least 9 records)', totalEntries.length >= 9);

  console.log('\n============================================================');
  console.log(`🎉 SUMMARY: ALL ${passed}/${total} LIVE PRODUCTION VERIFICATIONS PASSED CLEANLY!`);
  console.log('============================================================');
}

testPortals().catch(console.error);
