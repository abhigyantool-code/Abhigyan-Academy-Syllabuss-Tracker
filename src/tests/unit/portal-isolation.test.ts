import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateAccess } from '../../lib/auth-guard';
import { signPayload, verifyPayload, SessionPayload } from '../../lib/session';

describe('Portal Separation & Role Isolation Tests', () => {
  const studentSession = {
    userId: 'std_001',
    role: 'student',
    studentId: 'std_001',
  };

  const facultySession = {
    userId: 'tea_001',
    role: 'faculty',
    teacherId: 'tea_001',
  };

  const adminSession = {
    userId: 'admin_root',
    role: 'admin',
  };

  describe('1. Student Portal Isolation', () => {
    it('should redirect unauthenticated access to /student to /student/login', () => {
      const result = evaluateAccess('student', null);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/student/login');
    });

    it('should allow authenticated student to access student portal', () => {
      const result = evaluateAccess('student', studentSession);
      assert.strictEqual(result.allowed, true);
    });

    it('should block student from accessing teacher workspace (/teacher) and redirect to /teacher/login', () => {
      const result = evaluateAccess('faculty', studentSession);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/teacher/login');
    });

    it('should block student from accessing Director Console (/admin) and redirect to /admin/login', () => {
      const result = evaluateAccess('admin', studentSession);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/admin/login');
    });

    it('should block student from accessing Executive Dashboard (/dashboard) and redirect to /teacher/login', () => {
      const result = evaluateAccess('dashboard', studentSession);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/teacher/login');
    });
  });

  describe('2. Teacher Portal Isolation', () => {
    it('should redirect unauthenticated access to /teacher to /teacher/login', () => {
      const result = evaluateAccess('faculty', null);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/teacher/login');
    });

    it('should allow authenticated teacher to access teacher workspace', () => {
      const result = evaluateAccess('faculty', facultySession);
      assert.strictEqual(result.allowed, true);
    });

    it('should allow authenticated teacher to access Executive Performance Dashboard (/dashboard)', () => {
      const result = evaluateAccess('dashboard', facultySession);
      assert.strictEqual(result.allowed, true);
    });

    it('should block teacher from accessing Student Portal (/student) and redirect to /student/login', () => {
      const result = evaluateAccess('student', facultySession);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/student/login');
    });

    it('should block teacher from accessing Director Console (/admin) and redirect to /admin/login', () => {
      const result = evaluateAccess('admin', facultySession);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/admin/login');
    });
  });

  describe('3. Director / Admin Governance Access', () => {
    it('should redirect unauthenticated access to /admin to /admin/login', () => {
      const result = evaluateAccess('admin', null);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/admin/login');
    });

    it('should allow Director/Admin to access Director Console (/admin)', () => {
      const result = evaluateAccess('admin', adminSession);
      assert.strictEqual(result.allowed, true);
    });

    it('should allow Director/Admin to access Executive Performance Dashboard (/dashboard)', () => {
      const result = evaluateAccess('dashboard', adminSession);
      assert.strictEqual(result.allowed, true);
    });

    it('should allow Director/Admin to access Student Portal (/student)', () => {
      const result = evaluateAccess('student', adminSession);
      assert.strictEqual(result.allowed, true);
    });

    it('should allow Director/Admin to access Faculty Workspace (/teacher)', () => {
      const result = evaluateAccess('faculty', adminSession);
      assert.strictEqual(result.allowed, true);
    });
  });

  describe('4. Multi-Area Role Array Authorization (BUG-035)', () => {
    it('should allow student only if student area is in allowed list', () => {
      assert.strictEqual(evaluateAccess(['faculty', 'admin'], studentSession).allowed, false);
      assert.strictEqual(evaluateAccess(['student', 'admin'], studentSession).allowed, true);
    });

    it('should allow faculty only if faculty or dashboard area is in allowed list', () => {
      assert.strictEqual(evaluateAccess(['student'], facultySession).allowed, false);
      assert.strictEqual(evaluateAccess(['faculty'], facultySession).allowed, true);
      assert.strictEqual(evaluateAccess(['dashboard'], facultySession).allowed, true);
    });

    it('should allow admin in all operational area combinations', () => {
      assert.strictEqual(evaluateAccess(['admin'], adminSession).allowed, true);
      assert.strictEqual(evaluateAccess(['faculty', 'dashboard'], adminSession).allowed, true);
      assert.strictEqual(evaluateAccess(['student'], adminSession).allowed, true);
    });

    it('should reject unauthenticated access for any restricted area array and redirect to /login', () => {
      const result = evaluateAccess(['faculty', 'admin'], null);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.redirectUrl, '/login');
    });
  });

  describe('5. Cryptographic Role Integrity & Session Protection', () => {
    it('should create and verify valid student session token', () => {
      const token = signPayload({
        userId: 'std_001',
        role: 'student',
        name: 'Cadet Ramesh',
        studentId: 'std_001',
        createdAt: Date.now(),
      });

      const verified = verifyPayload(token);
      assert.notStrictEqual(verified, null);
      assert.strictEqual(verified?.role, 'student');
      assert.strictEqual(verified?.userId, 'std_001');
    });

    it('should reject tampered session payload attempting privilege escalation', () => {
      const token = signPayload({
        userId: 'std_001',
        role: 'student',
        name: 'Cadet Ramesh',
        studentId: 'std_001',
        createdAt: Date.now(),
      });

      const [data, sig] = token.split('.');
      const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
      decoded.role = 'admin'; // Attacker attempts privilege escalation to admin
      const forgedData = Buffer.from(JSON.stringify(decoded)).toString('base64url');
      const forgedToken = `${forgedData}.${sig}`;

      const verified = verifyPayload(forgedToken);
      assert.strictEqual(verified, null, 'Tampered token must be rejected');
    });
  });
});
