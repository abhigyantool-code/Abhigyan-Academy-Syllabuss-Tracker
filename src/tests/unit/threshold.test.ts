import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export function computeEffectiveThreshold(configuredThreshold: number, enrolledCount: number): number {
  const twentyPct = Math.round(0.2 * enrolledCount);
  const dynamicMin = Math.max(1, twentyPct);
  return Math.min(configuredThreshold, dynamicMin);
}

export function determineTopicStatus(params: {
  hasAdminApproval: boolean;
  coveredConfirmations: number;
  partialConfirmations: number;
  effectiveThreshold: number;
  targetDate: string | null;
  todayIST: string;
}): 'covered' | 'unverified' | 'in_progress' | 'overdue' | 'not_started' {
  const {
    hasAdminApproval,
    coveredConfirmations,
    partialConfirmations,
    effectiveThreshold,
    targetDate,
    todayIST,
  } = params;

  if (hasAdminApproval) return 'covered';
  if (coveredConfirmations >= effectiveThreshold) return 'covered';
  if (coveredConfirmations > 0) return 'unverified';
  if (partialConfirmations > 0) return 'in_progress';
  if (targetDate && targetDate < todayIST) return 'overdue';
  return 'not_started';
}

describe('Coverage Threshold Formula & Status Computation', () => {
  it('should compute effective threshold as min(configured, max(1, round(0.20 * enrolled)))', () => {
    // 10 students enrolled, configured threshold 5: min(5, max(1, round(2))) = 2
    assert.equal(computeEffectiveThreshold(5, 10), 2);

    // 50 students enrolled, configured threshold 5: min(5, max(1, round(10))) = 5
    assert.equal(computeEffectiveThreshold(5, 50), 5);

    // 3 students enrolled, configured threshold 5: min(5, max(1, round(0.6))) = 1
    assert.equal(computeEffectiveThreshold(5, 3), 1);

    // 0 students enrolled: min(5, max(1, 0)) = 1
    assert.equal(computeEffectiveThreshold(5, 0), 1);
  });

  it('should mark status as covered when confirmations meet effective threshold', () => {
    const status = determineTopicStatus({
      hasAdminApproval: false,
      coveredConfirmations: 2,
      partialConfirmations: 0,
      effectiveThreshold: 2,
      targetDate: '2026-10-20',
      todayIST: '2026-10-24',
    });
    assert.equal(status, 'covered');
  });

  it('should mark status as unverified when confirmations are positive but below threshold', () => {
    const status = determineTopicStatus({
      hasAdminApproval: false,
      coveredConfirmations: 1,
      partialConfirmations: 0,
      effectiveThreshold: 5,
      targetDate: '2026-10-20',
      todayIST: '2026-10-24',
    });
    assert.equal(status, 'unverified');
  });

  it('should mark status as in_progress when partial confirmations exist and no covered confirmations', () => {
    const status = determineTopicStatus({
      hasAdminApproval: false,
      coveredConfirmations: 0,
      partialConfirmations: 2,
      effectiveThreshold: 5,
      targetDate: '2026-10-28',
      todayIST: '2026-10-24',
    });
    assert.equal(status, 'in_progress');
  });

  it('should mark status as overdue when target date is past and topic is uncovered', () => {
    const status = determineTopicStatus({
      hasAdminApproval: false,
      coveredConfirmations: 0,
      partialConfirmations: 0,
      effectiveThreshold: 5,
      targetDate: '2026-10-18',
      todayIST: '2026-10-24',
    });
    assert.equal(status, 'overdue');
  });

  it('should mark status as covered immediately when admin approves it', () => {
    const status = determineTopicStatus({
      hasAdminApproval: true,
      coveredConfirmations: 0,
      partialConfirmations: 0,
      effectiveThreshold: 5,
      targetDate: '2026-10-18',
      todayIST: '2026-10-24',
    });
    assert.equal(status, 'covered');
  });
});
