import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  STUDENT_SESSION_COOKIE,
  TEACHER_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
  getCookieNameForRole,
  signPayload,
  verifyPayload,
  SessionPayload,
} from '../../lib/session';
import { evaluateAccess } from '../../lib/auth-guard';

describe('Isolated Session Cookies Unit Tests', () => {
  it('should map roles to distinct, isolated cookie names', () => {
    assert.strictEqual(getCookieNameForRole('student'), 'abg_student_session');
    assert.strictEqual(getCookieNameForRole('faculty'), 'abg_teacher_session');
    assert.strictEqual(getCookieNameForRole('admin'), 'abg_admin_session');

    assert.notStrictEqual(STUDENT_SESSION_COOKIE, TEACHER_SESSION_COOKIE);
    assert.notStrictEqual(STUDENT_SESSION_COOKIE, ADMIN_SESSION_COOKIE);
    assert.notStrictEqual(TEACHER_SESSION_COOKIE, ADMIN_SESSION_COOKIE);
  });

  it('should verify payloads independently for all three roles', () => {
    const studentPayload: SessionPayload = {
      userId: 'student_123',
      role: 'student',
      name: 'ZZ_TEST_STUDENT',
      studentId: 'student_123',
      createdAt: Date.now(),
    };

    const teacherPayload: SessionPayload = {
      userId: 'teacher_456',
      role: 'faculty',
      name: 'ZZ_TEST_TEACHER',
      teacherId: 'teacher_456',
      createdAt: Date.now(),
    };

    const adminPayload: SessionPayload = {
      userId: 'admin_root',
      role: 'admin',
      name: 'Director',
      createdAt: Date.now(),
    };

    const studentToken = signPayload(studentPayload);
    const teacherToken = signPayload(teacherPayload);
    const adminToken = signPayload(adminPayload);

    const verifiedStudent = verifyPayload(studentToken);
    const verifiedTeacher = verifyPayload(teacherToken);
    const verifiedAdmin = verifyPayload(adminToken);

    assert.strictEqual(verifiedStudent?.role, 'student');
    assert.strictEqual(verifiedStudent?.studentId, 'student_123');

    assert.strictEqual(verifiedTeacher?.role, 'faculty');
    assert.strictEqual(verifiedTeacher?.teacherId, 'teacher_456');

    assert.strictEqual(verifiedAdmin?.role, 'admin');
    assert.strictEqual(verifiedAdmin?.userId, 'admin_root');
  });

  it('should evaluate access correctly when separate role sessions coexist', () => {
    const studentSess = { userId: 's1', role: 'student' as const, studentId: 's1' };
    const facultySess = { userId: 't1', role: 'faculty' as const, teacherId: 't1' };
    const adminSess = { userId: 'a1', role: 'admin' as const };

    // Student route check
    assert.strictEqual(evaluateAccess('student', studentSess).allowed, true);
    assert.strictEqual(evaluateAccess('student', facultySess).allowed, false);

    // Teacher workspace check
    assert.strictEqual(evaluateAccess('faculty', facultySess).allowed, true);
    assert.strictEqual(evaluateAccess('faculty', studentSess).allowed, false);

    // Admin console check
    assert.strictEqual(evaluateAccess('admin', adminSess).allowed, true);
    assert.strictEqual(evaluateAccess('admin', facultySess).allowed, false);
    assert.strictEqual(evaluateAccess('admin', studentSess).allowed, false);

    // Shared dashboard check
    assert.strictEqual(evaluateAccess('dashboard', facultySess).allowed, true);
    assert.strictEqual(evaluateAccess('dashboard', adminSess).allowed, true);
    assert.strictEqual(evaluateAccess('dashboard', studentSess).allowed, false);
  });
});
