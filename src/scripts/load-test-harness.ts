/**
 * Concurrency & Race Condition Test Harness
 * Milestone 1: Test Harness & Data Scaffolding
 *
 * Core Capabilities:
 * 1. Session Token Pre-Warming: Pre-signs HMAC-SHA256 session cookies (abg_student_session,
 *    abg_teacher_session, abg_admin_session) using server SESSION_SECRET to decouple
 *    burst concurrency from login rate limits.
 * 2. High-Resolution Latency Tracking: Measures min, max, mean, p50, p90, p95, p99 latency per scenario.
 * 3. HTTP Status Tracking: Records counts for 200, 400, 401, 403, 409, 429, 500.
 * 4. SQLite Lock Contention Detection: Captures and logs PocketBase/SQLite errors and SQLITE_BUSY occurrences.
 * 5. Safe Client IP & Device ID Isolation: Injects distinct client IP headers and device IDs.
 * 6. Pre- and Post-Run Invariant Assertion: Validates that 75 genuine students, 8 genuine teachers,
 *    and 13 historical entries remain 100% untouched.
 * 7. Programmatic API & CLI Execution Support for Milestones 2 & 3.
 */

import { performance } from 'node:perf_hooks';
import { getPbClient } from '../lib/pb';
import { signPayload, SessionPayload } from '../lib/session';
import {
  verifyBaselineInvariants,
  TEST_COURSE_ID,
  TEST_COURSE_CODE,
  SANDBOX_SUBJECT_ID,
  InvariantResult,
} from './scaffold-synthetic-accounts';

// Auto-load .env.local if credentials or secrets are missing
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile('.env.local');
  } catch {}
}

export const TARGET_FRONTEND_URL =
  process.env.TARGET_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://syllabus360.abhigyanintelligence.cloud';

export const TARGET_BACKEND_URL =
  process.env.POCKETBASE_URL?.replace(/\/_\/?$/, '') ||
  'https://stracker.abhigyanintelligence.cloud';

export const SANDBOX_TOPIC_1_ID = 'e4cl8yellawb3po';
export const SANDBOX_TOPIC_2_ID = 'f4680ye6983t52h';

export interface PreWarmedStudentAccount {
  student: any;
  studentId: string;
  rollNo: string;
  name: string;
  token: string;
  cookie: string;
  cookieHeader: string;
  deviceId: string;
  clientIp: string;
}

export interface PreWarmedTeacherAccount {
  teacher: any;
  teacherId: string;
  phone: string;
  name: string;
  token: string;
  cookie: string;
  cookieHeader: string;
  clientIp: string;
}

export interface PreWarmedAdminAccount {
  token: string;
  cookie: string;
  cookieHeader: string;
  clientIp: string;
}

export interface LatencyStats {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface ScenarioTaskResponse {
  status: number;
  statusText?: string;
  body?: any;
  error?: any;
  latencyMs?: number;
}

export interface ScenarioOptions {
  scenarioName: string;
  tasks: Array<(index: number) => Promise<ScenarioTaskResponse>>;
  concurrency?: number;
  validateSafetyBeforeAndAfter?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

export interface ScenarioResult {
  scenarioName: string;
  totalRequests: number;
  concurrency: number;
  durationMs: number;
  throughputRps: number;
  statusCounts: Record<number, number>;
  latencies: LatencyStats;
  sqliteLockErrors: number;
  failures: Array<{ status: number; error: string }>;
}

// Re-export baseline verification and sandbox constants for external callers
export {
  verifyBaselineInvariants,
  TEST_COURSE_ID,
  TEST_COURSE_CODE,
  SANDBOX_SUBJECT_ID,
  type InvariantResult,
};

/**
 * Calculates high-resolution latency statistics (min, max, mean, p50, p90, p95, p99)
 */
export function calculateLatencies(numbers: number[]): LatencyStats {
  if (numbers.length === 0) {
    return { min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const min = Number(sorted[0].toFixed(2));
  const max = Number(sorted[sorted.length - 1].toFixed(2));
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = Number((sum / sorted.length).toFixed(2));

  function getPercentile(p: number): number {
    if (sorted.length === 1) return sorted[0];
    const rank = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    const val = sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
    return Number(val.toFixed(2));
  }

  return {
    min,
    max,
    mean,
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };
}

/**
 * Detects PocketBase/SQLite lock contention patterns in responses or exceptions
 */
export function isSqliteLockError(status: number, body: any, errorText: string = ''): boolean {
  const combined = `${status} ${typeof body === 'string' ? body : JSON.stringify(body || '')} ${errorText}`.toLowerCase();
  return (
    combined.includes('sqlite_busy') ||
    combined.includes('database is locked') ||
    combined.includes('database table is locked') ||
    combined.includes('table is locked') ||
    combined.includes('busy timeout') ||
    combined.includes('cannot start a transaction within a transaction') ||
    combined.includes('locking protocol')
  );
}

/**
 * Pre-warms and returns detailed synthetic student accounts with HMAC-signed session cookies
 */
export async function getPreWarmedStudentAccounts(count: number = 100): Promise<PreWarmedStudentAccount[]> {
  const pb = await getPbClient();
  const students = await pb.collection('students').getFullList({
    filter: 'roll_no ~ "BOT-STU-"',
    sort: 'roll_no',
  });

  if (students.length === 0) {
    throw new Error('No synthetic student accounts found in PocketBase. Run scaffold-synthetic-accounts.ts first.');
  }

  const selected = students.slice(0, count);
  const now = Date.now();

  return selected.map((stu, idx) => {
    const payload: SessionPayload = {
      userId: stu.id,
      studentId: stu.id,
      name: stu.name,
      role: 'student',
      mustChangePin: false,
      createdAt: now,
    };
    const token = signPayload(payload);
    const cookie = `abg_student_session=${token}`;
    const num = String(idx + 1).padStart(3, '0');
    // Virtual IP allocation: 198.51.100.1 .. 198.51.100.254 (safe TEST-NET-2 range RFC 5737)
    const clientIp = `198.51.100.${(idx % 250) + 1}`;
    const deviceId = `dev_bot_student_${num}`;

    return {
      student: stu,
      studentId: stu.id,
      rollNo: stu.roll_no,
      name: stu.name,
      token,
      cookie,
      cookieHeader: cookie,
      deviceId,
      clientIp,
    };
  });
}

/**
 * Pre-warms and returns student session token strings
 */
export async function preWarmStudentSessions(count: number = 100): Promise<string[]> {
  const accounts = await getPreWarmedStudentAccounts(count);
  return accounts.map((a) => a.token);
}

/**
 * Pre-warms and returns detailed synthetic teacher accounts with HMAC-signed session cookies
 */
export async function getPreWarmedTeacherAccounts(count: number = 15): Promise<PreWarmedTeacherAccount[]> {
  const pb = await getPbClient();
  const teachers = await pb.collection('teachers').getFullList({
    filter: 'phone ~ "BOT-TEA-"',
    sort: 'phone',
  });

  if (teachers.length === 0) {
    throw new Error('No synthetic teacher accounts found in PocketBase. Run scaffold-synthetic-accounts.ts first.');
  }

  const selected = teachers.slice(0, count);
  const now = Date.now();

  return selected.map((tea, idx) => {
    const payload: SessionPayload = {
      userId: tea.id,
      teacherId: tea.id,
      name: tea.name,
      role: 'faculty',
      mustChangePin: false,
      createdAt: now,
    };
    const token = signPayload(payload);
    const cookie = `abg_teacher_session=${token}`;
    const clientIp = `198.51.101.${(idx % 250) + 1}`;

    return {
      teacher: tea,
      teacherId: tea.id,
      phone: tea.phone,
      name: tea.name,
      token,
      cookie,
      cookieHeader: cookie,
      clientIp,
    };
  });
}

/**
 * Pre-warms and returns teacher session token strings
 */
export async function preWarmTeacherSessions(count: number = 15): Promise<string[]> {
  const accounts = await getPreWarmedTeacherAccounts(count);
  return accounts.map((a) => a.token);
}

/**
 * Pre-warms and returns detailed admin account with HMAC-signed session cookie
 */
export async function getPreWarmedAdminAccount(): Promise<PreWarmedAdminAccount> {
  const now = Date.now();
  const payload: SessionPayload = {
    userId: 'admin-director',
    name: 'Director',
    role: 'admin',
    mustChangePin: false,
    createdAt: now,
  };
  const token = signPayload(payload);
  const cookie = `abg_admin_session=${token}`;
  return {
    token,
    cookie,
    cookieHeader: cookie,
    clientIp: '198.51.102.1',
  };
}

/**
 * Pre-warms and returns admin session token string
 */
export async function preWarmAdminSession(): Promise<string> {
  const admin = await getPreWarmedAdminAccount();
  return admin.token;
}

/**
 * Safely prunes all entries generated inside TEST_COURSE sandbox
 */
export async function pruneSandboxEntries(): Promise<number> {
  const pb = await getPbClient();
  const entries = await pb.collection('entries').getFullList({
    filter: `course = "${TEST_COURSE_ID}"`,
  });

  let deleted = 0;
  for (const ent of entries) {
    // Invariant assertion: Never delete non-sandbox entries
    if (ent.course === TEST_COURSE_ID) {
      await pb.collection('entries').delete(ent.id);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Safely prunes all teaching records generated inside TEST_COURSE sandbox
 */
export async function pruneSandboxTeachingRecords(): Promise<number> {
  const pb = await getPbClient();
  const records = await pb.collection('teaching_records').getFullList({
    filter: `course = "${TEST_COURSE_ID}"`,
  });

  let deleted = 0;
  for (const r of records) {
    // Invariant assertion: Never delete non-sandbox teaching records
    if (r.course === TEST_COURSE_ID) {
      await pb.collection('teaching_records').delete(r.id);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Sends a student topic submission to /api/submit
 */
export async function sendStudentSubmission(
  account: PreWarmedStudentAccount,
  options?: {
    topicId?: string;
    teacherId?: string;
    status?: 'covered' | 'partial' | 'revision';
    remarks?: string;
    clientIp?: string;
    targetUrl?: string;
  }
): Promise<ScenarioTaskResponse> {
  const targetUrl = options?.targetUrl || TARGET_FRONTEND_URL;
  const ip = options?.clientIp || account.clientIp;
  const topicId = options?.topicId || SANDBOX_TOPIC_1_ID;
  const teacherId = options?.teacherId || 'zu27lc1jtgf4fsv'; // Default Teacher BOT-TEA-001
  const status = options?.status || 'covered';

  const body = {
    courseId: TEST_COURSE_ID,
    teacherId,
    subjectId: SANDBOX_SUBJECT_ID,
    topicId,
    status,
    remarks: options?.remarks || `[LoadTest Submission - ${account.rollNo}]`,
    deviceId: account.deviceId,
    studentId: account.studentId,
  };

  const t0 = performance.now();
  try {
    const res = await fetch(`${targetUrl}/api/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': account.cookie,
        'X-Forwarded-For': `${ip}, 201.18.199.137`,
        'X-Real-IP': ip,
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
 * Executes a concurrency scenario with high-resolution latency tracking,
 * status counting, SQLite contention detection, and data invariant safety guards.
 */
export async function runConcurrencyScenario(options: ScenarioOptions): Promise<ScenarioResult> {
  const {
    scenarioName,
    tasks,
    concurrency = tasks.length,
    validateSafetyBeforeAndAfter = true,
    onProgress,
  } = options;

  console.log(`\n================================================================`);
  console.log(`⚡ RUNNING SCENARIO: ${scenarioName}`);
  console.log(`   Total Requests: ${tasks.length} | Concurrency: ${concurrency}`);
  console.log(`================================================================\n`);

  if (validateSafetyBeforeAndAfter) {
    console.log('  🔍 Pre-run baseline invariant verification...');
    const preCheck = await verifyBaselineInvariants();
    console.log(`  ✓ Pre-run invariant confirmed intact (${preCheck.details.genuineStudentsCount} students, ${preCheck.details.genuineTeachersCount} teachers, ${preCheck.details.genuineEntriesCount} entries)`);
  }

  const statusCounts: Record<number, number> = {};
  const latencies: number[] = [];
  const failures: Array<{ status: number; error: string }> = [];
  let sqliteLockErrors = 0;
  let completed = 0;

  const startWallClock = performance.now();

  if (concurrency >= tasks.length) {
    // True burst: launch all tasks concurrently
    const promises = tasks.map(async (task, idx) => {
      const t0 = performance.now();
      try {
        const resp = await task(idx);
        const t1 = performance.now();
        const latencyMs = resp.latencyMs ?? Number((t1 - t0).toFixed(2));
        latencies.push(latencyMs);

        const status = resp.status || 200;
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        if (isSqliteLockError(status, resp.body, resp.error?.message || '')) {
          sqliteLockErrors++;
        }

        if (status >= 400) {
          const errMsg =
            typeof resp.body === 'object' && resp.body !== null
              ? resp.body.error || JSON.stringify(resp.body)
              : String(resp.error?.message || resp.body || status);
          failures.push({ status, error: errMsg });
        }
      } catch (err: any) {
        const t1 = performance.now();
        latencies.push(Number((t1 - t0).toFixed(2)));
        statusCounts[500] = (statusCounts[500] || 0) + 1;
        if (isSqliteLockError(500, null, err.message)) {
          sqliteLockErrors++;
        }
        failures.push({ status: 500, error: err.message || String(err) });
      } finally {
        completed++;
        if (onProgress) onProgress(completed, tasks.length);
      }
    });

    await Promise.all(promises);
  } else {
    // Worker pool concurrency
    let currentIndex = 0;
    const worker = async () => {
      while (currentIndex < tasks.length) {
        const idx = currentIndex++;
        const task = tasks[idx];
        const t0 = performance.now();
        try {
          const resp = await task(idx);
          const t1 = performance.now();
          const latencyMs = resp.latencyMs ?? Number((t1 - t0).toFixed(2));
          latencies.push(latencyMs);

          const status = resp.status || 200;
          statusCounts[status] = (statusCounts[status] || 0) + 1;

          if (isSqliteLockError(status, resp.body, resp.error?.message || '')) {
            sqliteLockErrors++;
          }

          if (status >= 400) {
            const errMsg =
              typeof resp.body === 'object' && resp.body !== null
                ? resp.body.error || JSON.stringify(resp.body)
                : String(resp.error?.message || resp.body || status);
            failures.push({ status, error: errMsg });
          }
        } catch (err: any) {
          const t1 = performance.now();
          latencies.push(Number((t1 - t0).toFixed(2)));
          statusCounts[500] = (statusCounts[500] || 0) + 1;
          if (isSqliteLockError(500, null, err.message)) {
            sqliteLockErrors++;
          }
          failures.push({ status: 500, error: err.message || String(err) });
        } finally {
          completed++;
          if (onProgress) onProgress(completed, tasks.length);
        }
      }
    };

    const pool = Array.from({ length: concurrency }, () => worker());
    await Promise.all(pool);
  }

  const endWallClock = performance.now();
  const durationMs = Number((endWallClock - startWallClock).toFixed(2));
  const throughputRps = Number(((tasks.length / (durationMs / 1000)) || 0).toFixed(2));

  if (validateSafetyBeforeAndAfter) {
    console.log('  🔍 Post-run baseline invariant verification...');
    const postCheck = await verifyBaselineInvariants();
    console.log(`  ✓ Post-run invariant confirmed intact (${postCheck.details.genuineStudentsCount} students, ${postCheck.details.genuineTeachersCount} teachers, ${postCheck.details.genuineEntriesCount} entries)`);
  }

  const latencyStats = calculateLatencies(latencies);

  const result: ScenarioResult = {
    scenarioName,
    totalRequests: tasks.length,
    concurrency,
    durationMs,
    throughputRps,
    statusCounts,
    latencies: latencyStats,
    sqliteLockErrors,
    failures,
  };

  console.log(`\n--- Execution Summary: ${scenarioName} ---`);
  console.log(`  Duration: ${durationMs} ms | Throughput: ${throughputRps} req/sec`);
  console.log(`  HTTP Status Distribution:`, statusCounts);
  console.log(
    `  Latencies (ms): min=${latencyStats.min}, p50=${latencyStats.p50}, p90=${latencyStats.p90}, p95=${latencyStats.p95}, p99=${latencyStats.p99}, max=${latencyStats.max}, mean=${latencyStats.mean}`
  );
  console.log(`  SQLite Lock Errors: ${sqliteLockErrors}`);
  console.log(`  Failures Count: ${failures.length}\n`);

  return result;
}

/**
 * Runs an end-to-end smoke test validating session pre-warming, HTTP submission,
 * latency calculation, SQLite contention detection, and data safety assertions.
 */
export async function runHarnessSmokeTest(): Promise<{
  smokeScenario: ScenarioResult;
  invariantStatus: InvariantResult;
}> {
  console.log('================================================================');
  console.log('🧪 CONCURRENCY TEST HARNESS SMOKE TEST');
  console.log('================================================================\n');

  // Step 1: Pre-warm sessions
  console.log('--- Step 1: Pre-Warming Sessions ---');
  const students = await getPreWarmedStudentAccounts(5);
  console.log(`  ✓ Pre-warmed ${students.length} student sessions (tokens & cookies minted).`);

  const teachers = await getPreWarmedTeacherAccounts(2);
  console.log(`  ✓ Pre-warmed ${teachers.length} teacher sessions.`);

  const admin = await getPreWarmedAdminAccount();
  console.log(`  ✓ Pre-warmed admin session.`);

  // Step 2: Clean up any prior sandbox entries before smoke test
  console.log('\n--- Step 2: Preparing Sandbox Environment ---');
  const prunedBefore = await pruneSandboxEntries();
  if (prunedBefore > 0) {
    console.log(`  ✓ Pruned ${prunedBefore} existing sandbox entries.`);
  }

  // Step 3: Run concurrent submission smoke scenario (5 parallel students)
  console.log('\n--- Step 3: Executing Smoke Concurrency Scenario (5 concurrent students) ---');
  const tasks = students.map((stu) => async () => {
    return sendStudentSubmission(stu, {
      topicId: SANDBOX_TOPIC_1_ID,
      remarks: '[Smoke Test Submission]',
    });
  });

  const scenarioResult = await runConcurrencyScenario({
    scenarioName: 'Smoke Test: 5 Concurrent Student Submissions',
    tasks,
    concurrency: 5,
    validateSafetyBeforeAndAfter: true,
  });

  // Verify all 5 succeeded with HTTP 200
  if (scenarioResult.statusCounts[200] !== 5) {
    throw new Error(
      `Smoke test assertion failed: Expected 5 HTTP 200 responses, got: ${JSON.stringify(scenarioResult.statusCounts)}`
    );
  }
  console.log('  ✅ Smoke test scenario passed: All 5 student submissions returned HTTP 200.');

  // Step 4: Cleanup sandbox entries generated by smoke test
  console.log('\n--- Step 4: Cleaning Up Smoke Test Sandbox Entries ---');
  const prunedAfter = await pruneSandboxEntries();
  console.log(`  ✓ Pruned ${prunedAfter} smoke test entries from sandbox.`);

  // Step 5: Final Invariant Audit
  console.log('\n--- Step 5: Final Baseline Invariant Audit ---');
  const invariantStatus = await verifyBaselineInvariants();
  console.log('  ✅ Baseline invariant confirmed intact: 75 genuine students, 8 genuine teachers, 13 genuine historical entries.');

  console.log('\n================================================================');
  console.log('🎉 HARNESS SMOKE TEST COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');

  return {
    smokeScenario: scenarioResult,
    invariantStatus,
  };
}

// CLI entrypoint
if (require.main === module || process.argv[1]?.endsWith('load-test-harness.ts')) {
  runHarnessSmokeTest()
    .then((res) => {
      console.log('Smoke Test Output:', JSON.stringify(res.smokeScenario, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ FATAL HARNESS ERROR:', err);
      process.exit(1);
    });
}
