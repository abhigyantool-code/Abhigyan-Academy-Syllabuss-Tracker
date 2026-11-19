'use client';

import React from 'react';
import {
  BookOpen,
  Calculator,
  Compass,
  Shield,
  PenTool,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hourglass,
} from 'lucide-react';
import type { TopicProgressItem } from '@/lib/dashboard-data';

interface StudyPlanPillsProps {
  topics?: TopicProgressItem[];
  today?: string;
}

interface PillSlot {
  id: string;
  duration: string;
  subject: string;
  topicName: string;
  timeSlot: string;
  status: 'upcoming' | 'scheduled' | 'overdue' | 'completed';
  icon: React.ComponentType<{ className?: string }>;
}

export function StudyPlanPills({ topics = [], today }: StudyPlanPillsProps) {
  // Derive 5 representative topic slots from domain data
  // Prioritize overdue -> in_progress -> not_started -> covered
  const overdueTopics = topics.filter((t) => t.status === 'overdue');
  const inProgressTopics = topics.filter((t) => t.status === 'in_progress' || t.status === 'unverified');
  const scheduledTopics = topics.filter((t) => t.status === 'not_started');
  const coveredTopics = topics.filter((t) => t.status === 'covered');

  const prioritized = [
    ...overdueTopics,
    ...inProgressTopics,
    ...scheduledTopics,
    ...coveredTopics,
  ];

  const defaultSlots: Array<{
    duration: string;
    subject: string;
    topicFallback: string;
    timeSlot: string;
    defaultStatus: 'upcoming' | 'scheduled' | 'overdue' | 'completed';
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      duration: '45m',
      subject: 'Mathematics',
      topicFallback: 'Calculus & Vectors',
      timeSlot: '09:30 AM',
      defaultStatus: 'upcoming',
      icon: Calculator,
    },
    {
      duration: '60m',
      subject: 'Physics',
      topicFallback: 'Kinematics & Optics',
      timeSlot: '11:15 AM',
      defaultStatus: 'scheduled',
      icon: Compass,
    },
    {
      duration: '45m',
      subject: 'General Studies',
      topicFallback: 'Indian Constitution',
      timeSlot: '01:45 PM',
      defaultStatus: 'overdue',
      icon: BookOpen,
    },
    {
      duration: '50m',
      subject: 'Defence Studies',
      topicFallback: 'Military Strategy',
      timeSlot: '03:30 PM',
      defaultStatus: 'scheduled',
      icon: Shield,
    },
    {
      duration: '40m',
      subject: 'English',
      topicFallback: 'Comprehension & Vocabulary',
      timeSlot: '05:15 PM',
      defaultStatus: 'completed',
      icon: PenTool,
    },
  ];

  const pills: PillSlot[] = defaultSlots.map((slot, index) => {
    const matched = prioritized[index];
    if (matched) {
      let status: 'upcoming' | 'scheduled' | 'overdue' | 'completed';
      if (matched.status === 'overdue') status = 'overdue';
      else if (matched.status === 'covered') status = 'completed';
      else if (matched.status === 'in_progress' || matched.status === 'unverified') status = 'upcoming';
      else status = 'scheduled';

      return {
        id: matched.topic_id || `slot-${index}`,
        duration: slot.duration,
        subject: matched.subject_name || slot.subject,
        topicName: matched.topic_name || slot.topicFallback,
        timeSlot: slot.timeSlot,
        status,
        icon: slot.icon,
      };
    }

    return {
      id: `slot-${index}`,
      duration: slot.duration,
      subject: slot.subject,
      topicName: slot.topicFallback,
      timeSlot: slot.timeSlot,
      status: slot.defaultStatus,
      icon: slot.icon,
    };
  });

  const completedCount = pills.filter((p) => p.status === 'completed').length;
  const overdueCount = pills.filter((p) => p.status === 'overdue').length;

  return (
    <section aria-labelledby="study-plan-title" className="space-y-3.5 w-full min-w-0 overflow-hidden">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h2
          id="study-plan-title"
          className="text-base font-bold text-[var(--text-primary)] tracking-tight"
        >
          Your study plan today
        </h2>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          5 scheduled sessions &bull; <span className="tabular-nums font-mono">{completedCount}</span> completed &bull;{' '}
          {overdueCount > 0 ? (
            <span className="text-[var(--status-red)] font-semibold">
              <span className="tabular-nums font-mono">{overdueCount}</span> action required
            </span>
          ) : (
            <span className="text-[var(--status-green)] font-semibold">on schedule</span>
          )}
        </p>
      </div>

      {/* 5 Pill-Shaped Columns */}
      <div className="flex sm:grid sm:grid-cols-5 gap-2.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none snap-x snap-mandatory w-full min-w-0">
        {pills.map((pill) => {
          const Icon = pill.icon;

          let bgClass = 'bg-[var(--status-gray-bg)]';
          let borderClass = 'border-[var(--status-gray-border)]';
          let textAccent = 'text-[var(--status-gray)]';
          let statusLabel = 'Scheduled';
          let StatusIcon = Clock;

          if (pill.status === 'upcoming') {
            bgClass = 'bg-[var(--status-yellow-bg)]';
            borderClass = 'border-[var(--status-yellow-border)]';
            textAccent = 'text-[var(--status-yellow)]';
            statusLabel = 'In Progress';
            StatusIcon = Hourglass;
          } else if (pill.status === 'overdue') {
            bgClass = 'bg-[var(--status-red-bg)]';
            borderClass = 'border-[var(--status-red-border)]';
            textAccent = 'text-[var(--status-red)]';
            statusLabel = 'Deadline';
            StatusIcon = AlertCircle;
          } else if (pill.status === 'completed') {
            bgClass = 'bg-[var(--status-green-bg)]';
            borderClass = 'border-[var(--status-green-border)]';
            textAccent = 'text-[var(--status-green)]';
            statusLabel = 'Done';
            StatusIcon = CheckCircle2;
          }

          return (
            <div
              key={pill.id}
              tabIndex={0}
              role="article"
              aria-label={`${pill.subject}: ${pill.topicName}, ${pill.duration}, ${pill.timeSlot}, Status: ${statusLabel}`}
              className={`min-w-[125px] sm:min-w-0 flex-1 snap-start rounded-[24px] p-3.5 border ${borderClass} ${bgClass} shadow-[var(--shadow-soft)] flex flex-col justify-between items-center text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-secondary)] focus-visible:ring-offset-2 cursor-pointer select-none`}
              style={{ borderRadius: '24px' }}
            >
              {/* Duration / Minutes */}
              <div className="w-full flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
                <span className="font-mono tabular-nums text-xs">{pill.duration}</span>
                <StatusIcon className={`w-3.5 h-3.5 ${textAccent}`} />
              </div>

              {/* Subject Icon */}
              <div className="w-10 h-10 rounded-full bg-[var(--surface-shell)] border border-[var(--border-subtle)] flex items-center justify-center my-1.5 shadow-[var(--shadow-soft)]">
                <Icon className="w-5 h-5 text-[var(--icon-color)]" />
              </div>

              {/* Subject & Topic Name */}
              <div className="my-1.5 w-full">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate" title={pill.subject}>
                  {pill.subject}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] truncate" title={pill.topicName}>
                  {pill.topicName}
                </p>
              </div>

              {/* Time Slot & Status */}
              <div className="w-full pt-2 border-t border-[var(--border-subtle)] mt-1 flex flex-col items-center gap-0.5">
                <span className="text-[10.5px] font-mono text-[var(--text-secondary)] tabular-nums">
                  {pill.timeSlot}
                </span>
                <span className={`text-[9.5px] font-semibold uppercase tracking-wider ${textAccent}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
