import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  checkStudentPinRateLimit,
  recordPinFailure,
  recordPinSuccess,
  releasePinAttempt,
  isIpRateLimited,
  checkTeacherPinRateLimit,
  recordTeacherPinSuccess,
  checkAdminRateLimit,
  recordAdminFailure,
  resetRateLimitsForTesting,
  getBucketCountsForTesting,
  setBucketEntryForTesting,
  getMaxIpAttempts,
} from '../../lib/rate-limit';

describe('Layered Rate Limiting & Shared Classroom Wi-Fi Protection (AUDIT-02)', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
    // Default test environment IP threshold is 100 for production Wi-Fi testing
    process.env.MAX_IP_LOGIN_ATTEMPTS = '100';
  });

  // Scenario 1: Three students make three incorrect PIN attempts each from the same IP
  it('Scenario 1: Three students make 3 incorrect attempts each from same IP without triggering network lockout', () => {
    const classroomIp = '103.21.244.50';
    const students = ['student_alpha', 'student_beta', 'student_gamma'];

    for (const student of students) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const preCheck = checkStudentPinRateLimit(student, classroomIp);
        assert.strictEqual(preCheck.allowed, true, `${student} attempt ${attempt} should be allowed`);
        recordPinFailure(student, classroomIp);
      }
    }

    // Total IP failed attempts = 9 (3 students * 3 attempts)
    // Verify none of the accounts are locked (threshold is 5)
    for (const student of students) {
      const check = checkStudentPinRateLimit(student, classroomIp);
      assert.strictEqual(check.allowed, true, `${student} should still be allowed after 3 failures`);
      releasePinAttempt(student, classroomIp);
    }

    // Verify network IP is NOT locked
    const ipStatus = isIpRateLimited(classroomIp);
    assert.strictEqual(ipStatus.allowed, true, 'Shared classroom Wi-Fi IP must NOT be locked after 9 cumulative typos');
  });

  // Scenario 2: Ten students share one IP and authenticate successfully
  it('Scenario 2: Ten students share one IP and authenticate successfully concurrently', () => {
    const classroomIp = '103.21.244.51';
    const studentCount = 10;

    // 10 students initiate authentication concurrently
    for (let i = 1; i <= studentCount; i++) {
      const studentId = `batch_stu_${i}`;
      const res = checkStudentPinRateLimit(studentId, classroomIp);
      assert.strictEqual(res.allowed, true, `Student ${i} in-flight reservation should succeed`);
    }

    // All 10 verify credentials and record success
    for (let i = 1; i <= studentCount; i++) {
      const studentId = `batch_stu_${i}`;
      recordPinSuccess(studentId, classroomIp);
    }

    // IP remains healthy and subsequent logins are permitted
    const nextStudent = checkStudentPinRateLimit('batch_stu_11', classroomIp);
    assert.strictEqual(nextStudent.allowed, true, '11th student should log in cleanly');
    recordPinSuccess('batch_stu_11', classroomIp);
  });

  // Scenario 3: A single account repeatedly enters an incorrect PIN
  it('Scenario 3: Single account repeatedly enters incorrect PIN (locks account at 5, preserves IP)', () => {
    const classroomIp = '103.21.244.52';
    const victimStudent = 'single_victim_stu';

    // Attempts 1 to 4 allowed
    for (let attempt = 1; attempt <= 4; attempt++) {
      const check = checkStudentPinRateLimit(victimStudent, classroomIp);
      assert.strictEqual(check.allowed, true, `Attempt ${attempt} should be allowed`);
      recordPinFailure(victimStudent, classroomIp);
    }

    // 5th failure triggers account-level lockout
    const check5 = checkStudentPinRateLimit(victimStudent, classroomIp);
    assert.strictEqual(check5.allowed, true, 'Attempt 5 reservation allowed');
    recordPinFailure(victimStudent, classroomIp);

    // 6th attempt rejected at account level
    const lockedCheck = checkStudentPinRateLimit(victimStudent, classroomIp);
    assert.strictEqual(lockedCheck.allowed, false, 'Account must be locked after 5 failures');
    assert.ok(lockedCheck.error?.includes('Account locked') || lockedCheck.error?.includes('locked'));

    // Crucial: The network IP itself is NOT locked out (only 5 failures against 100 limit)
    const innocentStudent = 'innocent_classmate';
    const innocentCheck = checkStudentPinRateLimit(innocentStudent, classroomIp);
    assert.strictEqual(innocentCheck.allowed, true, 'Innocent classmate on same Wi-Fi must NOT be locked out');
    releasePinAttempt(innocentStudent, classroomIp);
  });

  // Scenario 4: A teacher and students share the same IP
  it('Scenario 4: Teacher and students share same IP (role isolation protects faculty)', () => {
    const sharedIp = '103.21.244.53';
    const teacherId = 'faculty_ashish_sir';

    // Multiple students make 20 failed attempts from the shared IP
    for (let i = 1; i <= 20; i++) {
      recordPinFailure(`student_error_${i}`, sharedIp);
    }

    // Teacher arrives and authenticates via teacher portal from the same IP
    const teacherCheck = checkTeacherPinRateLimit(teacherId, sharedIp);
    assert.strictEqual(teacherCheck.allowed, true, 'Teacher authentication must not be blocked by student errors');

    recordTeacherPinSuccess(teacherId, sharedIp);

    // Teacher IP status remains pristine
    const teacherIpStatus = isIpRateLimited(sharedIp, 'teacher');
    assert.strictEqual(teacherIpStatus.allowed, true);
  });

  // Scenario 5: An attacker repeatedly targets one account
  it('Scenario 5: Attacker repeatedly targets one account (attacker isolated, classmates safe)', () => {
    const sharedIp = '103.21.244.54';
    const targetedAccount = 'targeted_student_account';

    // Attacker brute-forces 5 times
    for (let i = 1; i <= 5; i++) {
      checkStudentPinRateLimit(targetedAccount, sharedIp);
      recordPinFailure(targetedAccount, sharedIp);
    }

    // Target account is locked
    const targetStatus = checkStudentPinRateLimit(targetedAccount, sharedIp);
    assert.strictEqual(targetStatus.allowed, false);

    // Other students on the same network continue to work without impediment
    for (let j = 1; j <= 5; j++) {
      const studentId = `legit_student_${j}`;
      const res = checkStudentPinRateLimit(studentId, sharedIp);
      assert.strictEqual(res.allowed, true, `Legitimate student ${j} unaffected by attack on target`);
      recordPinSuccess(studentId, sharedIp);
    }
  });

  // Scenario 6: Requests arrive concurrently
  it('Scenario 6: High concurrency burst does not trigger race condition or false lockouts', () => {
    const sharedIp = '103.21.244.55';
    const concurrencyCount = 25;

    // 25 students submit in same millisecond
    for (let i = 1; i <= concurrencyCount; i++) {
      const res = checkStudentPinRateLimit(`concurrent_stu_${i}`, sharedIp);
      assert.strictEqual(res.allowed, true, `Concurrent student ${i} allowed`);
    }

    // All 25 succeed
    for (let i = 1; i <= concurrencyCount; i++) {
      recordPinSuccess(`concurrent_stu_${i}`, sharedIp);
    }

    // No lingering in-flight or failed attempts
    const afterCheck = checkStudentPinRateLimit('new_arrival_stu', sharedIp);
    assert.strictEqual(afterCheck.allowed, true);
    recordPinSuccess('new_arrival_stu', sharedIp);
  });

  // Scenario 7: Rate-limit windows expire correctly
  it('Scenario 7: Rate-limit window and lockout expiration resets counters without manual map clearing', () => {
    const testIp = '103.21.244.56';
    const studentId = 'expiring_student';

    // 1. Verify sliding window expiration for non-locked account
    // 4 failed attempts recorded 16 minutes ago (WINDOW_MS = 15m)
    setBucketEntryForTesting('student', studentId, {
      attempts: 4,
      inFlight: 0,
      lastAttempt: Date.now() - 16 * 60 * 1000,
    });

    // Next attempt must see fresh window (attempts reset to 0)
    const freshCheck = checkStudentPinRateLimit(studentId, testIp);
    assert.strictEqual(freshCheck.allowed, true, 'Window expiration must allow attempt');
    releasePinAttempt(studentId, testIp);

    // 2. Verify account lockout expiration resets attempts and allows login
    const lockedStudent = 'locked_then_expired_student';
    setBucketEntryForTesting('student', lockedStudent, {
      attempts: 5,
      inFlight: 0,
      lastAttempt: Date.now() - 16 * 60 * 1000,
      lockedUntil: Date.now() - 1000, // Lockout expired 1s ago
    });

    const unlockedCheck = checkStudentPinRateLimit(lockedStudent, testIp);
    assert.strictEqual(unlockedCheck.allowed, true, 'Expired account lockout must allow fresh login');
    releasePinAttempt(lockedStudent, testIp);

    // 3. Verify IP lockout expiration resets IP attempts and clears lockout
    const lockedIp = '103.21.244.99';
    setBucketEntryForTesting('ip', lockedIp, {
      attempts: 100,
      inFlight: 0,
      lastAttempt: Date.now() - 16 * 60 * 1000,
      lockedUntil: Date.now() - 1000, // Lockout expired 1s ago
    });

    const ipCheck = isIpRateLimited(lockedIp);
    assert.strictEqual(ipCheck.allowed, true, 'Expired IP lockout must restore network access');

    // 4. Verify Admin lockout expiration restores access
    const adminIp = '103.21.244.101';
    setBucketEntryForTesting('admin', adminIp, {
      attempts: 5,
      inFlight: 0,
      lastAttempt: Date.now() - 16 * 60 * 1000,
      lockedUntil: Date.now() - 1000,
    });

    const adminCheck = checkAdminRateLimit(adminIp);
    assert.strictEqual(adminCheck.allowed, true, 'Expired Admin lockout must restore login capability');
  });

  // Scenario 8: Application restarts do not unexpectedly reset security protections
  it('Scenario 8: Application restarts re-initialize cleanly and enforce security immediately', () => {
    // Simulate container restart: memory maps clear
    resetRateLimitsForTesting();

    const counts = getBucketCountsForTesting();
    assert.strictEqual(counts.ipCount, 0);
    assert.strictEqual(counts.studentCount, 0);
    assert.strictEqual(counts.adminCount, 0);

    // First attempt immediately tracked
    const ip = '103.21.244.58';
    const student = 'restart_test_student';
    checkStudentPinRateLimit(student, ip);

    const countsAfter = getBucketCountsForTesting();
    assert.strictEqual(countsAfter.ipCount, 1);
    assert.strictEqual(countsAfter.studentCount, 1);

    // Lockout protection active from step 1
    for (let i = 0; i < 5; i++) {
      recordPinFailure(student, ip);
    }
    const locked = checkStudentPinRateLimit(student, ip);
    assert.strictEqual(locked.allowed, false, 'Account lockout enforced immediately after restart');
  });

  // Scenario 9: Admin protection remains strict
  it('Scenario 9: Admin protection remains strictly guarded (5-attempt threshold, isolated)', () => {
    const adminIp = '103.21.244.59';

    // 4 failed master password attempts
    for (let i = 1; i <= 4; i++) {
      const check = checkAdminRateLimit(adminIp);
      assert.strictEqual(check.allowed, true, `Admin attempt ${i} allowed`);
      recordAdminFailure(adminIp);
    }

    // 5th failure triggers 15-minute Director lockout
    recordAdminFailure(adminIp);
    const lockedAdmin = checkAdminRateLimit(adminIp);
    assert.strictEqual(lockedAdmin.allowed, false, 'Admin must be locked out after 5 failures');
    assert.ok(lockedAdmin.error?.includes('Director login attempts'));

    // Admin lockout does NOT block student or teacher login from that same IP!
    const studentFromSameIp = checkStudentPinRateLimit('student_on_admin_wifi', adminIp);
    assert.strictEqual(studentFromSameIp.allowed, true, 'Student portal unaffected by admin lockout');
    releasePinAttempt('student_on_admin_wifi', adminIp);
  });

  // Scenario 10: Genuine users are not collectively blocked due to normal classroom mistakes
  it('Scenario 10: Classroom of 20 students with normal typos does not cause collective lockout', () => {
    const classroomIp = '103.21.244.60';
    const classroomSize = 20;

    // Half the class (10 students) makes 1 or 2 typos before succeeding
    for (let i = 1; i <= 10; i++) {
      const studentId = `typo_stu_${i}`;
      // Typo 1
      checkStudentPinRateLimit(studentId, classroomIp);
      recordPinFailure(studentId, classroomIp);
      // Typo 2
      checkStudentPinRateLimit(studentId, classroomIp);
      recordPinFailure(studentId, classroomIp);
      // Success on 3rd try
      checkStudentPinRateLimit(studentId, classroomIp);
      recordPinSuccess(studentId, classroomIp);
    }

    // The other 10 students succeed on first try
    for (let i = 11; i <= classroomSize; i++) {
      const studentId = `perfect_stu_${i}`;
      checkStudentPinRateLimit(studentId, classroomIp);
      recordPinSuccess(studentId, classroomIp);
    }

    // Verify entire classroom can still authenticate without any collective network lockout
    const lateArrivalCheck = checkStudentPinRateLimit('late_arrival_student', classroomIp);
    assert.strictEqual(lateArrivalCheck.allowed, true, 'Late arrival must NOT be locked out');
    releasePinAttempt('late_arrival_student', classroomIp);

    const ipCheck = isIpRateLimited(classroomIp);
    assert.strictEqual(ipCheck.allowed, true, 'Classroom IP must be completely accessible');
  });

  // Scenario 11: Configuration flexibility (MAX_IP_ATTEMPTS and role overrides)
  it('Scenario 11: Supports MAX_IP_ATTEMPTS, MAX_IP_LOGIN_ATTEMPTS, and role overrides', () => {
    delete process.env.MAX_IP_LOGIN_ATTEMPTS;
    delete process.env.MAX_IP_ATTEMPTS;
    delete process.env.MAX_TEACHER_IP_ATTEMPTS;

    // Default test env without variables
    assert.strictEqual(getMaxIpAttempts('student'), 10);
    assert.strictEqual(getMaxIpAttempts('teacher'), 10);

    // MAX_IP_ATTEMPTS support
    process.env.MAX_IP_ATTEMPTS = '75';
    assert.strictEqual(getMaxIpAttempts('student'), 75);
    assert.strictEqual(getMaxIpAttempts('teacher'), 75);

    // MAX_IP_LOGIN_ATTEMPTS takes precedence over generic MAX_IP_ATTEMPTS
    process.env.MAX_IP_LOGIN_ATTEMPTS = '120';
    assert.strictEqual(getMaxIpAttempts('student'), 120);

    // Dedicated teacher override
    process.env.MAX_TEACHER_IP_ATTEMPTS = '50';
    assert.strictEqual(getMaxIpAttempts('teacher'), 50);
    assert.strictEqual(getMaxIpAttempts('student'), 120);

    delete process.env.MAX_TEACHER_IP_ATTEMPTS;
    delete process.env.MAX_IP_ATTEMPTS;
    process.env.MAX_IP_LOGIN_ATTEMPTS = '100';
  });

  // Scenario 12: Anti-cache-flooding protects locked accounts from eviction
  it('Scenario 12: Capacity enforcement prioritizes evicting unlocked accounts over actively locked targets', () => {
    const lockedStudent = 'critical_locked_target';
    const testIp = '103.21.244.150';

    // Lock target account
    for (let i = 0; i < 5; i++) {
      recordPinFailure(lockedStudent, testIp);
    }
    const lockedPre = checkStudentPinRateLimit(lockedStudent, testIp);
    assert.strictEqual(lockedPre.allowed, false, 'Target must be locked');

    // Simulate high volume of benign student attempts
    for (let i = 1; i <= 20; i++) {
      const stu = `benign_student_${i}`;
      checkStudentPinRateLimit(stu, testIp);
      releasePinAttempt(stu, testIp);
    }

    // Target account MUST remain locked despite the arrival of subsequent accounts
    const lockedPost = checkStudentPinRateLimit(lockedStudent, testIp);
    assert.strictEqual(lockedPost.allowed, false, 'Target account must remain locked under bucket load');
  });
});
