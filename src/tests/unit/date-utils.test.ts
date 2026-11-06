import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayIST,
  offsetDaysIST,
  formatISTDate,
  getTodayBoundsIST,
  checkAcademyHours,
} from '../../lib/date-utils';

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

  it('should enforce active academy hours (06:30 AM to 09:00 PM IST, Mon-Sat)', () => {
    // 2026-11-04 is Wednesday. 10:00 AM IST = 04:30 AM UTC
    const wednesdayWorkingHours = new Date('2026-11-04T04:30:00Z');
    const res1 = checkAcademyHours(wednesdayWorkingHours);
    assert.equal(res1.allowed, true);

    // 2026-11-08 is Sunday.
    const sunday = new Date('2026-11-08T06:00:00Z');
    const res2 = checkAcademyHours(sunday);
    assert.equal(res2.allowed, false);
    assert.match(res2.reason || '', /closed on Sundays/);

    // Wednesday 05:00 AM IST = 23:30 UTC previous day
    const wednesdayEarlyMorning = new Date('2026-11-03T23:30:00Z');
    const res3 = checkAcademyHours(wednesdayEarlyMorning);
    assert.equal(res3.allowed, false);
    assert.match(res3.reason || '', /lecture hours/);

    // Wednesday 22:30 PM IST = 17:00 UTC
    const wednesdayLateNight = new Date('2026-11-04T17:00:00Z');
    const res4 = checkAcademyHours(wednesdayLateNight);
    assert.equal(res4.allowed, false);
    assert.match(res4.reason || '', /lecture hours/);
  });
});
