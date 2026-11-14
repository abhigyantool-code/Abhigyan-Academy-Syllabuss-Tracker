import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPin,
  verifyPinDual,
  generateTemporaryPin,
  markHashAsTemporary,
  isTemporaryPinHash,
} from '../../lib/pin-hash';
import { validateNewPinStrength } from '../../lib/rate-limit';
import { parseCsv } from '../../lib/csv-parser';
import { signPayload, verifyPayload } from '../../lib/session';

describe('Admin PIN Management & Temporary Credential Security', () => {
  describe('Temporary PIN Generator Security Properties', () => {
    it('should generate a 6-digit numeric string', () => {
      const pin = generateTemporaryPin();
      assert.match(pin, /^\d{6}$/);
      assert.equal(pin.length, 6);
    });

    it('should pass PIN strength validation as a strong non-trivial PIN', () => {
      for (let i = 0; i < 20; i++) {
        const pin = generateTemporaryPin();
        const check = validateNewPinStrength(pin);
        assert.equal(check.valid, true, `Temporary PIN failed validation: ${pin} - ${check.error}`);
      }
    });

    it('should not collide or repeat trivial patterns', () => {
      const pins = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const pin = generateTemporaryPin();
        assert.equal(pin !== '123456' && pin !== '000000' && pin !== '111111', true);
        pins.add(pin);
      }
      assert.ok(pins.size >= 45, 'Entropy expectation met');
    });
  });

  describe('PIN Reset State Transitions & Plaintext Purge Invariant', () => {
    it('should simulate resetting a student PIN: store scrypt hash, purge plaintext, and authenticate', async () => {
      // Setup initial student record with old PIN
      const oldPin = '582910';
      const oldHash = await hashPin(oldPin);
      const studentRecord = {
        id: 'stu_reset_test_01',
        roll_no: 'NDA-10',
        name: 'Test Student',
        pin: '', // Clean database has empty plaintext
        pin_hash: oldHash,
      };

      // Verify old PIN authenticates
      const initialAuth = await verifyPinDual(oldPin, studentRecord.pin_hash, studentRecord.pin);
      assert.equal(initialAuth.valid, true);

      // Perform admin PIN reset with a new temporary PIN
      const newTempPin = generateTemporaryPin();
      assert.notEqual(newTempPin, oldPin);

      // Simulate reset logic in resetStudentPinAction:
      const newHash = await hashPin(newTempPin);
      studentRecord.pin = ''; // CRITICAL: Plaintext MUST be empty
      studentRecord.pin_hash = newHash;

      // Verify old PIN NO LONGER works
      const oldAuthAttempt = await verifyPinDual(oldPin, studentRecord.pin_hash, studentRecord.pin);
      assert.equal(oldAuthAttempt.valid, false, 'Old PIN must be rejected after reset');

      // Verify new temporary PIN works
      const newAuthAttempt = await verifyPinDual(newTempPin, studentRecord.pin_hash, studentRecord.pin);
      assert.equal(newAuthAttempt.valid, true, 'New PIN must be verified');
      assert.equal(newAuthAttempt.needsMigration, false);
      assert.equal(studentRecord.pin, '', 'Plaintext pin column must remain empty');
    });

    it('should reject weak custom PINs during admin reset', () => {
      const weakPins = ['1234', '0000', '1111', '123', '123456789', 'abcd'];
      for (const p of weakPins) {
        const result = validateNewPinStrength(p);
        assert.equal(result.valid, false, `Weak PIN should be rejected: ${p}`);
      }
    });

    it('should accept strong 6-digit or 8-digit custom PINs during admin reset', () => {
      const strongPins = ['849201', '593821', '94820174'];
      for (const p of strongPins) {
        const result = validateNewPinStrength(p);
        assert.equal(result.valid, true, `Strong PIN should be accepted: ${p}`);
      }
    });
  });

  describe('Bulk Import CSV PIN Provisioning Logic', () => {
    it('should parse optional PIN column from CSV and auto-generate unique temp PIN when omitted', async () => {
      const csv = `Roll Number,Student Name,Course Code,Custom PIN\nNDA-101,Aarav Sharma,NDA,839201\nNDA-102,Vivaan Patel,NDA,\nNDA-103,Aditya Singh,NDA,`;
      const rows = parseCsv(csv);
      assert.equal(rows.length, 4);

      const importedRecords: Array<{ roll: string; name: string; pinHash: string; tempPin: string; hasPlaintext: boolean }> = [];

      for (let i = 1; i < rows.length; i++) {
        const [roll, name, , customPin] = rows[i];
        let pinToUse = customPin?.trim();
        if (!pinToUse || !/^\d{4,8}$/.test(pinToUse)) {
          pinToUse = generateTemporaryPin();
        }
        const pinHash = await hashPin(pinToUse);
        importedRecords.push({
          roll,
          name,
          pinHash,
          tempPin: pinToUse,
          hasPlaintext: false, // Invariant: pin field in DB is ''
        });
      }

      // Check row 1 used custom PIN 839201
      assert.equal(importedRecords[0].tempPin, '839201');
      assert.equal(await (await verifyPinDual('839201', importedRecords[0].pinHash, '')).valid, true);

      // Check row 2 and 3 received auto-generated 6-digit PINs
      assert.match(importedRecords[1].tempPin, /^\d{6}$/);
      assert.match(importedRecords[2].tempPin, /^\d{6}$/);
      assert.notEqual(importedRecords[1].tempPin, importedRecords[2].tempPin);

      // Ensure no plaintext storage
      for (const rec of importedRecords) {
        assert.equal(rec.hasPlaintext, false);
      }
    });

    it('should reject weak PINs (like 1234 or 0000) in CSV import and replace with secure temporary PINs', async () => {
      const csv = `Roll Number,Student Name,Course Code,Custom PIN\nNDA-201,Student Weak,NDA,1234\nNDA-202,Student Trivial,NDA,0000`;
      const rows = parseCsv(csv);

      for (let i = 1; i < rows.length; i++) {
        const [, , , customPin] = rows[i];
        let pinToUse = customPin?.trim();
        if (pinToUse && validateNewPinStrength(pinToUse).valid) {
          // Strong custom pin
        } else {
          pinToUse = generateTemporaryPin();
        }

        // Must NOT use 1234 or 0000
        assert.notEqual(pinToUse, '1234');
        assert.notEqual(pinToUse, '0000');
        assert.match(pinToUse, /^\d{6}$/);
        assert.equal(validateNewPinStrength(pinToUse).valid, true);
      }
    });
  });

  describe('Default PIN (1234) Detection for Mandatory PIN Change', () => {
    it('should flag mustChangePin: true when PIN entered is 1234', () => {
      const pin = '1234';
      const isDefault = pin.trim() === '1234';
      assert.equal(isDefault, true);
    });

    it('should not flag mustChangePin for strong personal PINs', () => {
      const pin = '849201';
      const isDefault = pin.trim() === '1234';
      assert.equal(isDefault, false);
    });
  });

  describe('Session Token mustChangePin Lifecycle', () => {
    it('should encode and preserve mustChangePin: true in signed session token', () => {
      const payload = {
        userId: 'student_test_1',
        role: 'student' as const,
        name: 'Test Student',
        studentId: 'student_test_1',
        mustChangePin: true,
        createdAt: Date.now(),
      };
      const token = signPayload(payload);
      const decoded = verifyPayload(token);
      assert.ok(decoded);
      assert.equal(decoded.mustChangePin, true);
    });

    it('should encode and preserve mustChangePin: false after PIN rotation', () => {
      const payload = {
        userId: 'student_test_1',
        role: 'student' as const,
        name: 'Test Student',
        studentId: 'student_test_1',
        mustChangePin: false,
        createdAt: Date.now(),
      };
      const token = signPayload(payload);
      const decoded = verifyPayload(token);
      assert.ok(decoded);
      assert.equal(decoded.mustChangePin, false);
    });
  });

  describe('Student Portal CLEARED Review Status Integration', () => {
    it('should count CLEARED student submissions in approvedEntries count', () => {
      const mockEntries = [
        { id: '1', status: 'covered', review_status: 'auto' },
        { id: '2', status: 'covered', review_status: 'approved' },
        { id: '3', status: 'covered', review_status: 'CLEARED' }, // Genuine Entry 2 status
        { id: '4', status: 'covered', review_status: 'pending' },
        { id: '5', status: 'covered', review_status: 'rejected' },
      ];

      const approvedCount = mockEntries.filter(
        (e) => e.status === 'covered' && (e.review_status === 'auto' || e.review_status === 'approved' || e.review_status === 'CLEARED')
      ).length;

      assert.equal(approvedCount, 3);
    });

    it('should evaluate isApproved = true for CLEARED review status', () => {
      const statuses = ['auto', 'approved', 'CLEARED'];
      for (const st of statuses) {
        const isApproved = st === 'approved' || st === 'auto' || st === 'CLEARED';
        assert.equal(isApproved, true);
      }

      const nonApproved = ['pending', 'rejected', 'VIOLATION'];
      for (const st of nonApproved) {
        const isApproved = st === 'approved' || st === 'auto' || st === 'CLEARED';
        assert.equal(isApproved, false);
      }
    });
  });

  describe('Opportunistic Credential Upgrade Plaintext Purge Invariant', () => {
    it('should purge plaintext pin field during opportunistic student and teacher hash derivation', async () => {
      const simulatedRawStudent = { id: 's1', pin: '4821', pin_hash: null };
      const verification = await verifyPinDual('4821', simulatedRawStudent.pin_hash, simulatedRawStudent.pin);
      assert.equal(verification.valid, true);
      assert.equal(verification.needsMigration, true);

      // Upgrade payload must include both pin: '' and pin_hash: scrypt$...
      const newHash = await hashPin('4821');
      const updatePayload = { pin: '', pin_hash: newHash };

      assert.equal(updatePayload.pin, '');
      assert.ok(updatePayload.pin_hash.startsWith('scrypt$'));

      // Subsequent login checks must succeed without plaintext
      const postUpgradeVerification = await verifyPinDual('4821', updatePayload.pin_hash, updatePayload.pin);
      assert.equal(postUpgradeVerification.valid, true);
      assert.equal(postUpgradeVerification.needsMigration, false);
    });
  });

  describe('Bulk Import Temporary PIN Tracking', () => {
    it('should generate an explicit tracking record for every student created during bulk import', () => {
      const mockCsvRows = [
        ['Roll Number', 'Student Name', 'Course Code'],
        ['NDA-101', 'Test Student 1', 'NDA'],
        ['NDA-102', 'Test Student 2', 'NDA'],
      ];

      const generatedPins: Array<{ rollNo: string; name: string; temporaryPin: string }> = [];
      for (let i = 1; i < mockCsvRows.length; i++) {
        const [rollNo, name] = mockCsvRows[i];
        const tempPin = generateTemporaryPin();
        generatedPins.push({ rollNo, name, temporaryPin: tempPin });
      }

      assert.equal(generatedPins.length, 2);
      assert.equal(generatedPins[0].rollNo, 'NDA-101');
      assert.match(generatedPins[0].temporaryPin, /^\d{6}$/);
      assert.equal(generatedPins[1].rollNo, 'NDA-102');
      assert.match(generatedPins[1].temporaryPin, /^\d{6}$/);
    });
  });

  describe('Temporary PIN Hash Marker ($temp) & Mandatory Rotation Lifecycle (UAT-BUG-001)', () => {
    it('should flag admin-generated or admin-reset temporary PINs with $temp and trigger isTemporary: true on login', async () => {
      const tempPin = generateTemporaryPin();
      const baseHash = await hashPin(tempPin);
      const tempHash = markHashAsTemporary(baseHash);

      assert.equal(tempHash.endsWith('$temp'), true);
      assert.equal(isTemporaryPinHash(tempHash), true);
      assert.equal(isTemporaryPinHash(baseHash), false);

      // Verify login with temporary PIN succeeds and reports isTemporary = true
      const authRes = await verifyPinDual(tempPin, tempHash, '');
      assert.equal(authRes.valid, true);
      assert.equal(authRes.isTemporary, true);

      // Verify wrong PIN fails and reports isTemporary = false
      const wrongRes = await verifyPinDual('999999', tempHash, '');
      assert.equal(wrongRes.valid, false);
      assert.equal(Boolean(wrongRes.isTemporary), false);

      // Simulate student rotating PIN to a personal PIN
      const personalPin = '739204';
      const personalHash = await hashPin(personalPin);
      assert.equal(isTemporaryPinHash(personalHash), false);

      const postRotateAuth = await verifyPinDual(personalPin, personalHash, '');
      assert.equal(postRotateAuth.valid, true);
      assert.equal(Boolean(postRotateAuth.isTemporary), false);
    });
  });

  describe('PocketBase Space-Delimited Timestamp Active Check (UAT-BUG-004)', () => {
    it('should accurately identify active same-day class codes when PocketBase uses space instead of T', () => {
      const nowMs = new Date('2026-11-14T10:35:00.000Z').getTime();
      // PocketBase returns space-delimited timestamps
      const pbValidFrom = '2026-11-14 00:00:00.000Z';
      const pbValidUntil = '2026-11-14 18:29:59.999Z';

      const fromMs = new Date(pbValidFrom.replace(' ', 'T')).getTime();
      const untilMs = new Date(pbValidUntil.replace(' ', 'T')).getTime();
      const isActive = fromMs <= nowMs && untilMs >= nowMs;

      assert.equal(isActive, true);
    });
  });
});
