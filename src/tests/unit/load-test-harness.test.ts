/**
 * Load Test Harness & Concurrency Utilities Unit Tests
 * Milestone 1: Test Harness & Data Scaffolding
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLatencies,
  isSqliteLockError,
  runConcurrencyScenario,
  ScenarioTaskResponse,
} from '../../scripts/load-test-harness';
import { signPayload, verifyPayload, SessionPayload } from '../../lib/session';

describe('Load Test Harness & Concurrency Utilities', () => {
  describe('High-Resolution Latency Calculation', () => {
    test('should calculate min, max, mean, p50, p90, p95, p99 accurately for uniform samples', () => {
      // 100 values from 1 to 100
      const numbers = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = calculateLatencies(numbers);

      assert.equal(stats.min, 1);
      assert.equal(stats.max, 100);
      assert.equal(stats.mean, 50.5);
      // p50 is 50.5 in linear interpolation
      assert.ok(stats.p50 >= 50 && stats.p50 <= 51);
      // p90 is 90.1
      assert.ok(stats.p90 >= 90 && stats.p90 <= 91);
      // p95 is 95.05
      assert.ok(stats.p95 >= 95 && stats.p95 <= 96);
      // p99 is 99.01
      assert.ok(stats.p99 >= 99 && stats.p99 <= 100);
    });

    test('should handle single-element array without throwing', () => {
      const stats = calculateLatencies([42]);
      assert.equal(stats.min, 42);
      assert.equal(stats.max, 42);
      assert.equal(stats.mean, 42);
      assert.equal(stats.p50, 42);
      assert.equal(stats.p90, 42);
      assert.equal(stats.p95, 42);
      assert.equal(stats.p99, 42);
    });

    test('should return zeroes for empty array', () => {
      const stats = calculateLatencies([]);
      assert.equal(stats.min, 0);
      assert.equal(stats.max, 0);
      assert.equal(stats.mean, 0);
      assert.equal(stats.p50, 0);
      assert.equal(stats.p90, 0);
      assert.equal(stats.p95, 0);
      assert.equal(stats.p99, 0);
    });
  });

  describe('SQLite Lock Contention Pattern Detection', () => {
    test('should detect SQLITE_BUSY error string', () => {
      assert.equal(isSqliteLockError(500, { message: 'SQLITE_BUSY: database is locked' }), true);
      assert.equal(isSqliteLockError(500, 'Error: SQLITE_BUSY'), true);
      assert.equal(isSqliteLockError(500, null, 'SQLITE_BUSY: database is locked'), true);
    });

    test('should detect "database is locked" variations', () => {
      assert.equal(isSqliteLockError(500, { error: 'database is locked' }), true);
      assert.equal(isSqliteLockError(500, { error: 'database table is locked' }), true);
      assert.equal(isSqliteLockError(500, 'busy timeout exceeded'), true);
    });

    test('should not trigger false positives on unrelated errors', () => {
      assert.equal(isSqliteLockError(400, { error: 'Invalid PIN provided' }), false);
      assert.equal(isSqliteLockError(404, { error: 'Record not found' }), false);
      assert.equal(isSqliteLockError(200, { success: true }), false);
      assert.equal(isSqliteLockError(409, { error: 'Duplicate entry detected' }), false);
    });
  });

  describe('Session Token Pre-Warming & Verification', () => {
    test('should pre-sign student session token that passes verification', () => {
      const payload: SessionPayload = {
        userId: 'student_bot_001',
        studentId: 'student_bot_001',
        name: 'ZZ_TEST_STUDENT',
        role: 'student',
        mustChangePin: false,
        createdAt: Date.now(),
      };

      const token = signPayload(payload);
      assert.ok(typeof token === 'string' && token.includes('.'));

      const verified = verifyPayload(token);
      assert.ok(verified !== null);
      assert.equal(verified?.userId, 'student_bot_001');
      assert.equal(verified?.role, 'student');
      assert.equal(verified?.mustChangePin, false);
    });

    test('should pre-sign teacher session token with role faculty', () => {
      const payload: SessionPayload = {
        userId: 'teacher_bot_001',
        teacherId: 'teacher_bot_001',
        name: 'ZZ_TEST_TEACHER',
        role: 'faculty',
        mustChangePin: false,
        createdAt: Date.now(),
      };

      const token = signPayload(payload);
      const verified = verifyPayload(token);
      assert.ok(verified !== null);
      assert.equal(verified?.role, 'faculty');
      assert.equal(verified?.teacherId, 'teacher_bot_001');
    });

    test('should pre-sign admin session token with role admin', () => {
      const payload: SessionPayload = {
        userId: 'admin-director',
        name: 'Director',
        role: 'admin',
        mustChangePin: false,
        createdAt: Date.now(),
      };

      const token = signPayload(payload);
      const verified = verifyPayload(token);
      assert.ok(verified !== null);
      assert.equal(verified?.role, 'admin');
    });
  });

  describe('runConcurrencyScenario Execution Engine', () => {
    test('should run simulated tasks and collect latency, status codes, and throughput', async () => {
      const mockTasks = Array.from({ length: 10 }, (_, i) => async (): Promise<ScenarioTaskResponse> => {
        // simulate async network delay
        await new Promise((r) => setTimeout(r, 10 + (i % 5)));
        if (i === 7) {
          return { status: 409, body: { error: 'Duplicate entry' } };
        }
        if (i === 9) {
          return { status: 500, body: 'SQLITE_BUSY: database is locked' };
        }
        return { status: 200, body: { success: true } };
      });

      const result = await runConcurrencyScenario({
        scenarioName: 'Unit Test Mock Concurrency Scenario',
        tasks: mockTasks,
        concurrency: 5,
        validateSafetyBeforeAndAfter: false,
      });

      assert.equal(result.totalRequests, 10);
      assert.equal(result.concurrency, 5);
      assert.ok(result.durationMs > 0);
      assert.ok(result.throughputRps > 0);

      // Verify status counts
      assert.equal(result.statusCounts[200], 8);
      assert.equal(result.statusCounts[409], 1);
      assert.equal(result.statusCounts[500], 1);

      // Verify SQLite lock detection
      assert.equal(result.sqliteLockErrors, 1);

      // Verify failures array
      assert.equal(result.failures.length, 2);
      assert.ok(result.failures.some((f) => f.status === 409));
      assert.ok(result.failures.some((f) => f.status === 500));

      // Verify latency percentiles
      assert.ok(result.latencies.min > 0);
      assert.ok(result.latencies.p50 >= result.latencies.min);
      assert.ok(result.latencies.p95 >= result.latencies.p50);
      assert.ok(result.latencies.max >= result.latencies.p95);
    });
  });
});
