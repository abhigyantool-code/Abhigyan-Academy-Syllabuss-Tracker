import React from 'react';
import {
  RotateCcw,
  FileCheck2,
  Zap,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

interface RecommendedActivitiesProps {
  overdueCount?: number;
  totalTopics?: number;
  coveredTopics?: number;
}

export function RecommendedActivities({
  overdueCount = 0,
  totalTopics = 0,
  coveredTopics = 0,
}: RecommendedActivitiesProps) {
  const activities = [
    {
      id: 'revise',
      title: 'Revise & Catch-Up',
      description: overdueCount > 0
        ? `${overdueCount} flagged topics requiring rapid revision`
        : 'Reinforce recently completed syllabus units',
      caption: 'Best before 4:00 PM',
      badge: overdueCount > 0 ? 'Priority' : 'Recommended',
      badgeType: overdueCount > 0 ? 'priority' : 'recommended',
      icon: RotateCcw,
      gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      illustrationBg: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'practice-test',
      title: 'Practice Test',
      description: `Targeted unit assessment (${coveredTopics} topics covered)`,
      caption: 'Best before 6:30 PM',
      badge: 'Recommended',
      badgeType: 'recommended',
      icon: FileCheck2,
      gradient: 'from-sky-500/20 via-indigo-500/10 to-transparent',
      illustrationBg: 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400',
    },
    {
      id: 'flashcards',
      title: 'Flashcards',
      description: 'Rapid formula & concept recall for key subjects',
      caption: 'Best before 8:30 PM',
      badge: 'Optional',
      badgeType: 'optional',
      icon: Zap,
      gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      illustrationBg: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <section aria-labelledby="recommended-activities-title" className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h2
          id="recommended-activities-title"
          className="text-base font-bold text-[var(--text-primary)] tracking-tight"
        >
          Recommended activities
        </h2>
        <span className="text-xs text-[var(--text-muted)] font-medium">
          3 personalized tasks
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {activities.map((act) => {
          const Icon = act.icon;

          let badgeBg = 'bg-[var(--status-gray-bg)]';
          let badgeBorder = 'border-[var(--status-gray-border)]';
          let badgeText = 'text-[var(--status-gray)]';

          if (act.badgeType === 'priority') {
            badgeBg = 'bg-[var(--status-red-bg)]';
            badgeBorder = 'border-[var(--status-red-border)]';
            badgeText = 'text-[var(--status-red)]';
          } else if (act.badgeType === 'recommended') {
            badgeBg = 'bg-[var(--status-yellow-bg)]';
            badgeBorder = 'border-[var(--status-yellow-border)]';
            badgeText = 'text-[var(--status-yellow)]';
          }

          return (
            <div
              key={act.id}
              tabIndex={0}
              role="article"
              aria-label={`${act.title}, ${act.badge}, ${act.caption}`}
              className="rounded-[24px] p-3.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-secondary)] focus-visible:ring-offset-2 cursor-pointer group"
              style={{ borderRadius: '24px' }}
            >
              {/* Activity Thematic Visual Area (20px radius) */}
              <div
                className={`relative w-full aspect-[16/10] rounded-[20px] overflow-hidden bg-gradient-to-br ${act.gradient} border border-[var(--border-subtle)] flex items-center justify-center p-3 mb-3 transition-transform group-hover:scale-[1.02] duration-300`}
                style={{ borderRadius: '20px' }}
              >
                <div
                  className={`w-12 h-12 rounded-[16px] ${act.illustrationBg} border border-[var(--border-subtle)] flex items-center justify-center shadow-[var(--shadow-soft)]`}
                >
                  <Icon className="w-6 h-6" />
                </div>

                {/* Badge Chip */}
                <div className="absolute top-2.5 right-2.5">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeBorder} ${badgeBg} ${badgeText} shadow-sm`}
                    style={{ borderRadius: '999px' }}
                  >
                    {act.badge}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] tracking-tight">
                    {act.title}
                  </h3>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                  {act.description}
                </p>
              </div>

              {/* Caption */}
              <div className="pt-2.5 mt-2.5 border-t border-[var(--border-subtle)] flex items-center gap-1.5 text-[10.5px] font-mono text-[var(--text-muted)]">
                <Clock className="w-3 h-3 text-[var(--icon-color)]" />
                <span className="tabular-nums font-semibold">{act.caption}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
