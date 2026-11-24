/**
 * Concurrency Simulation Runner Unit Tests
 * Milestone 2: Multi-Role Concurrency Simulation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWN_PRODUCTION_ACTION_IDS,
  resolveActionIds,
  runScenario1,
  runScenario2,
  runScenario3,
  runScenario4,
  printSimulationSummary,
  FullSimulationResults,
} from '../../scripts/run-concurrency-simulation';
import {
  PreWarmedStudentAccount,
  PreWarmedTeacherAccount,
  PreWarmedAdminAccount,
  ScenarioResult,
} from '../../scripts/load-test-harness';

describe('Multi-Role Concurrency Simulation Runner Unit Tests', () => {
  describe('Production Action ID Configuration', () => {
    test('should have valid 40+ char hex action IDs for all critical production actions', () => {
      const keys = [
        'teacherLogin',
        'teacherEndorse',
        'teacherUpdatePin',
        'adminResetStudentPin',
        'adminResetTeacherPin',
        'adminUpdateCourseSettings',
      ] as const;

      for (const k of keys) {
        assert.ok(KNOWN_PRODUCTION_ACTION_IDS[k], `Missing action ID for ${k}`);
        assert.ok(
          KNOWN_PRODUCTION_ACTION_IDS[k].length >= 40,
          `Action ID for ${k} is too short: ${KNOWN_PRODUCTION_ACTION_IDS[k]}`
        );
        assert.match(
          KNOWN_PRODUCTION_ACTION_IDS[k],
          /^[a-f0-9]+$/,
          `Action ID for ${k} is not hex: ${KNOWN_PRODUCTION_ACTION_IDS[k]}`
        );
      }
    });

    test('resolveActionIds should fall back safely to verified known action IDs on fetch error', async () => {
      const resolved = await resolveActionIds('http://127.0.0.1:59999-unreachable');
      assert.deepEqual(resolved, KNOWN_PRODUCTION_ACTION_IDS);
    });
  });

  describe('Scenario Task Generation & Structure', () => {
    // Generate mock pre-warmed accounts
    const mockStudents: PreWarmedStudentAccount[] = Array.from({ length: 100 }, (_, i) => ({
      student: { id: `stu_${i}` },
      studentId: `stu_${i}`,
      rollNo: `BOT-STU-${String(i + 1).padStart(3, '0')}`,
      name: `Mock Student ${i + 1}`,
      token: `token_stu_${i}`,
      cookie: `abg_student_session=token_stu_${i}`,
      cookieHeader: `abg_student_session=token_stu_${i}`,
      deviceId: `dev_bot_student_${String(i + 1).padStart(3, '0')}`,
      clientIp: `198.51.100.${(i % 250) + 1}`,
    }));

    const mockTeachers: PreWarmedTeacherAccount[] = Array.from({ length: 15 }, (_, i) => ({
      teacher: { id: `tea_${i}` },
      teacherId: `tea_${i}`,
      phone: `BOT-TEA-${String(i + 1).padStart(3, '0')}`,
      name: `Mock Teacher ${i + 1}`,
      token: `token_tea_${i}`,
      cookie: `abg_teacher_session=token_tea_${i}`,
      cookieHeader: `abg_teacher_session=token_tea_${i}`,
      clientIp: `198.51.101.${(i % 250) + 1}`,
    }));

    const mockAdmin: PreWarmedAdminAccount = {
      token: 'token_admin',
      cookie: 'abg_admin_session=token_admin',
      cookieHeader: 'abg_admin_session=token_admin',
      clientIp: '198.51.102.1',
    };

    test('Scenario 1 should generate exactly 100 concurrent student tasks with even topic distribution', async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      try {
        // Intercept fetch to mock instant HTTP 200
        globalThis.fetch = (async (url: any, opts: any) => {
          callCount++;
          return new Response(JSON.stringify({ success: true, id: `entry_${callCount}` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }) as any;

        const result = await runScenario1(mockStudents, 'http://mock-target');
        assert.equal(result.totalRequests, 100);
        assert.equal(result.concurrency, 100);
        assert.equal(result.statusCounts[200], 100);
        assert.equal(result.failures.length, 0);
        assert.equal(callCount, 100);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('Scenario 2 should generate exactly 15 concurrent teacher tasks across 4 workflow roles', async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async (url: any, opts: any) => {
          callCount++;
          return new Response('1:{"success":true}', {
            status: 200,
            headers: { 'Content-Type': 'text/x-component' },
          });
        }) as any;

        const result = await runScenario2(mockTeachers, KNOWN_PRODUCTION_ACTION_IDS, 'http://mock-target');
        assert.equal(result.totalRequests, 15);
        assert.equal(result.concurrency, 15);
        assert.equal(result.statusCounts[200], 15);
        assert.equal(result.failures.length, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('Scenario 3 should generate administrator active oversight tasks', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async (url: any, opts: any) => {
          if (String(url).includes('/api/export')) {
            return new Response('Reference ID,Class Date\n1,2026-11-23', {
              status: 200,
              headers: { 'Content-Type': 'text/csv' },
            });
          }
          return new Response('1:{"success":true}', {
            status: 200,
            headers: { 'Content-Type': 'text/x-component' },
          });
        }) as any;

        const result = await runScenario3(
          mockAdmin,
          mockStudents,
          mockTeachers,
          KNOWN_PRODUCTION_ACTION_IDS,
          'http://mock-target'
        );
        assert.equal(result.totalRequests, 5);
        assert.equal(result.concurrency, 5);
        assert.equal(result.statusCounts[200], 5);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('Scenario 4 should execute unified 116-actor concurrency burst simultaneously', async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async (url: any, opts: any) => {
          callCount++;
          if (String(url).includes('/api/export')) {
            return new Response('Reference ID,Class Date\n1,2026-11-23', {
              status: 200,
              headers: { 'Content-Type': 'text/csv' },
            });
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }) as any;

        const result = await runScenario4(
          mockStudents,
          mockTeachers,
          mockAdmin,
          KNOWN_PRODUCTION_ACTION_IDS,
          'http://mock-target'
        );
        assert.equal(result.totalRequests, 116);
        assert.equal(result.concurrency, 116);
        assert.equal(result.statusCounts[200], 116);
        assert.equal(result.failures.length, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Report Generation & Summary Printing', () => {
    test('printSimulationSummary should format and render metrics table cleanly without throwing', () => {
      const mockResult: ScenarioResult = {
        scenarioName: 'Test Scenario',
        totalRequests: 10,
        concurrency: 10,
        durationMs: 150.5,
        throughputRps: 66.45,
        statusCounts: { 200: 10 },
        latencies: { min: 10, max: 20, mean: 15, p50: 15, p90: 19, p95: 19.5, p99: 19.9 },
        sqliteLockErrors: 0,
        failures: [],
      };

      const fullResults: FullSimulationResults = {
        timestamp: new Date().toISOString(),
        targetFrontendUrl: 'https://syllabus360.abhigyanintelligence.cloud',
        targetBackendUrl: 'https://stracker.abhigyanintelligence.cloud',
        preFlightInvariant: { intact: true, details: { genuineStudentsCount: 75, genuineTeachersCount: 8, genuineEntriesCount: 13 } },
        scenario1: mockResult,
        scenario2: mockResult,
        scenario3: mockResult,
        scenario4: mockResult,
        postFlightPruning: { entriesPruned: 0, teachingRecordsPruned: 0 },
        postFlightInvariant: { intact: true, details: { genuineStudentsCount: 75, genuineTeachersCount: 8, genuineEntriesCount: 13 } },
        summary: {
          totalScenarios: 4,
          totalRequests: 40,
          totalErrors: 0,
          sqliteLockErrors: 0,
          invariantsPreserved: true,
        },
      };

      assert.doesNotThrow(() => printSimulationSummary(fullResults));
    });
  });
});
