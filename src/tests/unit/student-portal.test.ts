import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { submitEntrySchema } from '../../lib/submission-validation';
import {
  signPayload,
  verifyPayload,
  SessionPayload,
} from '../../lib/session';
import {
  checkStudentPinRateLimit,
  recordPinFailure,
  recordPinSuccess,
  resetRateLimitsForTesting,
} from '../../lib/rate-limit';
import { hashPin, verifyPinDual } from '../../lib/pin-hash';

describe('BUG-003 & BUG-017: Student Privacy & Dedicated Student Portal Tests', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
  });

  describe('Student Submission Schema & Privacy (BUG-003)', () => {
    const validSubmission = {
      courseId: 'vf69bcurjevgne6',
      teacherId: 't1234567890abcd',
      subjectId: 's1234567890abcd',
      topicId: 'p1234567890abcd',
      studentId: 'NDA-01', // Direct roll number submission supported
      pin: '1234',
      classCode: '',
      status: 'covered' as const,
      remarks: null,
      deviceId: 'dev_mobile_test_123',
      websiteUrlHp: '',
    };

    it('should accept valid submission using Roll Number directly without preloading student roster', () => {
      const result = submitEntrySchema.safeParse(validSubmission);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.studentId, 'NDA-01');
      }
    });

    it('should accept valid submission using 15-character PocketBase record ID', () => {
      const payloadWithId = { ...validSubmission, studentId: '9vg1ja7qk7gzick' };
      const result = submitEntrySchema.safeParse(payloadWithId);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.studentId, '9vg1ja7qk7gzick');
      }
    });

    it('should reject empty or blank student identifier', () => {
      const payloadEmpty = { ...validSubmission, studentId: '' };
      const result = submitEntrySchema.safeParse(payloadEmpty);
      assert.equal(result.success, false);
    });

    it('should enforce student PIN minimum length 4 and max 8', () => {
      const shortPin = { ...validSubmission, pin: '123' };
      assert.equal(submitEntrySchema.safeParse(shortPin).success, false);

      const longPin = { ...validSubmission, pin: '123456789' };
      assert.equal(submitEntrySchema.safeParse(longPin).success, false);

      const valid8 = { ...validSubmission, pin: '12345678' };
      assert.equal(submitEntrySchema.safeParse(valid8).success, true);
    });
  });

  describe('Student Authentication & Session Policy (BUG-017)', () => {
    it('should create and verify valid student session token', () => {
      const payload: SessionPayload = {
        userId: 'stu_9vg1ja7qk7gzick',
        role: 'student',
        name: 'Mafruza Rahman',
        studentId: 'stu_9vg1ja7qk7gzick',
        createdAt: Date.now(),
      };

      const token = signPayload(payload);
      const decoded = verifyPayload(token);

      assert.ok(decoded !== null);
      assert.equal(decoded?.role, 'student');
      assert.equal(decoded?.name, 'Mafruza Rahman');
      assert.equal(decoded?.studentId, 'stu_9vg1ja7qk7gzick');
    });

    it('should enforce student account lockout on repeated failed PIN attempts', () => {
      const studentId = 'stu_test_lockout';
      const ip = '192.168.1.50';

      // First 4 attempts allowed
      for (let i = 1; i <= 4; i++) {
        const check = checkStudentPinRateLimit(studentId, ip);
        assert.equal(check.allowed, true, `Attempt ${i} should be allowed`);
        recordPinFailure(studentId, ip);
      }

      // 5th attempt allowed to try
      const check5 = checkStudentPinRateLimit(studentId, ip);
      assert.equal(check5.allowed, true);
      recordPinFailure(studentId, ip);

      // 6th attempt should be locked out
      const check6 = checkStudentPinRateLimit(studentId, ip);
      assert.equal(check6.allowed, false, '6th attempt must be locked out');
      assert.match(check6.error || '', /locked/i);

      // Successful verification resets lockout
      recordPinSuccess(studentId, ip);
      const checkAfterSuccess = checkStudentPinRateLimit(studentId, ip);
      assert.equal(checkAfterSuccess.allowed, true, 'Lockout should be cleared after success');
    });

    it('should verify student credentials against scrypt hash and plaintext fallback', async () => {
      const plaintextPin = '1234';
      const hash = await hashPin(plaintextPin);

      // Dual verification against hash
      const verifiedWithHash = await verifyPinDual('1234', hash, '1234');
      assert.equal(verifiedWithHash.valid, true);
      assert.equal(verifiedWithHash.needsMigration, false);

      // Dual verification against unmigrated plaintext
      const verifiedPlaintext = await verifyPinDual('1234', null, '1234');
      assert.equal(verifiedPlaintext.valid, true);
      assert.equal(verifiedPlaintext.needsMigration, true, 'Unmigrated plaintext should flag needsMigration');

      // Reject incorrect PIN
      const wrongPin = await verifyPinDual('9999', hash, '1234');
      assert.equal(wrongPin.valid, false);
    });
  });
});
