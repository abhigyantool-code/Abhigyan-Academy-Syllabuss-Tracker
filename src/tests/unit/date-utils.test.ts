import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTodayIST, offsetDaysIST, formatISTDate, getTodayBoundsIST } from '../../lib/date-utils';

describe('Asia/Kolkata (IST) Date Utilities', () => {
  it('should return today formatted as YYYY-MM-DD', () => {
    const today = getTodayIST();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('should correctly offset dates across days and month transitions', () => {
    const base = '2026-10-24';
    assert.equal(offsetDaysIST(5, base), '2026-10-29');
    assert.equal(offsetDaysIST(-10, base), '2026-10-14');
    assert.equal(offsetDaysIST(10, base), '2026-11-03');
  });

  it('should format date strings into readable Indian English representation', () => {
    assert.equal(formatISTDate('2026-10-24'), '24 Oct 2026');
    assert.equal(formatISTDate(null), 'N/A');
  });

  it('should generate valid date bounds with custom TTL', () => {
    const { validFrom, validUntil } = getTodayBoundsIST(60);
    assert.equal(validUntil > validFrom, true);
    // Difference should be approx 65 mins (60 mins TTL + 5 mins clock skew buffer)
    const diffMins = Math.round((validUntil.getTime() - validFrom.getTime()) / 60000);
    assert.equal(diffMins >= 64 && diffMins <= 66, true);
  });
});
