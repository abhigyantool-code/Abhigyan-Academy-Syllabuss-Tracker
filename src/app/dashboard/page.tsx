import React from 'react';
import Link from 'next/link';
import { requireAccess } from '@/lib/auth-guard';
import { getDashboardData } from '@/lib/dashboard-data';
import { formatISTDate } from '@/lib/date-utils';
import { logoutAction } from '@/app/actions/auth-actions';
import { CumulativeChart } from '@/components/dashboard/cumulative-chart';
import { TopicSheetTable } from '@/components/dashboard/topic-sheet-table';
import {
  FileSpreadsheet,
  Download,
  GraduationCap,
  Shield,
  Layers,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  LogOut,
  Target,
  BarChart3,
  BookOpen,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

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
        <p className="text-sm text-zinc-500">No active course records found in academy curriculum.</p>
      </div>
    );
  }

  const {
    courses,
    selectedCourse,
    overviewMetrics,
    pacingMetrics,
    crossClassComparison,
    academyCoverage,
    subjectProgress,
    topicProgress,
    teacherScorecard,
    timelineData,
    teachingSessions,
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
                  Faculty Executive Dashboard
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">Defence Exam Coaching Syllabus &amp; Class Tracker</p>
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
              <span>Student Portal</span>
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

        {/* Segmented Course Control Bar */}
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
        {/* Academy-Wide Coverage Executive Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-indigo-950/40 to-zinc-900 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Target className="w-3 h-3 text-indigo-400" />
                  Academy-Wide Curriculum Matrix
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {courses.length} Active Batches
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Overall Academy Syllabus Coverage: <span className="text-indigo-400 font-mono">{academyCoverage.overallCoveragePct}%</span>
              </h2>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Calculated across all batches using authenticated faculty teaching sessions and verified classroom completions. Zero private student data exposed.
              </p>
            </div>

            {/* Quick Metrics Badge Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-mono text-zinc-400 block font-semibold">Total Topics</span>
                <span className="text-lg font-black text-white font-mono">{academyCoverage.totalTopics}</span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-mono text-emerald-400 block font-semibold">Covered</span>
                <span className="text-lg font-black text-emerald-400 font-mono">{academyCoverage.coveredTopics}</span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-mono text-amber-400 block font-semibold">Pending</span>
                <span className="text-lg font-black text-amber-400 font-mono">{academyCoverage.pendingTopics}</span>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-mono text-sky-400 block font-semibold">Overall Pace</span>
                <span className="text-lg font-black text-sky-400 font-mono">{academyCoverage.overallCoveragePct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Class Batch Comparison Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Cross-Class Batch Comparison
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">Live Pacing Across All Courses</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {crossClassComparison.map((item) => {
              const isSelected = item.courseId === selectedCourse.id;
              return (
                <Link
                  key={item.courseId}
                  href={`/dashboard?course=${item.courseId}`}
                  className={`p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-indigo-500 shadow-lg ring-1 ring-indigo-500/20'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                      {item.courseCode}
                    </span>
                    <span className="text-sm font-black font-mono text-white">
                      {item.coveragePct}%
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200 mt-2 truncate">
                    {item.courseName}
                  </h4>
                  <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 border border-zinc-800/80">
                    <div
                      style={{ width: `${item.coveragePct}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mt-2">
                    <span>{item.coveredTopics}/{item.totalTopics} Covered</span>
                    <span className="text-amber-400">{item.pendingTopics} Pending</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Selected Course Context Banner & Actions */}
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
              Teaching schedule &amp; syllabus verification metrics in IST &bull; Minimum student confirmation threshold: <strong className="text-zinc-200">{overviewMetrics.confirmationThreshold}</strong>
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

        {/* Daily, Weekly, Monthly Pacing & Course Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Today's Classes */}
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Classes Today
            </span>
            <div className="mt-3">
              <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {pacingMetrics.dailyClassesCount}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Conducted on {today}</p>
            </div>
          </div>

          {/* Card 2: Weekly Classes */}
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Past 7 Days
            </span>
            <div className="mt-3">
              <div className="text-3xl font-black text-indigo-400 font-mono tracking-tight">
                {pacingMetrics.weeklyClassesCount}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Weekly lecture pace</p>
            </div>
          </div>

          {/* Card 3: Monthly Classes */}
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              This Month
            </span>
            <div className="mt-3">
              <div className="text-3xl font-black text-sky-400 font-mono tracking-tight">
                {pacingMetrics.monthlyClassesCount}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Monthly total classes</p>
            </div>
          </div>

          {/* Card 4: Syllabus Covered % */}
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Batch Completion
            </span>
            <div className="mt-3">
              <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {overviewMetrics.coveragePct}%
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                {overviewMetrics.coveredTopics}/{overviewMetrics.totalTopics} covered
              </p>
            </div>
          </div>

          {/* Card 5: Pending Topics */}
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Pending Topics
            </span>
            <div className="mt-3">
              <div className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                {pacingMetrics.pendingTopicsCount}
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                Remaining in batch
              </p>
            </div>
          </div>

          {/* Card 6: Schedule Variance */}
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Schedule Variance
            </span>
            <div className="mt-3">
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
              <p className="text-[10px] text-zinc-400 mt-1">
                {isAhead ? 'Pacing ahead of target' : 'Behind target schedule'}
              </p>
            </div>
          </div>
        </div>

        {/* Dual Visualizations: Subject Progress & Cumulative Trajectory */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Subject Progress Bars */}
          <div className="lg:col-span-5 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Subject Pacing &amp; Completion
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
                        <div
                          style={{ left: `${Math.min(sub.planned_pct, 100)}%` }}
                          className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-10 shadow-sm shadow-indigo-400/50"
                          title={`Target Line: ${sub.planned_pct}%`}
                        />
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

          {/* Cumulative Trajectory Chart */}
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

        {/* Faculty Pacing & Scorecard Sheet */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Faculty Pacing &amp; Performance Scorecard
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

        {/* Master Topic Progress Matrix */}
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

        {/* Genuine Faculty Teaching Sessions Activity (Zero Student Privacy Leaks) */}
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Verified Teaching Sessions Activity
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Official faculty lecture endorsements and verified classroom sessions
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              {teachingSessions.length} Recorded Sessions
            </span>
          </div>

          <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-zinc-800/60">Session Date</th>
                    <th className="py-2.5 px-3 border-r border-zinc-800/60">Faculty Member</th>
                    <th className="py-2.5 px-3 border-r border-zinc-800/60">Batch &amp; Subject</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/60">Topic Covered</th>
                    <th className="py-2.5 px-3 text-center border-r border-zinc-800/60">Status</th>
                    <th className="py-2.5 px-4">Session Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {teachingSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No faculty teaching sessions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    teachingSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-900/50 transition-colors text-zinc-300">
                        <td className="py-2 px-3 font-mono text-zinc-400 border-r border-zinc-800/60 whitespace-nowrap">
                          {formatISTDate(s.session_date)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-zinc-100 border-r border-zinc-800/60 whitespace-nowrap">
                          {s.teacher_name}
                        </td>
                        <td className="py-2 px-3 border-r border-zinc-800/60 whitespace-nowrap">
                          <span className="font-semibold text-zinc-200 block">{s.subject_name}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{s.course_name}</span>
                        </td>
                        <td className="py-2 px-4 border-r border-zinc-800/60">
                          <span className="font-medium text-zinc-200">
                            {s.topic_seq ? `#${s.topic_seq} • ` : ''}{s.topic_name}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center border-r border-zinc-800/60 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-zinc-400 text-xs italic">
                          {s.remarks || '—'}
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
        Abhigyan Academy Syllabus Tracker &bull; Faculty Executive Dashboard &bull; Asia/Kolkata Reference
      </footer>
    </div>
  );
}
