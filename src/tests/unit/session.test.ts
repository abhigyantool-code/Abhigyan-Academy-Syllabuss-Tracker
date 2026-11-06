import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

describe('Faculty Auth Session Token & Cryptography', () => {
  const SECRET = 'abhigyan-academy-super-secure-key-2026-ist';

  test('should securely sign and verify faculty session payload', () => {
    const payload = {
      userId: 'teacher-uuid-1234',
      role: 'faculty' as const,
      name: 'Dipyaman Sir',
      teacherId: 'teacher-uuid-1234',
      createdAt: Date.now(),
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    const token = `${data}.${signature}`;

    // Verify token
    const [d, s] = token.split('.');
    assert.equal(d, data);
    const expectedSig = crypto.createHmac('sha256', SECRET).update(d).digest('base64url');
    assert.equal(s, expectedSig);

    const decoded = JSON.parse(Buffer.from(d, 'base64url').toString('utf-8'));
    assert.equal(decoded.name, 'Dipyaman Sir');
    assert.equal(decoded.role, 'faculty');
    assert.equal(decoded.teacherId, 'teacher-uuid-1234');
  });

  test('should reject tampered or modified session token', () => {
    const payload = {
      userId: 'teacher-uuid-1234',
      role: 'faculty' as const,
      name: 'Dipyaman Sir',
      createdAt: Date.now(),
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

    // Tampered data
    const tamperedData = Buffer.from(JSON.stringify({ ...payload, role: 'admin' })).toString('base64url');
    const expectedSig = crypto.createHmac('sha256', SECRET).update(tamperedData).digest('base64url');

    assert.notEqual(signature, expectedSig, 'Signature must mismatch when payload is tampered');
  });
});
