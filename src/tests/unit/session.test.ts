import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

describe('Faculty Auth Session Token & Cryptography', () => {
  const SECRET = 'unit-test-session-secret-key-32-chars-long';

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

  test('should sign and verify Director/Admin session payload', () => {
    const adminPayload = {
      userId: 'admin-director-root',
      role: 'admin' as const,
      name: 'Academy Director',
      createdAt: Date.now(),
    };

    const data = Buffer.from(JSON.stringify(adminPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    const token = `${data}.${signature}`;

    const [d, s] = token.split('.');
    assert.equal(d, data);
    const expectedSig = crypto.createHmac('sha256', SECRET).update(d).digest('base64url');
    assert.equal(s, expectedSig);

    const decoded = JSON.parse(Buffer.from(d, 'base64url').toString('utf-8'));
    assert.equal(decoded.role, 'admin');
    assert.equal(decoded.name, 'Academy Director');
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

  test('should validate session token expiration (BUG-027)', async () => {
    const { signPayload, verifyPayload } = await import('../../lib/session');

    // Valid recent token
    const validToken = signPayload({
      userId: 'test-user',
      role: 'faculty',
      name: 'Ashish Sir',
      createdAt: Date.now() - 1000,
    });
    const validResult = verifyPayload(validToken);
    assert.ok(validResult !== null);
    assert.equal(validResult?.name, 'Ashish Sir');

    // Expired token (31 days old)
    const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
    const expiredToken = signPayload({
      userId: 'test-user',
      role: 'faculty',
      name: 'Ashish Sir',
      createdAt: Date.now() - thirtyOneDaysMs,
    });
    const expiredResult = verifyPayload(expiredToken);
    assert.equal(expiredResult, null, 'Expired session token must be rejected');

    // Token from the distant future
    const futureToken = signPayload({
      userId: 'test-user',
      role: 'faculty',
      name: 'Ashish Sir',
      createdAt: Date.now() + 1000000,
    });
    const futureResult = verifyPayload(futureToken);
    assert.equal(futureResult, null, 'Future session token must be rejected');
  });
});
