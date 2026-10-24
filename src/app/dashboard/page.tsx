import React from 'react';
import Link from 'next/link';
import { requireAccess } from '@/lib/auth-guard';
import { getDashboardData } from '@/lib/dashboard-data';
import { formatISTDate, formatISTDateTime } from '@/lib/date-utils';
import { AuthDisabledBanner } from '@/components/auth-disabled-banner';
import { CumulativeChart } from '@/components/dashboard/cumulative-chart';
import { TopicSheetTable } from '@/components/dashboard/topic-sheet-table';
import {
  FileSpreadsheet,
  Download,
  GraduationCap,
  Shield,
  Layers,
  TrendingUp,
  AlertOctagon,
  Clock,
  CheckCircle,
  Users,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface DashboardPageProps {
  searchParams: Promise<{ course?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // 1. Guard check
  await requireAccess('dashboard');

  const resolvedParams = await searchParams;
  const courseId = resolvedParams.course;

  const data = await getDashboardData(courseId);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">No active courses found. Please seed the database first.</p>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner */}
      <AuthDisabledBanner area="dashboard" />

      {/* Main Sheet Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black">
              AA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">ABHIGYAN ACADEMY</h1>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-semibold">
                  Sheet Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400">Faculty Pacing & Syllabus Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>IST Today: <strong className="text-slate-200">{formatISTDate(today)}</strong></span>
            </div>

            <Link
              href="/submit"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Student Form</span>
            </Link>

            <Link
              href="/admin"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
            >
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              <span>Admin Center</span>
            </Link>
          </div>
        </div>

        {/* Course Tabs (Excel / Airtable sheet tabs style) */}
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 pt-1 text-xs">
          {courses.map((c) => {
            const isSelected = c.id === selectedCourse.id;
            return (
              <Link
                key={c.id}
                href={`/dashboard?course=${c.id}`}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-all ${
                  isSelected
                    ? 'border-indigo-500 text-white bg-slate-800/70 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Layers className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{c.name}</span>
                <span className="font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">
                  {c.code}
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Course Meta & Export Actions Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {selectedCourse.name}
              <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                Threshold: {overviewMetrics.confirmationThreshold} confirmations
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target completion tracking vs student verified class submissions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/export?type=progress&courseId=${selectedCourse.id}`}
              download
              className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-800 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export Progress CSV</span>
            </a>
            <a
              href={`/api/export?type=entries&courseId=${selectedCourse.id}`}
              download
              className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-800 transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Entries CSV</span>
            </a>
          </div>
        </div>

        {/* 1. Clean Sheet KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Actual Covered */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              Coverage
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {overviewMetrics.coveragePct}%
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {overviewMetrics.coveredTopics} of {overviewMetrics.totalTopics} covered
              </p>
            </div>
          </div>

          {/* Card 2: Planned Target */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-sky-400" />
              Planned Target
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-sky-400 font-mono">
                {overviewMetrics.plannedPct}%
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {overviewMetrics.plannedTopics} target by today
              </p>
            </div>
          </div>

          {/* Card 3: Target Variance */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-indigo-400" />
              Schedule Variance
            </span>
            <div className="mt-2">
              <div
                className={`text-2xl font-black font-mono ${
                  isAhead ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isAhead ? `+${overviewMetrics.variancePct}%` : `${overviewMetrics.variancePct}%`}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isAhead ? 'Ahead of syllabus target' : 'Behind planned schedule'}
              </p>
            </div>
          </div>

          {/* Card 4: Overdue Topics */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <AlertOctagon className="w-3 h-3 text-rose-400" />
              Overdue Topics
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-rose-400 font-mono">
                {overviewMetrics.overdueCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Past target date, uncovered</p>
            </div>
          </div>

          {/* Card 5: Review Queue */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3 h-3 text-amber-400" />
              Flagged in Review
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-amber-400 font-mono">
                {overviewMetrics.pendingReviewCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {overviewMetrics.pendingReviewCount > 0 ? (
                  <Link href="/admin" className="text-amber-400 hover:underline">
                    Review in Admin &rarr;
                  </Link>
                ) : (
                  'All submissions clear'
                )}
              </p>
            </div>
          </div>

          {/* Card 6: Enrolled Students */}
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3 text-indigo-400" />
              Students Enrolled
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-slate-200 font-mono">
                {overviewMetrics.enrolledStudents}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {overviewMetrics.totalClassesLogged} class sessions logged
              </p>
            </div>
          </div>
        </div>

        {/* 2. Dual Panels: Subject Progress Bars & Cumulative Line Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Subject Progress Bars (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Subject Completion Ledger
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {subjectProgress.length} subjects
                </span>
              </div>

              <div className="space-y-4">
                {subjectProgress.map((sub) => {
                  const subAhead = sub.variance_pct >= 0;
                  return (
                    <div key={sub.subject_id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{sub.subject_name}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-emerald-400 font-bold">{sub.actual_pct}% act</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-sky-400">{sub.planned_pct}% tgt</span>
                          <span
                            className={`text-[10px] px-1 rounded ${
                              subAhead
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {subAhead ? `+${sub.variance_pct}%` : `${sub.variance_pct}%`}
                          </span>
                        </div>
                      </div>

                      {/* Dual Progress Bar */}
                      <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex relative border border-slate-800">
                        {/* Target line indicator */}
                        <div
                          style={{ left: `${Math.min(sub.planned_pct, 100)}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-10"
                          title={`Planned Target: ${sub.planned_pct}%`}
                        />
                        {/* Actual progress fill */}
                        <div
                          style={{ width: `${Math.min(sub.actual_pct, 100)}%` }}
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>{sub.covered_topics} of {sub.total_topics} topics covered</span>
                        <span>{sub.planned_topics} planned by today</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block"></span> Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-sky-400 inline-block"></span> Target Line
              </span>
            </div>
          </div>

          {/* Cumulative Planned vs Actual Line Chart (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Planned vs Actual Cumulative Trajectory
              </h3>
              <span className="text-xs text-slate-400 font-mono">Timeline Curve</span>
            </div>

            <CumulativeChart data={timelineData} />

            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>IST Timeline: Target dates vs First-taught confirmations</span>
              <span className="font-mono text-emerald-400 font-semibold">
                Status: {overviewMetrics.coveragePct}% syllabus covered
              </span>
            </div>
          </div>
        </div>

        {/* 3. Teacher Performance Scorecard Sheet Table */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Faculty Pacing & Performance Scorecard
              </h3>
              <p className="text-xs text-slate-400">
                Pacing compliance, syllabus completion, and schedule lag against target dates
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800">
              {teacherScorecard.length} Faculty Assigned
            </span>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 border-r border-slate-800/80">Faculty Member</th>
                  <th className="py-2.5 px-4 border-r border-slate-800/80">Assigned Subjects</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Topics Covered</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Schedule Lag (Days)</th>
                  <th className="py-2.5 px-3 border-r border-slate-800/80">Last Class Logged</th>
                  <th className="py-2.5 px-3 text-center">Classes This Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11.5px]">
                {teacherScorecard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                      No faculty records allocated to this course.
                    </td>
                  </tr>
                ) : (
                  teacherScorecard.map((tea) => (
                    <tr key={tea.teacher_id} className="hover:bg-slate-900/60 transition-colors font-sans">
                      <td className="py-2.5 px-4 font-semibold text-slate-200 border-r border-slate-800/60">
                        {tea.teacher_name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 border-r border-slate-800/60 text-xs">
                        {tea.subject_names || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400 border-r border-slate-800/60">
                        {tea.topics_covered}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono border-r border-slate-800/60">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            tea.avg_lag_days <= 0
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : tea.avg_lag_days <= 3
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {tea.avg_lag_days > 0 ? `+${tea.avg_lag_days}d lag` : `${tea.avg_lag_days}d on schedule`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 border-r border-slate-800/60 text-xs">
                        {formatISTDate(tea.last_class_logged)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-200">
                        {tea.classes_logged_this_month}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Master Topic Progress Sheet Grid */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Curriculum Topic Sheet
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">
                  Live View
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Detailed topic-by-topic status matrix, student coverage threshold, and target schedule compliance
              </p>
            </div>
          </div>

          <TopicSheetTable
            topics={topicProgress}
            confirmationThreshold={overviewMetrics.confirmationThreshold}
          />
        </div>

        {/* 5. Recent Class Entries Activity Ledger */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Recent Class Submissions Activity
              </h3>
              <p className="text-xs text-slate-400">
                Audited student entry submissions with IST timestamps and anti-misuse flags
              </p>
            </div>
            <a
              href={`/api/export?type=entries&courseId=${selectedCourse.id}`}
              download
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Full Entry Log &rarr;
            </a>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-800/80">Class Date</th>
                    <th className="py-2 px-3 border-r border-slate-800/80">Student</th>
                    <th className="py-2 px-3 border-r border-slate-800/80">Faculty</th>
                    <th className="py-2 px-3 border-r border-slate-800/80">Subject & Topic</th>
                    <th className="py-2 px-2.5 text-center border-r border-slate-800/80">Status</th>
                    <th className="py-2 px-3 border-r border-slate-800/80">Remarks / Flags</th>
                    <th className="py-2 px-3 text-right">Logged At (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        No submissions recorded for this course yet.
                      </td>
                    </tr>
                  ) : (
                    recentEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-400 border-r border-slate-800/60">
                          {formatISTDate(e.class_date)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-800/60">
                          <span className="font-semibold text-slate-200">{e.student_name}</span>
                          <span className="block font-mono text-[10px] text-slate-500">
                            {e.roll_no}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300 border-r border-slate-800/60">
                          {e.teacher_name}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-800/60">
                          <span className="font-medium text-slate-200">{e.topic_name}</span>
                          <span className="block text-[11px] text-slate-400">{e.subject_name}</span>
                        </td>
                        <td className="py-2 px-2.5 text-center border-r border-slate-800/60">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              e.status === 'covered'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : e.status === 'partial'
                                ? 'bg-sky-500/20 text-sky-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-800/60 text-slate-400 text-xs">
                          {e.remarks && <span className="block text-slate-300 italic">"{e.remarks}"</span>}
                          {e.flags && e.flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {e.flags.map((fl) => (
                                <span
                                  key={fl}
                                  className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1 py-0.2 rounded font-mono"
                                >
                                  {fl}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400 text-[11px]">
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
    </div>
  );
}
