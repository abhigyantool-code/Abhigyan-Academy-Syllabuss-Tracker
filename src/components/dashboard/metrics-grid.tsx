import React from 'react';
import { CheckCircle2, Clock, CalendarDays, Target } from 'lucide-react';

interface MetricsGridProps {
  coveredTopics?: number;
  totalTopics?: number;
  pendingTopics?: number;
  variancePct?: number;
  daysLeft?: number;
}

export function MetricsGrid({
  coveredTopics = 0,
  totalTopics = 0,
  pendingTopics = 0,
  variancePct = 0,
  daysLeft = 45,
}: MetricsGridProps) {
  const isAhead = variancePct >= 0;

  const metrics = [
    {
      id: 'topics-done',
      label: 'Topics Done',
      value: String(coveredTopics),
      subtitle: `of ${totalTopics} total`,
      icon: CheckCircle2,
      accentColor: 'text-[var(--status-green)]',
      bgIcon: 'bg-[var(--status-green-bg)]',
    },
    {
      id: 'topics-left',
      label: 'Topics Left',
      value: String(pendingTopics || Math.max(0, totalTopics - coveredTopics)),
      subtitle: 'remaining in batch',
      icon: Clock,
      accentColor: 'text-[var(--status-yellow)]',
      bgIcon: 'bg-[var(--status-yellow-bg)]',
    },
    {
      id: 'days-left',
      label: 'Days Left',
      value: `${daysLeft}d`,
      subtitle: 'to curriculum target',
      icon: CalendarDays,
      accentColor: 'text-[var(--text-primary)]',
      bgIcon: 'bg-[var(--surface-muted)]',
    },
    {
      id: 'pacing-accuracy',
      label: 'Schedule Pace',
      value: isAhead ? `+${variancePct}%` : `${variancePct}%`,
      subtitle: isAhead ? 'ahead of schedule' : 'behind target pace',
      icon: Target,
      accentColor: isAhead ? 'text-[var(--status-green)]' : 'text-[var(--status-yellow)]',
      bgIcon: isAhead ? 'bg-[var(--status-green-bg)]' : 'bg-[var(--status-yellow-bg)]',
    },
  ];

  return (
    <section aria-labelledby="key-metrics-title" className="space-y-2.5">
      <h2 id="key-metrics-title" className="sr-only">
        Key Syllabus Metrics
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div
              key={metric.id}
              tabIndex={0}
              role="article"
              aria-label={`${metric.label}: ${metric.value}, ${metric.subtitle}`}
              className="rounded-[24px] p-4 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-secondary)] focus-visible:ring-offset-2 cursor-pointer select-none"
              style={{ borderRadius: '24px' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {metric.label}
                </span>
                <div
                  className={`w-7 h-7 rounded-full ${metric.bgIcon} flex items-center justify-center border border-[var(--border-subtle)]`}
                >
                  <Icon className={`w-3.5 h-3.5 ${metric.accentColor}`} />
                </div>
              </div>

              <div className="mt-2.5">
                <div
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums font-mono ${metric.accentColor}`}
                >
                  {metric.value}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5 truncate">
                  {metric.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
