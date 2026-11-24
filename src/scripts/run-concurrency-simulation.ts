/**
 * Multi-Role Concurrency Simulation Runner
 * Milestone 2: Multi-Role Concurrency Simulation
 *
 * Implements real-world multi-role concurrency scenarios against live production endpoints:
 *   Frontend: https://syllabus360.abhigyanintelligence.cloud
 *   Backend:  https://stracker.abhigyanintelligence.cloud
 *
 * Scenarios:
 * 1. Scenario 1: 100 concurrent students submitting classroom topics simultaneously (burst submissions)
 *    in TEST_COURSE (Sandbox Topic 1 & 2) via POST /api/submit.
 * 2. Scenario 2: 15 concurrent teachers performing active workflows:
 *    logging in, endorsing topics ("Mark Taught" via teacherEndorseTopicAction),
 *    reviewing student logs (/teacher and getTeacherDashboardData), and updating PINs (updateTeacherPinAction).
 * 3. Scenario 3: 1 administrator performing active oversight:
 *    dashboard data refresh (/admin & /dashboard), CSV export (/api/export?type=entries),
 *    resetting student/teacher PINs (resetStudentPinAction, resetTeacherPinAction),
 *    and updating course settings (updateCourseSettingsAction).
 * 4. Scenario 4: Full academy multi-role concurrency burst:
 *    simultaneously executing 100 students submitting + 15 teachers endorsing/reviewing + 1 admin oversight/export/reset
 *    (116 concurrent actors).
 *
 * Invariants:
 * - Pre-flight & post-flight verification: 75 genuine students, 8 genuine teachers, and 13 historical entries
 *   remain 100% untouched.
 * - All test activity is strictly confined to TEST_COURSE sandbox and pruned after execution.
 */

import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import {
  TARGET_FRONTEND_URL,
  TARGET_BACKEND_URL,
  SANDBOX_TOPIC_1_ID,
  SANDBOX_TOPIC_2_ID,
  SANDBOX_SUBJECT_ID,
  TEST_COURSE_ID,
  PreWarmedStudentAccount,
  PreWarmedTeacherAccount,
  PreWarmedAdminAccount,
  ScenarioTaskResponse,
  ScenarioResult,
  runConcurrencyScenario,
  getPreWarmedStudentAccounts,
  getPreWarmedTeacherAccounts,
  getPreWarmedAdminAccount,
  pruneSandboxEntries,
  pruneSandboxTeachingRecords,
  verifyBaselineInvariants,
  isSqliteLockError,
} from './load-test-harness';
import { getTeacherDashboardData } from '../lib/teacher-data';

// Auto-load .env.local if credentials or secrets are missing
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile('.env.local');
  } catch {}
}

export interface ProductionActionIds {
  teacherLogin: string;
  teacherEndorse: string;
  teacherUpdatePin: string;
  adminResetStudentPin: string;
  adminResetTeacherPin: string;
  adminUpdateCourseSettings: string;
}

export const KNOWN_PRODUCTION_ACTION_IDS: ProductionActionIds = {
  teacherLogin: '60f82e6dfe50d2931da75d14657b647962ae0d5bdf',
  teacherEndorse: '78af6587d853a4d910de776cdb7484c204e6ba0813',
  teacherUpdatePin: '60c8cc51aeaf23903a0976bc014546c5a214d11563',
  adminResetStudentPin: '600bda33c106b7ce8ec62fc4e9374c3886291fcdd5',
  adminResetTeacherPin: '60bbad357bb74667d5eb41861ad654b10f738b544d',
  adminUpdateCourseSettings: '602af4e1d208ade840738b353171237bb962439c3a',
};

/**
 * Dynamically resolves Next.js Server Action IDs from production client script chunks.
 * Falls back to verified known IDs if client chunks cannot be fetched or parsed.
 */
export async function resolveActionIds(targetUrl: string = TARGET_FRONTEND_URL): Promise<ProductionActionIds> {
  const resolved = { ...KNOWN_PRODUCTION_ACTION_IDS };
  try {
    const pages = ['/teacher/login', '/teacher', '/admin'];
    const chunkUrls = new Set<string>();

    for (const page of pages) {
      const res = await fetch(`${targetUrl}${page}`, { cache: 'no-store' });
      if (res.ok) {
        const html = await res.text();
        const matches = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)];
        for (const m of matches) {
          chunkUrls.add(`${targetUrl}${m[1]}`);
        }
      }
    }

    for (const url of chunkUrls) {
      const jsRes = await fetch(url, { cache: 'no-store' });
      if (jsRes.ok) {
        const js = await jsRes.text();
        const actionMatches = [...js.matchAll(/"([a-f0-9]{40,})"[^"]*"([a-zA-Z0-9_]+Action)"/g)];
        for (const m of actionMatches) {
          const actionId = m[1];
          const actionName = m[2];
          if (actionName === 'teacherLoginAction') resolved.teacherLogin = actionId;
          if (actionName === 'teacherEndorseTopicAction') resolved.teacherEndorse = actionId;
          if (actionName === 'updateTeacherPinAction') resolved.teacherUpdatePin = actionId;
          if (actionName === 'resetStudentPinAction') resolved.adminResetStudentPin = actionId;
          if (actionName === 'resetTeacherPinAction') resolved.adminResetTeacherPin = actionId;
          if (actionName === 'updateCourseSettingsAction') resolved.adminUpdateCourseSettings = actionId;
        }
      }
    }
  } catch (err) {
    console.warn('  ⚠️ Dynamic action ID resolution encountered an error; using known verified action IDs:', err);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Individual Actor Task Executors
// ---------------------------------------------------------------------------

/**
 * Student classroom topic submission via POST /api/submit
 */
export async function executeStudentSubmission(
  student: PreWarmedStudentAccount,
  topicId: string,
  targetUrl: string = TARGET_FRONTEND_URL,
  remarksPrefix: string = '[Concurrency Sim]'
): Promise<ScenarioTaskResponse> {
  const body = {
    courseId: TEST_COURSE_ID,
    teacherId: 'zu27lc1jtgf4fsv', // Default Teacher BOT-TEA-001
    subjectId: SANDBOX_SUBJECT_ID,
    topicId,
    status: 'covered',
    remarks: `${remarksPrefix} Student ${student.rollNo}`,
    deviceId: student.deviceId,
    studentId: student.studentId,
  };

  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': student.cookie,
        'X-Real-IP': student.clientIp,
        'X-Forwarded-For': `${student.clientIp}, 201.18.199.137`,
      },
      body: JSON.stringify(body),
    });
    const t1 = performance.now();
    const resBody = await res.json().catch(() => null);

    return {
      status: res.status,
      statusText: res.statusText,
      body: resBody,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Teacher authentication via teacherLoginAction over HTTP
 */
export async function executeTeacherLogin(
  teacher: PreWarmedTeacherAccount,
  actionId: string,
  targetUrl: string = TARGET_FRONTEND_URL,
  pin: string = '4321'
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/teacher/login`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        'Content-Type': 'application/json',
        'Accept': 'text/x-component',
        'X-Real-IP': teacher.clientIp,
        'X-Forwarded-For': `${teacher.clientIp}, 201.18.199.137`,
      },
      body: JSON.stringify([teacher.teacherId, pin]),
    });
    const t1 = performance.now();
    const resText = await res.text();
    return {
      status: res.status,
      statusText: res.statusText,
      body: resText.slice(0, 200),
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Teacher topic endorsement ("Mark Taught") via teacherEndorseTopicAction over HTTP
 */
export async function executeTeacherEndorse(
  teacher: PreWarmedTeacherAccount,
  topicId: string,
  actionId: string,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/teacher`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        'Content-Type': 'application/json',
        'Accept': 'text/x-component',
        'Cookie': teacher.cookie,
        'X-Real-IP': teacher.clientIp,
        'X-Forwarded-For': `${teacher.clientIp}, 201.18.199.137`,
      },
      body: JSON.stringify([
        topicId,
        SANDBOX_SUBJECT_ID,
        TEST_COURSE_ID,
        `[Concurrency Sim Endorsement by ${teacher.phone}]`,
      ]),
    });
    const t1 = performance.now();
    const resText = await res.text();
    return {
      status: res.status,
      statusText: res.statusText,
      body: resText.slice(0, 200),
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Teacher portal & student logs review via GET /teacher and getTeacherDashboardData
 */
export async function executeTeacherReview(
  teacher: PreWarmedTeacherAccount,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/teacher`, {
      method: 'GET',
      headers: {
        'Cookie': teacher.cookie,
        'X-Real-IP': teacher.clientIp,
        'X-Forwarded-For': `${teacher.clientIp}, 201.18.199.137`,
      },
    });
    // Concurrently fetch teacher dashboard data
    const dashData = await getTeacherDashboardData(teacher.teacherId, SANDBOX_SUBJECT_ID);
    const t1 = performance.now();

    return {
      status: res.status,
      statusText: res.statusText,
      body: { portalOk: res.ok, dashboardDataLoaded: Boolean(dashData) },
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Teacher PIN update via updateTeacherPinAction over HTTP
 */
export async function executeTeacherPinUpdate(
  teacher: PreWarmedTeacherAccount,
  oldPin: string,
  newPin: string,
  actionId: string,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/teacher`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        'Content-Type': 'application/json',
        'Accept': 'text/x-component',
        'Cookie': teacher.cookie,
        'X-Real-IP': teacher.clientIp,
        'X-Forwarded-For': `${teacher.clientIp}, 201.18.199.137`,
      },
      body: JSON.stringify([oldPin, newPin]),
    });
    const t1 = performance.now();
    const resText = await res.text();
    return {
      status: res.status,
      statusText: res.statusText,
      body: resText.slice(0, 200),
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Admin portal refresh & oversight fetch via GET /admin and /dashboard
 */
export async function executeAdminDashboardRefresh(
  admin: PreWarmedAdminAccount,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const [resAdmin, resDashboard] = await Promise.all([
      fetch(`${targetUrl}/admin`, {
        headers: {
          'Cookie': admin.cookie,
          'X-Real-IP': admin.clientIp,
          'X-Forwarded-For': `${admin.clientIp}, 201.18.199.137`,
        },
      }),
      fetch(`${targetUrl}/dashboard`, {
        headers: {
          'Cookie': admin.cookie,
          'X-Real-IP': admin.clientIp,
          'X-Forwarded-For': `${admin.clientIp}, 201.18.199.137`,
        },
      }),
    ]);
    const t1 = performance.now();
    const status = resAdmin.ok && resDashboard.ok ? 200 : resAdmin.status || resDashboard.status;

    return {
      status,
      statusText: `admin:${resAdmin.status}, dash:${resDashboard.status}`,
      body: { adminOk: resAdmin.ok, dashboardOk: resDashboard.ok },
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Admin CSV export download via GET /api/export?type=entries
 */
export async function executeAdminCsvExport(
  admin: PreWarmedAdminAccount,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/api/export?type=entries`, {
      headers: {
        'Cookie': admin.cookie,
        'X-Real-IP': admin.clientIp,
        'X-Forwarded-For': `${admin.clientIp}, 201.18.199.137`,
      },
    });
    const t1 = performance.now();
    const text = await res.text();

    return {
      status: res.status,
      statusText: res.statusText,
      body: { length: text.length, isCsv: text.includes('Reference ID,Class Date') },
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Admin student PIN reset via resetStudentPinAction over HTTP
 */
export async function executeAdminResetStudentPin(
  admin: PreWarmedAdminAccount,
  studentId: string,
  actionId: string,
  targetUrl: string = TARGET_FRONTEND_URL,
  newPin: string = '4321'
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/admin`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        'Content-Type': 'application/json',
        'Accept': 'text/x-component',
        'Cookie': admin.cookie,
        'X-Real-IP': admin.clientIp,
        'X-Forwarded-For': `${admin.clientIp}, 201.18.199.137`,
      },
      body: JSON.stringify([studentId, newPin]),
    });
    const t1 = performance.now();
    const resText = await res.text();

    return {
      status: res.status,
      statusText: res.statusText,
      body: resText.slice(0, 200),
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Admin teacher PIN reset via resetTeacherPinAction over HTTP
 */
export async function executeAdminResetTeacherPin(
  admin: PreWarmedAdminAccount,
  teacherId: string,
  actionId: string,
  targetUrl: string = TARGET_FRONTEND_URL,
  newPin: string = '4321'
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/admin`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        'Content-Type': 'application/json',
        'Accept': 'text/x-component',
        'Cookie': admin.cookie,
        'X-Real-IP': admin.clientIp,
        'X-Forwarded-For': `${admin.clientIp}, 201.18.199.137`,
      },
      body: JSON.stringify([teacherId, newPin]),
    });
    const t1 = performance.now();
    const resText = await res.text();

    return {
      status: res.status,
      statusText: res.statusText,
      body: resText.slice(0, 200),
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

/**
 * Admin course settings update via updateCourseSettingsAction over HTTP
 */
export async function executeAdminUpdateCourseSettings(
  admin: PreWarmedAdminAccount,
  courseId: string,
  actionId: string,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioTaskResponse> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/admin`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        'Content-Type': 'application/json',
        'Accept': 'text/x-component',
        'Cookie': admin.cookie,
        'X-Real-IP': admin.clientIp,
        'X-Forwarded-For': `${admin.clientIp}, 201.18.199.137`,
      },
      body: JSON.stringify([
        courseId,
        {
          confirmation_threshold: 1,
          daily_entry_cap: 10,
          code_ttl_minutes: 60,
          require_class_code: false,
        },
      ]),
    });
    const t1 = performance.now();
    const resText = await res.text();

    return {
      status: res.status,
      statusText: res.statusText,
      body: resText.slice(0, 200),
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  } catch (err: any) {
    const t1 = performance.now();
    return {
      status: 500,
      error: err,
      latencyMs: Number((t1 - t0).toFixed(2)),
    };
  }
}

// ---------------------------------------------------------------------------
// Scenario Definitions & Orchestration
// ---------------------------------------------------------------------------

export interface FullSimulationResults {
  timestamp: string;
  targetFrontendUrl: string;
  targetBackendUrl: string;
  preFlightInvariant: any;
  scenario1: ScenarioResult;
  scenario2: ScenarioResult;
  scenario3: ScenarioResult;
  scenario4: ScenarioResult;
  postFlightPruning: { entriesPruned: number; teachingRecordsPruned: number };
  postFlightInvariant: any;
  summary: {
    totalScenarios: number;
    totalRequests: number;
    totalErrors: number;
    sqliteLockErrors: number;
    invariantsPreserved: boolean;
  };
}

/**
 * Scenario 1: 100 concurrent students submitting classroom topics simultaneously (burst submissions)
 */
export async function runScenario1(
  students: PreWarmedStudentAccount[],
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioResult> {
  const tasks = students.map((stu, idx) => {
    const topicId = idx % 2 === 0 ? SANDBOX_TOPIC_1_ID : SANDBOX_TOPIC_2_ID;
    return async () => executeStudentSubmission(stu, topicId, targetUrl, '[Scenario 1 Burst]');
  });

  return runConcurrencyScenario({
    scenarioName: 'Scenario 1: 100 Concurrent Students Burst Submissions (POST /api/submit)',
    tasks,
    concurrency: 100, // True 100-actor parallel burst
    validateSafetyBeforeAndAfter: false, // Orchestrator handles pre/post invariant checks
  });
}

/**
 * Scenario 2: 15 concurrent teachers performing active workflows
 * (login, endorse "Mark Taught", review logs, update PIN)
 */
export async function runScenario2(
  teachers: PreWarmedTeacherAccount[],
  actionIds: ProductionActionIds,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioResult> {
  const tasks = teachers.map((teacher, idx) => {
    return async (): Promise<ScenarioTaskResponse> => {
      // Divide 15 teachers across active workflows:
      // Teachers 0..3: Login verification
      // Teachers 4..8: Topic endorsement ("Mark Taught")
      // Teachers 9..11: Student logs review & dashboard
      // Teachers 12..14: PIN rotation & update
      const roleGroup = idx % 4;

      if (roleGroup === 0) {
        return executeTeacherLogin(teacher, actionIds.teacherLogin, targetUrl, '4321');
      } else if (roleGroup === 1) {
        const topicId = idx % 2 === 0 ? SANDBOX_TOPIC_1_ID : SANDBOX_TOPIC_2_ID;
        return executeTeacherEndorse(teacher, topicId, actionIds.teacherEndorse, targetUrl);
      } else if (roleGroup === 2) {
        return executeTeacherReview(teacher, targetUrl);
      } else {
        // Update PIN from 4321 to 4325 and immediately revert
        const updateRes = await executeTeacherPinUpdate(teacher, '4321', '4325', actionIds.teacherUpdatePin, targetUrl);
        if (updateRes.status === 200) {
          await executeTeacherPinUpdate(teacher, '4325', '4321', actionIds.teacherUpdatePin, targetUrl);
        }
        return updateRes;
      }
    };
  });

  return runConcurrencyScenario({
    scenarioName: 'Scenario 2: 15 Concurrent Teachers Active Workflows (Login, Endorse, Review, PIN Update)',
    tasks,
    concurrency: 15,
    validateSafetyBeforeAndAfter: false,
  });
}

/**
 * Scenario 3: 1 administrator performing active oversight
 * (dashboard refresh, CSV export, PIN resets, settings update)
 */
export async function runScenario3(
  admin: PreWarmedAdminAccount,
  students: PreWarmedStudentAccount[],
  teachers: PreWarmedTeacherAccount[],
  actionIds: ProductionActionIds,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioResult> {
  const targetStudent = students.find((s) => s.rollNo === 'BOT-STU-001') || students[0];
  const targetTeacher = teachers.find((t) => t.phone === 'BOT-TEA-001') || teachers[0];

  const adminTasks: Array<() => Promise<ScenarioTaskResponse>> = [
    // 1. Dashboard data oversight refresh
    async () => executeAdminDashboardRefresh(admin, targetUrl),
    // 2. CSV entries export download
    async () => executeAdminCsvExport(admin, targetUrl),
    // 3. Reset student PIN
    async () => executeAdminResetStudentPin(admin, targetStudent.studentId, actionIds.adminResetStudentPin, targetUrl, '4321'),
    // 4. Reset teacher PIN
    async () => executeAdminResetTeacherPin(admin, targetTeacher.teacherId, actionIds.adminResetTeacherPin, targetUrl, '4321'),
    // 5. Update course settings
    async () => executeAdminUpdateCourseSettings(admin, TEST_COURSE_ID, actionIds.adminUpdateCourseSettings, targetUrl),
  ];

  return runConcurrencyScenario({
    scenarioName: 'Scenario 3: 1 Administrator Active Oversight (Dashboard, Export, PIN Resets, Settings)',
    tasks: adminTasks,
    concurrency: adminTasks.length,
    validateSafetyBeforeAndAfter: false,
  });
}

/**
 * Scenario 4: Full academy multi-role concurrency burst (116 concurrent actors)
 * 100 students + 15 teachers + 1 admin oversight/export/reset
 */
export async function runScenario4(
  students: PreWarmedStudentAccount[],
  teachers: PreWarmedTeacherAccount[],
  admin: PreWarmedAdminAccount,
  actionIds: ProductionActionIds,
  targetUrl: string = TARGET_FRONTEND_URL
): Promise<ScenarioResult> {
  const allTasks: Array<() => Promise<ScenarioTaskResponse>> = [];

  // 1. 100 concurrent student submissions
  for (let i = 0; i < students.length; i++) {
    const stu = students[i];
    const topicId = i % 2 === 0 ? SANDBOX_TOPIC_1_ID : SANDBOX_TOPIC_2_ID;
    allTasks.push(async () => executeStudentSubmission(stu, topicId, targetUrl, '[Scenario 4 Full Academy Burst]'));
  }

  // 2. 15 concurrent teacher workflows
  for (let i = 0; i < teachers.length; i++) {
    const tea = teachers[i];
    const roleGroup = i % 4;
    allTasks.push(async () => {
      if (roleGroup === 0) {
        return executeTeacherLogin(tea, actionIds.teacherLogin, targetUrl, '4321');
      } else if (roleGroup === 1) {
        const topicId = i % 2 === 0 ? SANDBOX_TOPIC_1_ID : SANDBOX_TOPIC_2_ID;
        return executeTeacherEndorse(tea, topicId, actionIds.teacherEndorse, targetUrl);
      } else if (roleGroup === 2) {
        return executeTeacherReview(tea, targetUrl);
      } else {
        const updateRes = await executeTeacherPinUpdate(tea, '4321', '4325', actionIds.teacherUpdatePin, targetUrl);
        if (updateRes.status === 200) {
          await executeTeacherPinUpdate(tea, '4325', '4321', actionIds.teacherUpdatePin, targetUrl);
        }
        return updateRes;
      }
    });
  }

  // 3. 1 administrator oversight workload
  const targetStudent = students.find((s) => s.rollNo === 'BOT-STU-001') || students[0];
  allTasks.push(async () => {
    // Admin concurrently executes CSV export and oversight check
    const [exportRes, dashRes] = await Promise.all([
      executeAdminCsvExport(admin, targetUrl),
      executeAdminDashboardRefresh(admin, targetUrl),
    ]);
    return {
      status: exportRes.status === 200 && dashRes.status === 200 ? 200 : exportRes.status,
      statusText: `export:${exportRes.status}, dash:${dashRes.status}`,
      body: { exportRes: exportRes.body, dashRes: dashRes.body },
      latencyMs: Math.max(exportRes.latencyMs || 0, dashRes.latencyMs || 0),
    };
  });

  return runConcurrencyScenario({
    scenarioName: 'Scenario 4: Full Academy 116-Actor Concurrency Burst (100 Students + 15 Teachers + 1 Admin)',
    tasks: allTasks,
    concurrency: 116, // True 116 parallel actors
    validateSafetyBeforeAndAfter: false,
  });
}

/**
 * Main simulation runner
 */
export async function runFullConcurrencySimulation(): Promise<FullSimulationResults> {
  console.log('\n================================================================');
  console.log('🏛️  ABHIGYAN ACADEMY — MULTI-ROLE CONCURRENCY SIMULATION');
  console.log(`   Frontend: ${TARGET_FRONTEND_URL}`);
  console.log(`   Backend:  ${TARGET_BACKEND_URL}`);
  console.log(`   Sandbox:  TEST_COURSE (${TEST_COURSE_ID})`);
  console.log('================================================================\n');

  // Step 1: Pre-flight genuine data invariant check
  console.log('📋 STEP 1: Pre-Flight Genuine Data Invariant Verification...');
  const preFlightInvariant = await verifyBaselineInvariants();
  if (!preFlightInvariant.intact) {
    throw new Error('FATAL: Pre-flight baseline invariant verification failed! Simulation aborted to protect data.');
  }
  console.log(
    `  ✅ Pre-flight baseline confirmed 100% intact: ${preFlightInvariant.details.genuineStudentsCount} students, ${preFlightInvariant.details.genuineTeachersCount} teachers, ${preFlightInvariant.details.genuineEntriesCount} historical entries.\n`
  );

  // Step 2: Session pre-warming and account loading
  console.log('🔑 STEP 2: Loading & Pre-Warming Multi-Role Accounts...');
  const students = await getPreWarmedStudentAccounts(100);
  console.log(`  ✓ Loaded & pre-warmed ${students.length} student sessions (tokens, virtual IPs & device IDs).`);

  const teachers = await getPreWarmedTeacherAccounts(15);
  console.log(`  ✓ Loaded & pre-warmed ${teachers.length} teacher sessions.`);

  const admin = await getPreWarmedAdminAccount();
  console.log(`  ✓ Loaded & pre-warmed Director / Administrator session.`);

  console.log('  🔍 Resolving live production Next.js Server Action IDs...');
  const actionIds = await resolveActionIds(TARGET_FRONTEND_URL);
  console.log(`  ✓ Action IDs resolved:`, actionIds);

  // Clean prior sandbox entries before starting
  console.log('\n🧹 Preparing sandbox: pruning any prior sandbox test entries...');
  const initialEntriesPruned = await pruneSandboxEntries();
  const initialTRsPruned = await pruneSandboxTeachingRecords();
  if (initialEntriesPruned > 0 || initialTRsPruned > 0) {
    console.log(`  ✓ Cleaned ${initialEntriesPruned} prior entries and ${initialTRsPruned} prior teaching records.`);
  }

  // Step 3: Execute Scenario 1 (100 Students Burst)
  console.log('\n🚀 STEP 3: Executing Scenario 1 (100 Concurrent Students Burst Submissions)...');
  const scenario1Result = await runScenario1(students, TARGET_FRONTEND_URL);

  // Prune entries from Scenario 1 before Scenario 2
  await pruneSandboxEntries();

  // Step 4: Execute Scenario 2 (15 Teachers Active Workflows)
  console.log('\n🚀 STEP 4: Executing Scenario 2 (15 Concurrent Teachers Active Workflows)...');
  const scenario2Result = await runScenario2(teachers, actionIds, TARGET_FRONTEND_URL);

  // Step 5: Execute Scenario 3 (1 Administrator Active Oversight)
  console.log('\n🚀 STEP 5: Executing Scenario 3 (1 Administrator Active Oversight)...');
  const scenario3Result = await runScenario3(admin, students, teachers, actionIds, TARGET_FRONTEND_URL);

  // Prune sandbox before peak burst
  await pruneSandboxEntries();
  await pruneSandboxTeachingRecords();

  // Step 6: Execute Scenario 4 (Full Academy 116-Actor Concurrency Burst)
  console.log('\n🔥 STEP 6: Executing Scenario 4 (Full Academy 116-Actor Concurrency Burst)...');
  const scenario4Result = await runScenario4(students, teachers, admin, actionIds, TARGET_FRONTEND_URL);

  // Step 7: Post-flight sandbox pruning
  console.log('\n🧹 STEP 7: Post-Simulation Sandbox Teardown & Pruning...');
  const finalEntriesPruned = await pruneSandboxEntries();
  const finalTRsPruned = await pruneSandboxTeachingRecords();
  console.log(`  ✓ Post-simulation cleanup: pruned ${finalEntriesPruned} entries and ${finalTRsPruned} teaching records from TEST_COURSE.`);

  // Step 8: Post-flight genuine data invariant check
  console.log('\n🔒 STEP 8: Post-Flight Genuine Data Invariant Audit...');
  const postFlightInvariant = await verifyBaselineInvariants();
  if (!postFlightInvariant.intact) {
    throw new Error('CRITICAL INTEGRITY FAILURE: Post-flight baseline invariant check detected data alteration!');
  }
  console.log(
    `  ✅ Post-flight baseline confirmed 100% intact: ${postFlightInvariant.details.genuineStudentsCount} students, ${postFlightInvariant.details.genuineTeachersCount} teachers, ${postFlightInvariant.details.genuineEntriesCount} historical entries.`
  );

  const totalRequests =
    scenario1Result.totalRequests +
    scenario2Result.totalRequests +
    scenario3Result.totalRequests +
    scenario4Result.totalRequests;

  const totalErrors =
    scenario1Result.failures.length +
    scenario2Result.failures.length +
    scenario3Result.failures.length +
    scenario4Result.failures.length;

  const totalSqliteLocks =
    scenario1Result.sqliteLockErrors +
    scenario2Result.sqliteLockErrors +
    scenario3Result.sqliteLockErrors +
    scenario4Result.sqliteLockErrors;

  const results: FullSimulationResults = {
    timestamp: new Date().toISOString(),
    targetFrontendUrl: TARGET_FRONTEND_URL,
    targetBackendUrl: TARGET_BACKEND_URL,
    preFlightInvariant,
    scenario1: scenario1Result,
    scenario2: scenario2Result,
    scenario3: scenario3Result,
    scenario4: scenario4Result,
    postFlightPruning: {
      entriesPruned: finalEntriesPruned,
      teachingRecordsPruned: finalTRsPruned,
    },
    postFlightInvariant,
    summary: {
      totalScenarios: 4,
      totalRequests,
      totalErrors,
      sqliteLockErrors: totalSqliteLocks,
      invariantsPreserved: postFlightInvariant.intact,
    },
  };

  // Output formatted execution summary table
  printSimulationSummary(results);

  return results;
}

/**
 * Pretty-prints a markdown-ready formatted terminal summary table of all simulation metrics
 */
export function printSimulationSummary(res: FullSimulationResults) {
  console.log('\n========================================================================================');
  console.log('📊 CONCURRENCY SIMULATION METRIC CONSOLIDATION & BENCHMARK REPORT');
  console.log('========================================================================================\n');

  console.log('| Scenario | Actors | Duration (ms) | Throughput (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) | HTTP 200 | HTTP Errors | SQLite Locks |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');

  const scs = [res.scenario1, res.scenario2, res.scenario3, res.scenario4];
  for (const s of scs) {
    const errCount = s.failures.length;
    const okCount = s.statusCounts[200] || 0;
    console.log(
      `| ${s.scenarioName.slice(0, 24)}... | ${s.concurrency} | ${s.durationMs} | ${s.throughputRps} | ${s.latencies.p50} | ${s.latencies.p95} | ${s.latencies.p99} | ${s.latencies.max} | ${okCount} | ${errCount} | ${s.sqliteLockErrors} |`
    );
  }

  console.log('\nDetailed HTTP Status Distributions:');
  for (const s of scs) {
    console.log(`  - ${s.scenarioName}:`, s.statusCounts);
  }

  console.log('\nDatabase Locking & Safety Summary:');
  console.log(`  - Total SQLite Lock Contention Errors: ${res.summary.sqliteLockErrors}`);
  console.log(`  - Genuine Student Invariant: ${res.postFlightInvariant.details.genuineStudentsCount} / 75 (100% Preserved)`);
  console.log(`  - Genuine Teacher Invariant: ${res.postFlightInvariant.details.genuineTeachersCount} / 8 (100% Preserved)`);
  console.log(`  - Genuine Historical Entries Invariant: ${res.postFlightInvariant.details.genuineEntriesCount} / 13 (100% Preserved)`);
  console.log(`  - Post-flight Sandbox Pruned: ${res.postFlightPruning.entriesPruned} entries, ${res.postFlightPruning.teachingRecordsPruned} teaching records.`);
  console.log('========================================================================================\n');
}

// CLI execution entrypoint
if (require.main === module || process.argv[1]?.endsWith('run-concurrency-simulation.ts')) {
  runFullConcurrencySimulation()
    .then((results) => {
      // Write simulation output JSON for programmatic consumption and forensic audit
      const outputPath = path.resolve(process.cwd(), 'test-results', 'concurrency-simulation-results.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`📁 Detailed JSON results exported to: ${outputPath}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ FATAL SIMULATION ERROR:', err);
      process.exit(1);
    });
}
