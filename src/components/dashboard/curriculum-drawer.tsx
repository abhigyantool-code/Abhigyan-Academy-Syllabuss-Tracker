'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Download,
  BarChart3,
  BookOpen,
  UserCheck,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { formatISTDate } from '@/lib/date-utils';
import { TopicSheetTable } from './topic-sheet-table';
import { CumulativeChart } from './cumulative-chart';
import type { getDashboardData } from '@/lib/dashboard-data';

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;

interface CurriculumDrawerProps {
  data: DashboardData;
}

export function CurriculumDrawer({ data }: CurriculumDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'topics' | 'trajectory' | 'faculty' | 'sessions' | 'batches'>('topics');

  const {
    courses,
    selectedCourse,
    overviewMetrics,
    crossClassComparison,
    academyCoverage,
    subjectProgress,
    topicProgress,
    teacherScorecard,
    timelineData,
    teachingSessions,
    today,
  } = data;

  return (
    <div className="w-full min-w-0 mt-8 pt-6 border-t border-[var(--border-subtle)]">
      {/* Drawer Toggle Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[var(--icon-color)]" />
            Curriculum Ledger &amp; Detailed Analytics
          </h2>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            Full topic verification matrix, faculty scorecards, CSV exports, and pacing trajectory
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Export Actions */}
          <a
            href={`/api/export?type=progress&courseId=${selectedCourse.id}`}
            download
            className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] transition-colors"
            title="Export Progress CSV"
          >
            <Download className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">Progress CSV</span>
          </a>

          <a
            href={`/api/export?type=entries&courseId=${selectedCourse.id}`}
            download
            className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] transition-colors"
            title="Export Report"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Report</span>
          </a>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-controls="curriculum-drawer-content"
            className="h-8 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-bold bg-[var(--text-primary)] text-[var(--surface-shell)] shadow-[var(--shadow-soft)] hover:opacity-90 transition-all cursor-pointer"
          >
            <span>{isOpen ? 'Collapse Details' : 'Expand Details'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Panel */}
      {isOpen && (
        <div id="curriculum-drawer-content" className="mt-6 space-y-6 animate-fadeIn">
          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[var(--border-subtle)] scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('topics')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'topics'
                  ? 'bg-[var(--text-primary)] text-[var(--surface-shell)]'
                  : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Topic Matrix ({topicProgress.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trajectory')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'trajectory'
                  ? 'bg-[var(--text-primary)] text-[var(--surface-shell)]'
                  : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Trajectory Chart &amp; Subjects
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('faculty')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'faculty'
                  ? 'bg-[var(--text-primary)] text-[var(--surface-shell)]'
                  : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Faculty Scorecard ({teacherScorecard.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'sessions'
                  ? 'bg-[var(--text-primary)] text-[var(--surface-shell)]'
                  : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Teaching Sessions ({teachingSessions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('batches')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'batches'
                  ? 'bg-[var(--text-primary)] text-[var(--surface-shell)]'
                  : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Cross-Class Batches ({crossClassComparison.length})
            </button>
          </div>

          {/* Tab 1: Topic Matrix */}
          {activeTab === 'topics' && (
            <div className="rounded-[24px] p-4 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Curriculum Topic Sheet ({selectedCourse.name})
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Filterable ledger with student confirmation counts and target schedule status
                  </p>
                </div>
              </div>

              <TopicSheetTable
                topics={topicProgress}
                confirmationThreshold={overviewMetrics.confirmationThreshold}
              />
            </div>
          )}

          {/* Tab 2: Trajectory Chart & Subjects */}
          {activeTab === 'trajectory' && (
            <div className="space-y-6">
              {/* Trajectory AreaChart */}
              <div className="rounded-[24px] p-5 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                      Planned vs Actual Trajectory
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Cumulative syllabus completion curve over scheduled target dates (Asia/Kolkata)
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--status-green)]">
                    {overviewMetrics.coveragePct}% Covered
                  </span>
                </div>

                <div className="pt-2">
                  <CumulativeChart data={timelineData} />
                </div>
              </div>

              {/* Subject Breakdown */}
              <div className="rounded-[24px] p-5 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
                  Subject Completion Breakdown
                </h3>

                <div className="space-y-4">
                  {subjectProgress.map((sub) => {
                    const isAhead = sub.variance_pct >= 0;
                    return (
                      <div key={sub.subject_id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--text-primary)]">
                            {sub.subject_name}
                          </span>
                          <div className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
                            <span className="text-[var(--status-green)] font-bold">
                              {sub.actual_pct}% act
                            </span>
                            <span className="text-[var(--text-muted)]">/</span>
                            <span className="text-[var(--text-secondary)]">
                              {sub.planned_pct}% tgt
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full font-semibold text-[10px] ${
                                isAhead
                                  ? 'text-[var(--status-green)] bg-[var(--status-green-bg)]'
                                  : 'text-[var(--status-red)] bg-[var(--status-red-bg)]'
                              }`}
                            >
                              {isAhead ? `+${sub.variance_pct}%` : `${sub.variance_pct}%`}
                            </span>
                          </div>
                        </div>

                        <div className="h-2.5 w-full bg-[var(--surface-muted)] rounded-full overflow-hidden flex relative border border-[var(--border-subtle)]">
                          <div
                            style={{ width: `${Math.min(sub.actual_pct, 100)}%` }}
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono tabular-nums">
                          <span>{sub.covered_topics} of {sub.total_topics} covered</span>
                          <span>{sub.planned_topics} target</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Faculty Scorecard */}
          {activeTab === 'faculty' && (
            <div className="rounded-[24px] p-5 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
                Faculty Pacing &amp; Performance Scorecard
              </h3>

              <div className="overflow-x-auto rounded-[16px] border border-[var(--border-subtle)]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[10.5px]">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Faculty Member</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Subjects</th>
                      <th className="py-2.5 px-3 text-center border-r border-[var(--border-subtle)]">Topics</th>
                      <th className="py-2.5 px-3 text-center border-r border-[var(--border-subtle)]">Schedule Lag</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Last Class</th>
                      <th className="py-2.5 px-3 text-center">Month Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {teacherScorecard.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                          No faculty assigned to subjects in this course.
                        </td>
                      </tr>
                    ) : (
                      teacherScorecard.map((tea) => (
                        <tr key={tea.teacher_id} className="hover:bg-[var(--surface-muted)] transition-colors text-[var(--text-secondary)]">
                          <td className="py-2 px-3 font-semibold text-[var(--text-primary)] border-r border-[var(--border-subtle)]">
                            {tea.teacher_name}
                          </td>
                          <td className="py-2 px-3 border-r border-[var(--border-subtle)] text-[11px]">
                            {tea.subject_names || 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-[var(--status-green)] border-r border-[var(--border-subtle)] tabular-nums">
                            {tea.topics_covered}
                          </td>
                          <td className="py-2 px-3 text-center font-mono border-r border-[var(--border-subtle)] tabular-nums">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                tea.avg_lag_days <= 0
                                  ? 'bg-[var(--status-green-bg)] text-[var(--status-green)]'
                                  : 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)]'
                              }`}
                            >
                              {tea.avg_lag_days > 0 ? `+${tea.avg_lag_days}d` : `${tea.avg_lag_days}d`}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] border-r border-[var(--border-subtle)] tabular-nums">
                            {formatISTDate(tea.last_class_logged)}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-[var(--text-primary)] tabular-nums">
                            {tea.classes_logged_this_month}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 4: Teaching Sessions */}
          {activeTab === 'sessions' && (
            <div className="rounded-[24px] p-5 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
                Verified Teaching Sessions Activity
              </h3>

              <div className="overflow-x-auto rounded-[16px] border border-[var(--border-subtle)]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[10.5px]">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Session Date</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Faculty</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Batch &amp; Subject</th>
                      <th className="py-2.5 px-3 border-r border-[var(--border-subtle)]">Topic</th>
                      <th className="py-2.5 px-3 text-center border-r border-[var(--border-subtle)]">Status</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {teachingSessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                          No faculty teaching sessions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      teachingSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-[var(--surface-muted)] transition-colors text-[var(--text-secondary)]">
                          <td className="py-2 px-3 font-mono border-r border-[var(--border-subtle)] whitespace-nowrap tabular-nums">
                            {formatISTDate(s.session_date)}
                          </td>
                          <td className="py-2 px-3 font-semibold text-[var(--text-primary)] border-r border-[var(--border-subtle)] whitespace-nowrap">
                            {s.teacher_name}
                          </td>
                          <td className="py-2 px-3 border-r border-[var(--border-subtle)] whitespace-nowrap">
                            <span className="font-semibold block">{s.subject_name}</span>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">{s.course_name}</span>
                          </td>
                          <td className="py-2 px-3 border-r border-[var(--border-subtle)]">
                            <span className="font-medium text-[var(--text-primary)]">
                              {s.topic_seq ? `#${s.topic_seq} &bull; ` : ''}{s.topic_name}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center border-r border-[var(--border-subtle)] whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--status-green-bg)] text-[var(--status-green)] border border-[var(--status-green-border)]">
                              {s.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[var(--text-muted)] italic text-[11px]">
                            {s.remarks || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 5: Cross-Class Comparison */}
          {activeTab === 'batches' && (
            <div className="rounded-[24px] p-5 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
                Cross-Class Batch Matrix
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {crossClassComparison.map((item) => {
                  const isSelected = item.courseId === selectedCourse.id;
                  return (
                    <Link
                      key={item.courseId}
                      href={`/dashboard?course=${item.courseId}`}
                      className={`p-3.5 rounded-[20px] border transition-all ${
                        isSelected
                          ? 'bg-[var(--surface-muted)] border-[var(--text-primary)] shadow-md'
                          : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]'
                      }`}
                      style={{ borderRadius: '20px' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[var(--text-secondary)]">
                          {item.courseCode}
                        </span>
                        <span className="text-sm font-bold font-mono text-[var(--text-primary)] tabular-nums">
                          {item.coveragePct}%
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)] mt-1.5 truncate">
                        {item.courseName}
                      </h4>
                      <div className="w-full bg-[var(--surface-muted)] h-1.5 rounded-full overflow-hidden mt-2 border border-[var(--border-subtle)]">
                        <div
                          style={{ width: `${item.coveragePct}%` }}
                          className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono mt-1.5 tabular-nums">
                        <span>{item.coveredTopics}/{item.totalTopics} Done</span>
                        <span className="text-[var(--status-yellow)]">{item.pendingTopics} Left</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
