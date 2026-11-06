import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { submitEntrySchema } from '../../lib/submission-validation';

describe('Zod Submission Validation', () => {
  const validPayload = {
    courseId: 'f552f044-2ec4-4939-b955-6ffacd22099a',
    teacherId: '3757a7d2-bfa6-48c1-b477-25eb0c2ddb5e',
    subjectId: '237e42eb-91ac-44a7-bf06-2c3f5766a135',
    topicId: 'af1ffc08-c9c2-42fc-83d7-15dfd0c01fd6',
    studentId: '927e787b-eb27-43f7-8f32-954b2792a192',
    pin: '1234',
    classCode: 'NDA-942',
    status: 'covered' as const,
    remarks: 'Topic covered with examples',
    deviceId: 'device-test-12345',
    websiteUrlHp: '',
  };

  it('should accept a completely valid submission input', () => {
    const result = submitEntrySchema.safeParse(validPayload);
    assert.equal(result.success, true);
  });

  it('should reject invalid UUIDs for course, subject, or student', () => {
    const invalid = { ...validPayload, courseId: 'not-a-uuid' };
    const result = submitEntrySchema.safeParse(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      const issue = result.error.issues?.[0];
      assert.match(issue?.message || '', /course|Invalid/);
    }
  });

  it('should reject invalid status options', () => {
    const invalid = { ...validPayload, status: 'completed' as any };
    const result = submitEntrySchema.safeParse(invalid);
    assert.equal(result.success, false);
  });

  it('should reject remarks longer than 300 characters', () => {
    const invalid = { ...validPayload, remarks: 'A'.repeat(305) };
    const result = submitEntrySchema.safeParse(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      const issue = result.error.issues?.[0];
      assert.match(issue?.message || '', /300 characters/);
    }
  });

  it('should accept null or optional remarks', () => {
    const validWithoutRemarks = { ...validPayload, remarks: null };
    const result = submitEntrySchema.safeParse(validWithoutRemarks);
    assert.equal(result.success, true);
  });

  it('should reject short PIN or missing PIN', () => {
    const invalidShort = { ...validPayload, pin: '12' };
    const resShort = submitEntrySchema.safeParse(invalidShort);
    assert.equal(resShort.success, false);

    const invalidEmpty = { ...validPayload, pin: '' };
    const resEmpty = submitEntrySchema.safeParse(invalidEmpty);
    assert.equal(resEmpty.success, false);
  });

  it('should reject PIN longer than 8 digits', () => {
    const invalidLong = { ...validPayload, pin: '123456789' };
    const resLong = submitEntrySchema.safeParse(invalidLong);
    assert.equal(resLong.success, false);
  });

  it('should identify honeypot presence when websiteUrlHp is filled', () => {
    const botPayload = { ...validPayload, websiteUrlHp: 'http://spambot.ai' };
    const result = submitEntrySchema.safeParse(botPayload);
    assert.equal(result.success, true);
    assert.equal(result.data.websiteUrlHp, 'http://spambot.ai');
  });
});
