import React from 'react';
import Link from 'next/link';
import { requireAccess } from '@/lib/auth-guard';
import { getDashboardData } from '@/lib/dashboard-data';
import { formatISTDate, formatISTDateTime } from '@/lib/date-utils';
import { logoutAction } from '@/app/actions/auth-actions';
import { CumulativeChart } from '@/components/dashboard/cumulative-chart';
import { TopicSheetTable } from '@/components/dashboard/topic-sheet-table';
import {
  FileSpreadsheet,
  Download,
  GraduationCap,
  Shield,
  Layers,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Flame,
  UserCheck,
  LogOut,
} from 'lucide-react';

interface DashboardPageProps {
  searchParams: Promise<{ course?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // Enforce session access: requires Faculty or Administrator
  const access = await requireAccess('dashboard');

  const resolvedParams = await searchParams;
  const courseId = resolvedParams.course;

  const data = await getDashboardData(courseId);

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans">
        <p className="text-sm text-zinc-500">No active courses found. Please seed the database.</p>
      </div>
    );
  }

  const {
    courses,
    selectedCourse,
    overviewMetrics,
    subjectProgress,
    topicProgress,
    teacherScorecard,
    timelineData,
    recentEntries,
    today,
  } = data;

  const isAhead = overviewMetrics.variancePct >= 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Modern Executive Navigation Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Academy Branding */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              AA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  ABHIGYAN ACADEMY
                </h1>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Pacing
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">Defence Exam Coaching Syllabus & Class Tracker</p>
            </div>
          </div>

          {/* Quick Context & Portal Links */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-xl shadow-inner font-mono">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>IST: <strong className="text-zinc-200">{formatISTDate(today)}</strong></span>
            </div>

            <Link
              href="/submit"
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all border border-zinc-800 hover:border-zinc-700 shadow-sm"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Student Form</span>
            </Link>

            {access.user?.role === 'faculty' && (
              <Link
                href="/teacher"
                className="flex items-center gap-1.5 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all border border-indigo-800/50 shadow-sm"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>My Workspace</span>
              </Link>
            )}

            {access.user?.role === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 bg-violet-950/60 hover:bg-violet-900/60 text-violet-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all border border-violet-800/50 shadow-sm"
              >
                <Shield className="w-3.5 h-3.5 text-violet-400" />
                <span>Admin Center</span>
              </Link>
            )}

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all border border-rose-500/30"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>

        {/* Segmented Course Control Bar (Linear / Raycast Style) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2 border-t border-zinc-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Courses:
          </span>
          {courses.map((c) => {
            const isSelected = c.id === selectedCourse.id;
            return (
              <Link
                key={c.id}
                href={`/dashboard?course=${c.id}`}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-zinc-800 text-white font-semibold shadow-md ring-1 ring-white/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <span>{c.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                    isSelected ? 'bg-zinc-900 text-zinc-200' : 'bg-zinc-900/80 text-zinc-500'
                  }`}
                >
                  {c.code}
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Course Banner & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-zinc-900/90 to-zinc-900/50 border border-zinc-800/80 p-5 rounded-2xl shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {selectedCourse.name}
              </h2>
              <span className="text-xs font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                {selectedCourse.code}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Required student confirmations: <strong className="text-zinc-200">{overviewMetrics.confirmationThreshold} distinct students</strong> &bull; Schedule comparison in IST
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={`/api/export?type=progress&courseId=${selectedCourse.id}`}
              download
              className="flex items-center gap-2 bg-zinc-950/80 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold px-3.5 py-2 rounded-xl border border-zinc-800/80 hover:border-zinc-700 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export Progress CSV</span>
            </a>
            <a
              href={`/api/export?type=entries&courseId=${selectedCourse.id}`}
              download
              title="Export Report"
              className="flex items-center gap-2 bg-zinc-950/80 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold px-3.5 py-2 rounded-xl border border-zinc-800/80 hover:border-zinc-700 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Report</span>
            </a>
          </div>
        </div>

        {/* 1. Modern KPI Cards Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Actual Covered */}
          <div className="relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between group hover:border-emerald-500/40 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Syllabus Covered
              </span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {overviewMetrics.coveragePct}%
              </div>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 border border-zinc-800/60">
                <div
                  style={{ width: `${overviewMetrics.coveragePct}%` }}
                  className="bg-emerald-400 h-full rounded-full"
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5 font-mono">
                {overviewMetrics.coveredTopics} of {overviewMetrics.totalTopics} topics
              </p>
            </div>
          </div>

          {/* Card 2: Planned Target */}
          <div className="relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between group hover:border-indigo-500/40 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Planned Target
              </span>
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-indigo-400 font-mono tracking-tight">
                {overviewMetrics.plannedPct}%
              </div>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 border border-zinc-800/60">
                <div
                  style={{ width: `${overviewMetrics.plannedPct}%` }}
                  className="bg-indigo-400 h-full rounded-full"
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5 font-mono">
                {overviewMetrics.plannedTopics} target by today
              </p>
            </div>
          </div>

          {/* Card 3: Schedule Variance */}
          <div className="relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between group hover:border-zinc-700 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Schedule Variance
              </span>
              <div className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <div
                className={`text-3xl font-black font-mono tracking-tight flex items-center gap-1 ${
                  isAhead ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isAhead ? (
                  <>
                    <ArrowUpRight className="w-6 h-6" /> +{overviewMetrics.variancePct}%
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-6 h-6" /> {overviewMetrics.variancePct}%
                  </>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-2 font-medium">
                {isAhead ? 'Pacing ahead of target' : 'Behind planned schedule'}
              </p>
            </div>
          </div>

          {/* Card 4: Overdue Topics */}
          <div className="relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between group hover:border-rose-500/40 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Overdue Topics
              </span>
              <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-rose-400 font-mono tracking-tight">
                {overviewMetrics.overdueCount}
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                Passed target date, not covered
              </p>
            </div>
          </div>

          {/* Card 5: Review Queue */}
          <div className="relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between group hover:border-amber-500/40 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Review Queue
              </span>
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                {overviewMetrics.pendingReviewCount}
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                {overviewMetrics.pendingReviewCount > 0 ? (
                  <Link href="/admin" className="text-amber-400 hover:underline font-semibold">
                    Review in Admin &rarr;
                  </Link>
                ) : (
                  'All submissions clear'
                )}
              </p>
            </div>
          </div>

          {/* Card 6: Enrolled Students */}
          <div className="relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between group hover:border-zinc-700 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Students Active
              </span>
              <div className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-zinc-100 font-mono tracking-tight">
                {overviewMetrics.enrolledStudents}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2 font-mono">
                {overviewMetrics.totalClassesLogged} class sessions logged
              </p>
            </div>
          </div>
        </div>

        {/* 2. Dual Visualizations: Subject Progress & Cumulative Trajectory */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Subject Progress Bars (5 cols) */}
          <div className="lg:col-span-5 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Subject Pacing & Completion
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Planned schedule vs actual coverage</p>
                </div>
                <span className="text-xs font-mono bg-zinc-950 px-2 py-1 rounded-lg text-zinc-400 border border-zinc-800">
                  {subjectProgress.length} subjects
                </span>
              </div>

              <div className="space-y-5">
                {subjectProgress.map((sub) => {
                  const subAhead = sub.variance_pct >= 0;
                  return (
                    <div key={sub.subject_id} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-200">{sub.subject_name}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-emerald-400 font-bold">{sub.actual_pct}% act</span>
                          <span className="text-zinc-600">/</span>
                          <span className="text-indigo-400 font-medium">{sub.planned_pct}% tgt</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                              subAhead
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {subAhead ? `+${sub.variance_pct}%` : `${sub.variance_pct}%`}
                          </span>
                        </div>
                      </div>

                      {/* Dual Bar */}
                      <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden flex relative border border-zinc-800/80">
                        {/* Target line indicator */}
                        <div
                          style={{ left: `${Math.min(sub.planned_pct, 100)}%` }}
                          className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-10 shadow-sm shadow-indigo-400/50"
                          title={`Target Line: ${sub.planned_pct}%`}
                        />
                        {/* Actual progress */}
                        <div
                          style={{ width: `${Math.min(sub.actual_pct, 100)}%` }}
                          className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                        <span>{sub.covered_topics} of {sub.total_topics} topics covered</span>
                        <span>{sub.planned_topics} planned by today</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block shadow-sm shadow-emerald-400/50"></span>
                Actual Covered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-indigo-400 inline-block shadow-sm shadow-indigo-400/50"></span>
                Target Schedule Line
              </span>
            </div>
          </div>

          {/* Cumulative Trajectory Chart (7 cols) */}
          <div className="lg:col-span-7 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Cumulative Planned vs Actual Trajectory
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Syllabus timeline trajectory in IST</p>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                {overviewMetrics.coveragePct}% Covered
              </span>
            </div>

            <CumulativeChart data={timelineData} />

            <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>X-Axis: Target Dates &bull; Y-Axis: Cumulative Topics</span>
              <span className="text-zinc-300">Target Date Engine: Asia/Kolkata</span>
            </div>
          </div>
        </div>

        {/* 3. Faculty Pacing & Scorecard Sheet */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Faculty Pacing & Performance Scorecard
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Teacher pacing evaluation against curriculum target dates
              </p>
            </div>
            <span className="text-xs font-mono bg-zinc-950 px-2 py-1 rounded-lg text-zinc-400 border border-zinc-800">
              {teacherScorecard.length} Faculty Assigned
            </span>
          </div>

          <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="py-3 px-4 border-r border-zinc-800/60">Faculty Member</th>
                  <th className="py-3 px-4 border-r border-zinc-800/60">Assigned Subjects</th>
                  <th className="py-3 px-3 text-center border-r border-zinc-800/60">Topics Covered</th>
                  <th className="py-3 px-3 text-center border-r border-zinc-800/60">Schedule Lag (Days)</th>
                  <th className="py-3 px-3 border-r border-zinc-800/60">Last Class Logged</th>
                  <th className="py-3 px-3 text-center">Classes This Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {teacherScorecard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500 font-sans">
                      No faculty assigned to subjects in this course.
                    </td>
                  </tr>
                ) : (
                  teacherScorecard.map((tea) => (
                    <tr key={tea.teacher_id} className="hover:bg-zinc-900/60 transition-colors text-zinc-300">
                      <td className="py-2.5 px-4 font-semibold text-zinc-100 border-r border-zinc-800/60">
                        {tea.teacher_name}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400 border-r border-zinc-800/60 text-xs">
                        {tea.subject_names || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400 border-r border-zinc-800/60">
                        {tea.topics_covered}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono border-r border-zinc-800/60">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            tea.avg_lag_days <= 0
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : tea.avg_lag_days <= 3
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {tea.avg_lag_days > 0 ? `+${tea.avg_lag_days}d lag` : `${tea.avg_lag_days}d on schedule`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400 border-r border-zinc-800/60 text-xs">
                        {formatISTDate(tea.last_class_logged)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-200">
                        {tea.classes_logged_this_month}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Master Topic Progress Matrix */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Curriculum Topic Sheet
                <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
                  {topicProgress.length} items
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Topic verification status, target schedule compliance, and student confirmation ledger
              </p>
            </div>
          </div>

          <TopicSheetTable
            topics={topicProgress}
            confirmationThreshold={overviewMetrics.confirmationThreshold}
          />
        </div>

        {/* 5. Recent Activity Ledger */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Recent Class Submissions Activity
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Live stream of verified student class entries with anti-misuse flags
              </p>
            </div>
            <a
              href={`/api/export?type=entries&courseId=${selectedCourse.id}`}
              download
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono"
            >
              Full Entry Log CSV &rarr;
            </a>
          </div>

          <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-zinc-800/60">Class Date</th>
                    <th className="py-2.5 px-3 border-r border-zinc-800/60">Student</th>
                    <th className="py-2.5 px-3 border-r border-zinc-800/60">Faculty</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/60">Subject & Topic</th>
                    <th className="py-2.5 px-3 text-center border-r border-zinc-800/60">Status</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/60">Remarks / Flags</th>
                    <th className="py-2.5 px-3 text-right">Logged At (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-zinc-500">
                        No submissions recorded for this course yet.
                      </td>
                    </tr>
                  ) : (
                    recentEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-zinc-900/50 transition-colors text-zinc-300">
                        <td className="py-2 px-3 font-mono text-zinc-400 border-r border-zinc-800/60">
                          {formatISTDate(e.class_date)}
                        </td>
                        <td className="py-2 px-3 border-r border-zinc-800/60">
                          <span className="font-semibold text-zinc-100">{e.student_name}</span>
                          <span className="block font-mono text-[10px] text-zinc-500">
                            {e.roll_no}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-300 border-r border-zinc-800/60">
                          {e.teacher_name}
                        </td>
                        <td className="py-2 px-4 border-r border-zinc-800/60">
                          <span className="font-medium text-zinc-200">{e.topic_name}</span>
                          <span className="block text-[11px] text-zinc-400">{e.subject_name}</span>
                        </td>
                        <td className="py-2 px-3 text-center border-r border-zinc-800/60">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              e.status === 'covered'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : e.status === 'partial'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 border-r border-zinc-800/60 text-zinc-400 text-xs">
                          {e.remarks && <span className="block text-zinc-200 italic">&quot;{e.remarks}&quot;</span>}
                          {e.flags && e.flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {e.flags.map((fl) => (
                                <span
                                  key={fl}
                                  className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded font-mono font-semibold"
                                >
                                  {fl}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-zinc-400 text-[11px]">
                          {formatISTDateTime(e.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800/80 py-4 text-center text-xs text-zinc-500 font-mono">
        Abhigyan Academy Syllabus Tracker &bull; Phase 1 Core System &bull; IST Reference: {today}
      </footer>
    </div>
  );
}
