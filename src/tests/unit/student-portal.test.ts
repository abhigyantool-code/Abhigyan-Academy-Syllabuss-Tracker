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
import { sanitizeStudentsForSubmit } from '../../lib/submit-data';

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

  describe('Student Submission Dropdown Roster & Security Invariant (sanitizeStudentsForSubmit)', () => {
    const rawStudents = [
      {
        id: 'stu_010',
        roll_no: 'NDA-10',
        name: 'Rohan Sharma',
        active: true,
        pin: '1234',
        pin_hash: 'scrypt$secret_hash_10',
      },
      {
        id: 'stu_002',
        roll_no: 'NDA-2',
        name: 'Mafruza Rahman',
        active: true,
        pin: '',
        pin_hash: 'scrypt$secret_hash_02',
      },
      {
        id: 'stu_inactive',
        roll_no: 'NDA-1',
        name: 'Inactive Cadet',
        active: false,
        pin: '9999',
        pin_hash: 'scrypt$secret_hash_01',
      },
    ];

    const rawEnrollments = [
      { student: 'stu_002', course: 'course_nda' },
      { student: 'stu_002', course: 'course_cds' },
      { student: 'stu_010', course: 'course_nda' },
      { student: 'stu_inactive', course: 'course_nda' },
    ];

    it('should include only active students sorted naturally by roll_no', () => {
      const sanitized = sanitizeStudentsForSubmit(rawStudents, rawEnrollments);
      assert.equal(sanitized.length, 2);
      assert.equal(sanitized[0].id, 'stu_002');
      assert.equal(sanitized[0].roll_no, 'NDA-2');
      assert.equal(sanitized[0].name, 'Mafruza Rahman');
      assert.equal(sanitized[1].id, 'stu_010');
      assert.equal(sanitized[1].roll_no, 'NDA-10');
    });

    it('should map enrolled courseIds accurately for multi-course filtering', () => {
      const sanitized = sanitizeStudentsForSubmit(rawStudents, rawEnrollments);
      assert.deepEqual(sanitized[0].courseIds, ['course_nda', 'course_cds']);
      assert.deepEqual(sanitized[1].courseIds, ['course_nda']);
    });

    it('should strictly strip pin and pin_hash from client student objects', () => {
      const sanitized = sanitizeStudentsForSubmit(rawStudents, rawEnrollments);
      const serialized = JSON.stringify(sanitized);
      assert.equal(serialized.includes('pin'), false);
      assert.equal(serialized.includes('secret_hash'), false);
      for (const s of sanitized) {
        assert.equal('pin' in s, false);
        assert.equal('pin_hash' in s, false);
      }
    });
  });
});
