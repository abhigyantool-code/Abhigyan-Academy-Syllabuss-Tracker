import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { hashPinSync, verifyPinHashSync, verifyPinDual } from '../../lib/pin-hash';

describe('Priority 3: PIN Hashing Migration & Rollback Unit Tests', () => {
  const tmpTestDir = path.join(process.cwd(), 'database/backups/test_migration_sandbox');

  it('should simulate safe migration of student accounts without deleting or altering records', () => {
    // Fixture of 5 students (mixture of plaintext, default 1234, custom PINs)
    const mockStudents = [
      { id: 'stu_01', roll_no: 'NDA-01', name: 'Student 1', pin: '1234', pin_hash: null },
      { id: 'stu_02', roll_no: 'NDA-02', name: 'Student 2', pin: '4829', pin_hash: null },
      { id: 'stu_03', roll_no: 'NDA-03', name: 'Student 3', pin: '9182', pin_hash: null },
      { id: 'stu_04', roll_no: 'NDA-04', name: 'Student 4', pin: '1234', pin_hash: null },
      { id: 'stu_05', roll_no: 'NDA-05', name: 'Student 5', pin: '5521', pin_hash: 'scrypt$already$hashed' },
    ];

    // Snapshot pre-migration state
    if (!fs.existsSync(tmpTestDir)) {
      fs.mkdirSync(tmpTestDir, { recursive: true });
    }
    const snapshotPath = path.join(tmpTestDir, 'pre_migration_students.json');
    fs.writeFileSync(snapshotPath, JSON.stringify(mockStudents, null, 2), 'utf-8');

    // Perform migration simulation
    const migratedStudents = mockStudents.map((s) => {
      // Idempotency: skip if already hashed
      if (s.pin_hash && s.pin_hash.startsWith('scrypt$')) {
        return { ...s };
      }
      return {
        ...s,
        pin_hash: hashPinSync(s.pin),
      };
    });

    // Verification 1: Record count is strictly preserved
    assert.strictEqual(migratedStudents.length, mockStudents.length);

    // Verification 2: All IDs, roll numbers, and names match exactly
    for (let i = 0; i < mockStudents.length; i++) {
      assert.strictEqual(migratedStudents[i].id, mockStudents[i].id);
      assert.strictEqual(migratedStudents[i].roll_no, mockStudents[i].roll_no);
      assert.strictEqual(migratedStudents[i].name, mockStudents[i].name);
    }

    // Verification 3: Every student with a PIN now has a valid scrypt$ hash
    for (const s of migratedStudents) {
      assert.ok(s.pin_hash?.startsWith('scrypt$'), `Student ${s.id} must have scrypt hash`);
    }

    // Verification 4: Student 1 & 4 have distinct hashes despite same PIN (salting verified)
    assert.notStrictEqual(migratedStudents[0].pin_hash, migratedStudents[3].pin_hash);

    // Verification 5: Original credentials authenticate against new hashes
    assert.strictEqual(verifyPinHashSync('1234', migratedStudents[0].pin_hash!), true);
    assert.strictEqual(verifyPinHashSync('4829', migratedStudents[1].pin_hash!), true);
    assert.strictEqual(verifyPinHashSync('9182', migratedStudents[2].pin_hash!), true);
    assert.strictEqual(verifyPinHashSync('wrong', migratedStudents[1].pin_hash!), false);
  });

  it('should simulate rollback from snapshot restoring exact pre-migration state', () => {
    const snapshotPath = path.join(tmpTestDir, 'pre_migration_students.json');
    assert.ok(fs.existsSync(snapshotPath));

    const originalData = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

    // Simulated rolled back dataset
    const rolledBackData = originalData.map((s: any) => ({
      id: s.id,
      roll_no: s.roll_no,
      name: s.name,
      pin: s.pin,
      pin_hash: s.pin_hash,
    }));

    // Verify exact identity with original pre-migration state
    assert.deepStrictEqual(rolledBackData, originalData);
    assert.strictEqual(rolledBackData[0].pin_hash, null);
    assert.strictEqual(rolledBackData[0].pin, '1234');

    // Clean up temporary test files
    fs.rmSync(tmpTestDir, { recursive: true, force: true });
  });

  it('should authenticate seamlessly across pre-migration, dual-mode, and post-migration states', async () => {
    const studentPlain = { pin: '4920', pin_hash: null };
    const studentDual = { pin: '4920', pin_hash: await hashPinSync('4920') };
    const studentHashed = { pin: '', pin_hash: await hashPinSync('4920') };

    // State 1: Plaintext only
    const check1 = await verifyPinDual('4920', studentPlain.pin_hash, studentPlain.pin);
    assert.strictEqual(check1.valid, true);
    assert.strictEqual(check1.needsMigration, true);

    // State 2: Dual mode (both present)
    const check2 = await verifyPinDual('4920', studentDual.pin_hash, studentDual.pin);
    assert.strictEqual(check2.valid, true);
    assert.strictEqual(check2.needsMigration, false);

    // State 3: Hashed only (plaintext purged)
    const check3 = await verifyPinDual('4920', studentHashed.pin_hash, studentHashed.pin);
    assert.strictEqual(check3.valid, true);
    assert.strictEqual(check3.needsMigration, false);

    // Wrong PIN rejected across all states
    assert.strictEqual((await verifyPinDual('0000', studentPlain.pin_hash, studentPlain.pin)).valid, false);
    assert.strictEqual((await verifyPinDual('0000', studentDual.pin_hash, studentDual.pin)).valid, false);
    assert.strictEqual((await verifyPinDual('0000', studentHashed.pin_hash, studentHashed.pin)).valid, false);
  });
});
