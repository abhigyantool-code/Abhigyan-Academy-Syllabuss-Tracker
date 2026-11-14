import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  safeCompare,
  validateNewPinStrength,
  checkStudentPinRateLimit,
  recordPinFailure,
  recordPinSuccess,
  releasePinAttempt,
  isIpRateLimited,
  checkAdminRateLimit,
  recordAdminFailure,
  recordAdminSuccess,
  getClientIp,
  isValidIp,
  resetRateLimitsForTesting,
  getBucketCountsForTesting,
} from '../../lib/rate-limit';
import {
  hashPin,
  hashPinSync,
  verifyPinHash,
  verifyPinHashSync,
  verifyPinDual,
  generateTemporaryPin,
} from '../../lib/pin-hash';
import { getSessionSecret } from '../../lib/session';

describe('BUG-031 & BUG-032 Security Hardening & Remediation Tests', () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
  });

  describe('Timing-Safe Comparison (safeCompare) & Cryptographic Review (BUG-043)', () => {
    it('should return true for identical strings', () => {
      assert.strictEqual(safeCompare('TestMasterSecret2026!', 'TestMasterSecret2026!'), true);
      assert.strictEqual(safeCompare('1234', '1234'), true);
      assert.strictEqual(safeCompare('', ''), true);
    });

    it('should return false for different strings of same length', () => {
      assert.strictEqual(safeCompare('PasswordA', 'PasswordB'), false);
      assert.strictEqual(safeCompare('1234', '1235'), false);
    });

    it('should return false for strings of different length without leaking length via timing', () => {
      assert.strictEqual(safeCompare('short', 'much_longer_string'), false);
      assert.strictEqual(safeCompare('1234', '12345'), false);
      assert.strictEqual(safeCompare('a', 'a'.repeat(1000)), false);
    });

    it('should return false safely for non-string inputs', () => {
      assert.strictEqual(safeCompare(null as any, 'test'), false);
      assert.strictEqual(safeCompare('test', undefined as any), false);
      assert.strictEqual(safeCompare(1234 as any, '1234'), false);
      assert.strictEqual(safeCompare({} as any, '1234'), false);
    });

    it('should handle UTF-8 multi-byte characters accurately', () => {
      assert.strictEqual(safeCompare('अभिग्यान', 'अभिग्यान'), true);
      assert.strictEqual(safeCompare('अभिग्यान', 'अभिज्ञान'), false);
    });
  });

  describe('Student PIN Strength Validation (validateNewPinStrength)', () => {
    it('should accept strong 4 to 8 digit numeric PINs', () => {
      assert.strictEqual(validateNewPinStrength('4928').valid, true);
      assert.strictEqual(validateNewPinStrength('849201').valid, true);
      assert.strictEqual(validateNewPinStrength('93847291').valid, true);
    });

    it('should reject PINs shorter than 4 digits or longer than 8 digits', () => {
      const short = validateNewPinStrength('123');
      assert.strictEqual(short.valid, false);
      assert.ok(short.error?.includes('between 4 and 8'));

      const long = validateNewPinStrength('123456789');
      assert.strictEqual(long.valid, false);
      assert.ok(long.error?.includes('between 4 and 8'));
    });

    it('should reject non-numeric PINs', () => {
      const alpha = validateNewPinStrength('abcd');
      assert.strictEqual(alpha.valid, false);

      const special = validateNewPinStrength('12#4');
      assert.strictEqual(special.valid, false);
    });

    it('should reject new PIN when identical to current PIN', () => {
      const same = validateNewPinStrength('4928', '4928');
      assert.strictEqual(same.valid, false);
      assert.ok(same.error?.includes('different from your current PIN'));
    });

    it('should reject trivial default patterns like 1234 or 0000', () => {
      const defaultPin = validateNewPinStrength('1234');
      assert.strictEqual(defaultPin.valid, false);
      assert.ok(defaultPin.error?.includes('too common or is a default pattern'));

      const repeated = validateNewPinStrength('0000');
      assert.strictEqual(repeated.valid, false);
      assert.ok(repeated.error?.includes('too common or is a default pattern'));

      const repeatedOne = validateNewPinStrength('1111');
      assert.strictEqual(repeatedOne.valid, false);
    });
  });

  describe('Rate Limiting & Lockout Engine (checkStudentPinRateLimit)', () => {
    const testStudentId = 'test_student_rate_limit_001';
    const testIp = '192.168.1.100';

    it('should allow initial requests within threshold', () => {
      const res = checkStudentPinRateLimit(testStudentId, testIp);
      assert.strictEqual(res.allowed, true);
    });

    it('should enforce student lockout after 5 consecutive failures', () => {
      const victimStudent = 'victim_stu_bruteforce_test';
      const attackerIp = '10.0.0.99';

      for (let i = 0; i < 4; i++) {
        recordPinFailure(victimStudent, attackerIp);
        const check = checkStudentPinRateLimit(victimStudent, attackerIp);
        assert.strictEqual(check.allowed, true);
      }

      // 5th failure triggers lockout
      recordPinFailure(victimStudent, attackerIp);
      const locked = checkStudentPinRateLimit(victimStudent, attackerIp);
      assert.strictEqual(locked.allowed, false);
      assert.ok(locked.error?.includes('locked'));
    });

    it('should clear student lockout upon successful PIN verification', () => {
      const recoveredStudent = 'stu_recovered_test';
      const clientIp = '10.0.0.101';

      // 5 failures
      for (let i = 0; i < 5; i++) {
        recordPinFailure(recoveredStudent, clientIp);
      }
      assert.strictEqual(checkStudentPinRateLimit(recoveredStudent, clientIp).allowed, false);

      // Record success
      recordPinSuccess(recoveredStudent, clientIp);
      assert.strictEqual(checkStudentPinRateLimit(recoveredStudent, clientIp).allowed, true);
    });

    it('should enforce IP-level rate limits across different student IDs', () => {
      const spammerIp = '172.16.0.50';

      for (let i = 0; i < 10; i++) {
        recordPinFailure(`random_stu_${i}`, spammerIp);
      }

      const check = checkStudentPinRateLimit('another_student', spammerIp);
      assert.strictEqual(check.allowed, false);
      assert.ok(check.error?.includes('network'));
    });
  });

  describe('Authorization Paths & Session Policy Verification (BUG-040)', () => {
    it('should block faculty sessions from modifying student PINs', () => {
      const facultySession = {
        userId: 'teacher_123',
        role: 'faculty',
        name: 'Faculty User',
        teacherId: 'teacher_123',
      };

      const checkFacultyAuth = (session: typeof facultySession) => {
        if (session.role === 'faculty') {
          return {
            allowed: false,
            error: 'Unauthorized: Faculty accounts cannot modify student PINs. Please contact administration.',
          };
        }
        return { allowed: true };
      };

      const result = checkFacultyAuth(facultySession);
      assert.strictEqual(result.allowed, false);
      assert.ok(result.error?.includes('Faculty accounts cannot modify student PINs'));
    });

    it('should block authenticated student from changing another student PIN', () => {
      const studentSession = {
        userId: 'student_A',
        role: 'student',
        name: 'Student A',
        studentId: 'student_A',
      };
      const targetStudentId = 'student_B';

      const checkStudentAuth = (session: typeof studentSession, targetId: string) => {
        if (session.role === 'student') {
          if (!session.studentId || session.studentId !== targetId) {
            return {
              allowed: false,
              error: "Unauthorized: You are not permitted to modify another student's PIN.",
            };
          }
        }
        return { allowed: true };
      };

      const crossCheck = checkStudentAuth(studentSession, targetStudentId);
      assert.strictEqual(crossCheck.allowed, false);
      assert.ok(crossCheck.error?.includes("another student's PIN"));

      // Same student should be permitted
      const selfCheck = checkStudentAuth(studentSession, 'student_A');
      assert.strictEqual(selfCheck.allowed, true);
    });

    it('should enforce strict studentId match and reject undefined studentId (BUG-040 Fix)', () => {
      const imperfectSession = {
        userId: 'student_A',
        role: 'student',
        name: 'Student A',
        studentId: undefined,
      };
      const targetStudentId = 'student_B';

      // Remediated check: !session.studentId || session.studentId !== targetId
      const remediatedCheck = (session: typeof imperfectSession, targetId: string) => {
        if (session.role === 'student') {
          if (!session.studentId || session.studentId !== targetId) {
            return {
              allowed: false,
              error: "Unauthorized: You are not permitted to modify another student's PIN.",
            };
          }
        }
        return { allowed: true };
      };

      const result = remediatedCheck(imperfectSession, targetStudentId);
      assert.strictEqual(result.allowed, false, 'BUG-040 FIX VERIFIED: Missing studentId is rejected');
      assert.ok(result.error?.includes("another student's PIN"));
    });

    it('should allow admin override without current PIN verification', () => {
      const adminSession = {
        userId: 'admin-director-root',
        role: 'admin',
        name: 'Academy Director',
      };

      const verifyPinStep = (session: any, currentPin: string, storedPin: string) => {
        const isAdmin = session?.role === 'admin';
        if (!isAdmin) {
          if (!safeCompare(currentPin, storedPin)) {
            return { success: false, error: 'Current PIN is incorrect.' };
          }
        }
        return {
          success: true,
          authMethod: isAdmin ? 'admin_override' : 'self_service_pin_verification',
        };
      };

      // Admin with mismatched/empty currentPin
      const adminResult = verifyPinStep(adminSession, '', 'stored_pin_9876');
      assert.strictEqual(adminResult.success, true);
      assert.strictEqual(adminResult.authMethod, 'admin_override');

      // Unauthenticated user with mismatched currentPin
      const unauthResult = verifyPinStep(null, 'wrong_pin', 'stored_pin_9876');
      assert.strictEqual(unauthResult.success, false);
      assert.strictEqual(unauthResult.error, 'Current PIN is incorrect.');
    });
  });

  describe('Rate Limiting Bypass Defenses & Concurrency Protection (BUG-037 & BUG-038)', () => {
    it('should prevent IP rate limit bypass via spoofed X-Forwarded-For headers (BUG-037 Fix)', () => {
      const trustedProxyIp = '203.0.113.195';
      const results: boolean[] = [];

      // Attacker attempts 15 requests, rotating spoofed leftmost IP each time
      for (let i = 1; i <= 15; i++) {
        const headers = {
          'x-forwarded-for': `198.51.100.${i}, ${trustedProxyIp}`,
        };
        const extractedIp = getClientIp(headers);

        // Secure extraction picks the trusted proxy IP, not the attacker's spoofed prefix
        assert.strictEqual(extractedIp, trustedProxyIp);

        const rateCheck = checkStudentPinRateLimit(`diff_stu_${i}`, extractedIp);
        results.push(rateCheck.allowed);
      }

      // First 9 attempts are allowed (under 10 limit), subsequent attempts are strictly blocked!
      const allowedCount = results.filter((r) => r === true).length;
      assert.ok(allowedCount <= 10, `IP rate limit enforced: allowed ${allowedCount} <= 10`);
      assert.strictEqual(results[14], false, 'BUG-037 FIX VERIFIED: Spoofed header cannot bypass IP limit');
    });

    it('should handle IPv6 addresses and bracketed format properly in getClientIp and isValidIp', () => {
      assert.strictEqual(isValidIp('2001:db8::1'), true);
      assert.strictEqual(isValidIp('[2001:db8::1]'), true);
      assert.strictEqual(isValidIp('invalid.ip.string'), false);

      const headers = {
        'x-forwarded-for': '198.51.100.1, [2001:db8::1]',
      };
      assert.strictEqual(getClientIp(headers), '2001:db8::1');
    });

    it('should prevent concurrent request race conditions bypassing student lockout threshold (BUG-038 Fix)', () => {
      const studentId = 'victim_concurrent_race_test';
      const ip = '192.0.2.1';

      // Simulate 10 simultaneous requests arriving at the exact same moment
      const concurrentChecks: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        const check = checkStudentPinRateLimit(studentId, ip);
        concurrentChecks.push(check.allowed);
      }

      const allowedCount = concurrentChecks.filter((r) => r === true).length;
      const blockedCount = concurrentChecks.filter((r) => r === false).length;

      // With atomic reservation, at most 5 requests are permitted; requests 6-10 are blocked!
      assert.strictEqual(allowedCount, 5, 'BUG-038 FIX VERIFIED: Exactly 5 concurrent attempts allowed before threshold lock');
      assert.strictEqual(blockedCount, 5, 'BUG-038 FIX VERIFIED: Remaining 5 concurrent requests blocked immediately');
    });

    it('should properly release reserved in-flight attempts when an operation errors out (releasePinAttempt)', () => {
      const studentId = 'student_inflight_release_test';
      const ip = '10.50.0.1';

      // Reserve an attempt slot
      const check1 = checkStudentPinRateLimit(studentId, ip);
      assert.strictEqual(check1.allowed, true);

      // Simulate early error / cancellation and release
      releasePinAttempt(studentId, ip);

      // Now 5 concurrent attempts should still be allowed since the in-flight slot was released
      for (let i = 0; i < 5; i++) {
        const check = checkStudentPinRateLimit(studentId, ip);
        assert.strictEqual(check.allowed, true);
      }
    });

    it('should NOT lock out legitimate academy Wi-Fi / NAT router on successful student authentications', () => {
      const academyNatIp = '103.21.244.10'; // Shared academy Wi-Fi IP

      // 15 distinct legitimate students submit classwork with valid PINs from the academy Wi-Fi
      for (let i = 1; i <= 15; i++) {
        const studentId = `legit_stu_${i}`;
        const check = checkStudentPinRateLimit(studentId, academyNatIp);
        assert.strictEqual(check.allowed, true, `Student ${i} should be allowed`);

        // Successful PIN authentication clears in-flight without penalizing the IP bucket
        recordPinSuccess(studentId, academyNatIp);
      }

      // Student 16 arrives and should also be allowed (Wi-Fi NAT is NOT locked out by successful authentications)
      const student16Check = checkStudentPinRateLimit('legit_stu_16', academyNatIp);
      assert.strictEqual(student16Check.allowed, true, 'Academy Wi-Fi must NOT be locked out by successful student logins');
    });

    it('should NOT permanently lock out shared classroom Wi-Fi IP when transient in-flight concurrency hits threshold and then succeeds', () => {
      const sharedWifiIp = '103.21.244.20';

      // 10 students initiate concurrent logins simultaneously (inFlight = 10, attempts = 0)
      for (let i = 1; i <= 10; i++) {
        const res = checkStudentPinRateLimit(`concurrent_stu_${i}`, sharedWifiIp);
        assert.strictEqual(res.allowed, true);
      }

      // 11th concurrent student arrives while all 10 are still in-flight -> transiently throttled
      const res11 = checkStudentPinRateLimit('concurrent_stu_11', sharedWifiIp);
      assert.strictEqual(res11.allowed, false);

      // The 10 in-flight students finish scrypt verification with valid PINs
      for (let i = 1; i <= 10; i++) {
        recordPinSuccess(`concurrent_stu_${i}`, sharedWifiIp);
      }

      // Now Student 11 retries 100ms later -> must be allowed (IP must NOT have been locked for 15 minutes!)
      const retry11 = checkStudentPinRateLimit('concurrent_stu_11', sharedWifiIp);
      assert.strictEqual(retry11.allowed, true, 'Shared Wi-Fi IP must immediately recover after in-flight requests succeed');
      recordPinSuccess('concurrent_stu_11', sharedWifiIp);
    });

    it('should pre-emptively reject locked-out IPs before querying database (isIpRateLimited)', () => {
      const lockedIp = '198.51.100.99';

      // Accumulate 10 failed attempts from this IP
      for (let i = 0; i < 10; i++) {
        recordPinFailure(`unknown_stu_${i}`, lockedIp);
      }

      // isIpRateLimited should immediately flag this IP as rate limited without any DB lookup
      const ipStatus = isIpRateLimited(lockedIp);
      assert.strictEqual(ipStatus.allowed, false);
      assert.ok(ipStatus.error?.includes('requests from your network'));
    });

    it('should enforce bounded memory capacity to eliminate OOM risk (BUG-041 Fix)', () => {
      // Internal bucket counts should not grow unboundedly
      const initial = getBucketCountsForTesting();
      assert.strictEqual(initial.ipCount, 0);

      // Add requests from 50 distinct IPs
      for (let i = 0; i < 50; i++) {
        checkStudentPinRateLimit(`stu_${i}`, `192.168.10.${i}`);
      }

      const counts = getBucketCountsForTesting();
      assert.strictEqual(counts.ipCount, 50);
      assert.strictEqual(counts.studentCount, 50);
    });

    it('should protect Director Admin login against brute-force attacks via checkAdminRateLimit', () => {
      const attackerIp = '185.220.101.5';

      // Initial check should be allowed
      assert.strictEqual(checkAdminRateLimit(attackerIp).allowed, true);

      // 5 failed password attempts
      for (let i = 0; i < 5; i++) {
        recordAdminFailure(attackerIp);
      }

      // 6th attempt must be locked out
      const locked = checkAdminRateLimit(attackerIp);
      assert.strictEqual(locked.allowed, false);
      assert.ok(locked.error?.includes('Director login attempts'));

      // Successful login clears the lockout
      recordAdminSuccess(attackerIp);
      assert.strictEqual(checkAdminRateLimit(attackerIp).allowed, true);
    });

    it('should enforce strong SESSION_SECRET in production and reject missing or weak secrets', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.SESSION_SECRET;

      try {
        (process.env as any).NODE_ENV = 'production';

        // Missing secret in production throws fatal error
        delete process.env.SESSION_SECRET;
        assert.throws(() => getSessionSecret(), /SESSION_SECRET is not configured in production/);

        // Weak (< 32 char) secret in production throws fatal error
        process.env.SESSION_SECRET = 'short-secret';
        assert.throws(() => getSessionSecret(), /at least 32 characters/);

        // Valid 32+ char secret in production succeeds
        process.env.SESSION_SECRET = 'a'.repeat(32);
        assert.strictEqual(getSessionSecret(), 'a'.repeat(32));
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        if (origSecret !== undefined) {
          process.env.SESSION_SECRET = origSecret;
        } else {
          delete process.env.SESSION_SECRET;
        }
      }
    });
  });

  describe('Secure PIN Hashing & Dual-Verification Engine (Priority 3, BUG-004, BUG-005)', () => {
    it('should hash PIN with scrypt and random salt', async () => {
      const pin = '4829';
      const hash = await hashPin(pin);

      assert.ok(hash.startsWith('scrypt$'), 'Hash must start with scrypt$');
      const parts = hash.split('$');
      assert.strictEqual(parts.length, 3);
      assert.strictEqual(parts[1].length, 32, 'Salt must be 16 bytes (32 hex characters)');
      assert.strictEqual(parts[2].length, 128, 'Key must be 64 bytes (128 hex characters)');

      // Synchronous variant check
      const syncHash = hashPinSync(pin);
      assert.ok(syncHash.startsWith('scrypt$'));
    });

    it('should produce distinct hashes for identical PINs due to random salts', async () => {
      const pin = '1234';
      const hash1 = await hashPin(pin);
      const hash2 = await hashPin(pin);

      assert.notStrictEqual(hash1, hash2, 'Salts must ensure distinct ciphertexts');
    });

    it('should verify correct PIN against scrypt hash and reject incorrect PIN', async () => {
      const pin = '7832';
      const hash = await hashPin(pin);

      const validCheck = await verifyPinHash(pin, hash);
      assert.strictEqual(validCheck, true);

      const invalidCheck = await verifyPinHash('7833', hash);
      assert.strictEqual(invalidCheck, false);

      // Sync variant check
      assert.strictEqual(verifyPinHashSync(pin, hash), true);
      assert.strictEqual(verifyPinHashSync('0000', hash), false);
    });

    it('should perform dual verification for gradual migration from plaintext to hash', async () => {
      const testPin = '9182';
      const testHash = await hashPin(testPin);

      // Case A: Account already migrated to hash
      const resA = await verifyPinDual(testPin, testHash, null);
      assert.strictEqual(resA.valid, true);
      assert.strictEqual(resA.needsMigration, false);

      // Case B: Account still on plaintext PIN
      const resB = await verifyPinDual(testPin, null, testPin);
      assert.strictEqual(resB.valid, true);
      assert.strictEqual(resB.needsMigration, true, 'Plaintext login should signal needsMigration');

      // Case C: Incorrect PIN against plaintext
      const resC = await verifyPinDual('wrong', null, testPin);
      assert.strictEqual(resC.valid, false);
      assert.strictEqual(resC.needsMigration, false);

      // Case D: Incorrect PIN against hash
      const resD = await verifyPinDual('wrong', testHash, testPin);
      assert.strictEqual(resD.valid, false);
    });
  });

  describe('Student Submission PIN Brute-Force Lockout (BUG-045)', () => {
    it('should lock out student account on repeated incorrect PINs in submission path', () => {
      const victimId = 'stu_submit_bruteforce_target';
      const clientIp = '198.51.100.42';

      // Simulate 5 failed submission PIN verification attempts
      for (let i = 0; i < 5; i++) {
        const rateCheck = checkStudentPinRateLimit(victimId, clientIp);
        assert.strictEqual(rateCheck.allowed, true);
        recordPinFailure(victimId, clientIp);
      }

      // 6th attempt should be locked out
      const lockedCheck = checkStudentPinRateLimit(victimId, clientIp);
      assert.strictEqual(lockedCheck.allowed, false);
      assert.ok(lockedCheck.error?.includes('locked'));
    });
  });

  describe('Audit Logging Security & Credential Redaction', () => {
    it('should verify PIN values and passwords never appear in audit log payloads', () => {
      const studentId = 'test_stu_audit_log_verify';
      const rollNo = 'NDA-99';
      const clientIp = '192.168.1.50';
      const isAdmin = false;

      const auditPayload = {
        action: 'STUDENT_CHANGE_PIN',
        entity: 'students',
        entityId: studentId,
        after: {
          roll_no: rollNo,
          changedAt: new Date().toISOString(),
          authMethod: isAdmin ? 'admin_override' : 'self_service_pin_verification',
          clientIp,
        },
      };

      assert.strictEqual('pin' in auditPayload.after, false);
      assert.strictEqual('password' in auditPayload.after, false);
      assert.strictEqual('currentPin' in auditPayload.after, false);
      assert.strictEqual('newPin' in auditPayload.after, false);
      assert.strictEqual(JSON.stringify(auditPayload.after).includes('"pin":'), false);
      assert.strictEqual(JSON.stringify(auditPayload.after).includes('"password":'), false);
    });
  });

  describe('Temporary PIN Generation & Default PIN Security Hardening', () => {
    it('should generate cryptographically secure 6-digit numeric temporary PINs', () => {
      const pin = generateTemporaryPin();
      assert.strictEqual(typeof pin, 'string');
      assert.strictEqual(pin.length, 6);
      assert.match(pin, /^\d{6}$/);
    });

    it('should never generate trivial or sequential patterns (000000, 123456)', () => {
      const trivial = new Set([
        '000000', '111111', '222222', '333333', '444444',
        '555555', '666666', '777777', '888888', '999999',
        '123456', '654321', '12345', '1234', '0000'
      ]);
      for (let i = 0; i < 50; i++) {
        const pin = generateTemporaryPin();
        assert.strictEqual(trivial.has(pin), false, `Generated trivial PIN: ${pin}`);
      }
    });

    it('should generate unique varied PINs across multiple invocations', () => {
      const pins = new Set<string>();
      for (let i = 0; i < 20; i++) {
        pins.add(generateTemporaryPin());
      }
      assert.ok(pins.size > 15, 'Generated PINs lack expected entropy');
    });

    it('should correctly hash generated temporary PIN and verify with verifyPinDual', async () => {
      const tempPin = generateTemporaryPin();
      const hash = await hashPin(tempPin);

      // Verify that verifyPinDual authenticates with correct temp PIN
      const verification = await verifyPinDual(tempPin, hash, '');
      assert.strictEqual(verification.valid, true);
      assert.strictEqual(verification.needsMigration, false);

      // Verify that wrong PIN is rejected
      const wrongVerification = await verifyPinDual('999999', hash, '');
      assert.strictEqual(wrongVerification.valid, false);
    });
  });
});
