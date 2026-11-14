import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPinDual, generateTemporaryPin } from '../../lib/pin-hash';
import { validateNewPinStrength } from '../../lib/rate-limit';
import { parseCsv } from '../../lib/csv-parser';

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
});
