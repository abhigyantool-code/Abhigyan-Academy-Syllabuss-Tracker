/**
 * Canonical Curriculum Coverage Status Calculation
 */

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
