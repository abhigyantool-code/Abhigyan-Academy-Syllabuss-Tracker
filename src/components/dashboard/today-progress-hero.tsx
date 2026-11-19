import React from 'react';
import { TrendingUp, CheckCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TodayProgressHeroProps {
  coveragePct?: number;
  variancePct?: number;
  totalTopics?: number;
  coveredTopics?: number;
}

export function TodayProgressHero({
  coveragePct = 0,
  variancePct = 0,
  totalTopics = 0,
  coveredTopics = 0,
}: TodayProgressHeroProps) {
  const isAhead = variancePct >= 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const safePct = Math.min(Math.max(coveragePct, 0), 100);
  const strokeDashoffset = circumference - (safePct / 100) * circumference;

  return (
    <section
      aria-labelledby="today-progress-title"
      className="rounded-[24px] p-5 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] transition-all duration-200"
      style={{ borderRadius: '24px' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          id="today-progress-title"
          className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
        >
          Today&apos;s Progress
        </h2>

        {/* Status Indicator Chip */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            isAhead
              ? 'bg-[var(--status-green-bg)] text-[var(--status-green)] border-[var(--status-green-border)]'
              : 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)] border-[var(--status-yellow-border)]'
          }`}
          style={{ borderRadius: '999px' }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAhead ? 'bg-[var(--status-green)] animate-pulse' : 'bg-[var(--status-yellow)]'
            }`}
          />
          <span>{isAhead ? 'On track' : 'Attention'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Metric & Text */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl sm:text-5xl font-extrabold text-[var(--text-primary)] tabular-nums tracking-tight">
              {coveragePct}%
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium">
            <span
              className={`flex items-center gap-0.5 font-mono font-bold tabular-nums ${
                isAhead ? 'text-[var(--status-green)]' : 'text-[var(--status-yellow)]'
              }`}
            >
              {isAhead ? (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5" /> +{variancePct}%
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3.5 h-3.5" /> {variancePct}%
                </>
              )}
            </span>
            <span className="text-[var(--text-muted)]">
              vs planned schedule
            </span>
          </div>

          <p className="text-[11px] text-[var(--text-faint)] mt-1 font-mono tabular-nums">
            {coveredTopics} of {totalTopics} topics completed
          </p>
        </div>

        {/* Circular / Arc Meter */}
        <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background Ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="var(--surface-muted)"
              strokeWidth="9"
            />
            {/* Gradient / Accent Ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={isAhead ? 'var(--status-green)' : 'var(--status-yellow)'}
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[var(--icon-color)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
