import React from 'react';
import Link from 'next/link';
import { requireAccess } from '@/lib/auth-guard';
import { getPbClient } from '@/lib/pb';
import { logoutAction } from '@/app/actions/auth-actions';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  LogOut,
  Send,
  Layers,
  Shield,
  Users,
  ExternalLink,
} from 'lucide-react';
import { StudentPinModal } from '@/components/student/student-pin-modal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Student Dashboard — Abhigyan Academy',
  description: 'View your personal syllabus progress, classroom submissions, and faculty review feedback.',
};

interface StudentPageProps {
  searchParams?: Promise<{ mustChangePin?: string; studentId?: string }>;
}

export default async function StudentDashboardPage({ searchParams }: StudentPageProps) {
  const access = await requireAccess('student');
  const resolvedParams = searchParams ? await searchParams : {};
  const isAdmin = access.user?.role === 'admin';
  const targetStudentId = isAdmin && resolvedParams.studentId
    ? resolvedParams.studentId
    : (access.user?.studentId || access.user?.id);
  const mustChangePin = !isAdmin && Boolean(access.user?.mustChangePin || resolvedParams.mustChangePin === 'true');

  const pb = await getPbClient();

  // If Admin is accessing /student without a specific studentId, render Authorized Student Management Directory
  if (isAdmin && !resolvedParams.studentId) {
    const [allStudents, allEnrollments, allEntries] = await Promise.all([
      pb.collection('students').getFullList({ filter: 'active = true', sort: 'roll_no' }).catch(() => []),
      pb.collection('enrollments').getFullList({ expand: 'course' }).catch(() => []),
      pb.collection('entries').getFullList().catch(() => []),
    ]);

    const studentEnrollments = new Map<string, string[]>();
    for (const en of allEnrollments) {
      const cName = (en.expand as any)?.course?.name;
      if (cName) {
        const arr = studentEnrollments.get(en.student) || [];
        arr.push(cName);
        studentEnrollments.set(en.student, arr);
      }
    }

    const studentEntriesCount = new Map<string, number>();
    for (const entry of allEntries) {
      studentEntriesCount.set(entry.student, (studentEntriesCount.get(entry.student) || 0) + 1);
    }

    const totalStudents = allStudents.length;
    const totalEntries = allEntries.length;
    const totalApproved = allEntries.filter(
      (e) => e.status === 'covered' && (e.review_status === 'auto' || e.review_status === 'approved' || e.review_status === 'CLEARED')
    ).length;

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
        {/* Top Header */}
        <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-black text-xs shadow-md shadow-amber-500/20">
                AA
              </div>
              <div>
                <span className="font-extrabold text-sm text-white tracking-tight block leading-tight">
                  ABHIGYAN ACADEMY
                </span>
                <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" /> Student Oversight &bull; Director Governance View
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs text-white bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-xl transition-all font-semibold shadow-md shadow-amber-600/20"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Director Console</span>
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl transition-all font-medium"
              >
                <span>Executive Dashboard</span>
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl transition-all font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
          {/* Admin Banner */}
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-amber-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Authorized Admin View
                  </span>
                  <span className="font-mono text-xs text-zinc-400 bg-zinc-800/80 px-2.5 py-0.5 rounded-full">
                    Student Session Isolation Enforced
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Student Learning Oversight Portal
                </h1>
                <p className="text-xs text-zinc-400 max-w-2xl">
                  Inspect student learning progress and classroom submission records in read-only audit mode. To create accounts, assign enrollments, or reset credentials, use the Director Console.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  <span>Manage Students at /admin</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold font-mono">
                Active Enrolled Students
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white">{totalStudents}</div>
              <p className="text-[10px] text-zinc-500">Registered student roster</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold font-mono">
                Total Submissions Logged
              </span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-400">{totalEntries}</div>
              <p className="text-[10px] text-zinc-500">Student classroom submissions</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold font-mono">
                Approved Confirmations
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">{totalApproved}</div>
              <p className="text-[10px] text-zinc-500">Endorsed & verified coverage</p>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Enrolled Student Directory</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Select any student to inspect their personal syllabus submission history and review statuses.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                {allStudents.length} Students
              </span>
            </div>

            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4 font-bold">Roll Number</th>
                    <th className="py-3 px-4 font-bold">Student Name</th>
                    <th className="py-3 px-4 font-bold">Enrolled Courses</th>
                    <th className="py-3 px-4 font-bold text-center">Submissions</th>
                    <th className="py-3 px-4 font-bold text-right">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {allStudents.map((st) => {
                    const courses = studentEnrollments.get(st.id) || [];
                    const entriesCount = studentEntriesCount.get(st.id) || 0;
                    return (
                      <tr key={st.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {st.roll_no}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">
                          {st.name}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300">
                          {courses.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {courses.map((cName, idx) => (
                                <span key={idx} className="bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded text-[11px] text-zinc-300">
                                  {cName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-[11px] italic">General Batch</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-300">
                          {entriesCount}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/student?studentId=${st.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2.5 py-1 rounded-lg transition-all"
                          >
                            <span>Inspect Progress</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-800/80 py-4 text-center text-xs text-zinc-500 font-mono">
          Abhigyan Academy Syllabus Tracker &bull; Student Oversight Portal &bull; Asia/Kolkata Reference
        </footer>
      </div>
    );
  }

  // Fetch student, enrollments, and entries
  const [student, enrollments, entries] = await Promise.all([
    pb.collection('students').getOne(targetStudentId!).catch(() => null),
    pb.collection('enrollments').getFullList({
      filter: `student = "${targetStudentId}"`,
      expand: 'course',
    }),
    pb.collection('entries').getFullList({
      filter: `student = "${targetStudentId}"`,
      expand: 'topic,subject,course',
      sort: '-class_date,-created',
    }),
  ]);

  if (!student) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Student Record Not Found</h2>
          <p className="text-zinc-400 text-xs">
            {isAdmin
              ? 'The requested student record could not be found or has been deactivated.'
              : 'Student profile could not be loaded.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {isAdmin ? (
              <>
                <Link href="/student" className="text-amber-400 hover:underline text-xs">
                  &larr; Return to Student Directory
                </Link>
                <Link href="/admin" className="text-zinc-400 hover:text-white text-xs">
                  Director Console
                </Link>
              </>
            ) : (
              <Link href="/student/login" className="text-emerald-400 hover:underline text-sm">
                Return to Student Login
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const enrolledCourseNames = enrollments
    .map((e) => (e.expand as any)?.course?.name)
    .filter(Boolean);

  const enrolledCourseIds = enrollments.map((e) => e.course).filter(Boolean);
  let assignedSubjectsWithTopics: Array<{
    id: string;
    name: string;
    courseCode: string;
    courseName: string;
    topics: Array<{ id: string; seq_no: number; name: string; loggedByStudent: boolean }>;
  }> = [];

  if (enrolledCourseIds.length > 0) {
    const courseFilter = enrolledCourseIds.map((cId) => `course = "${cId}"`).join(' || ');
    const subjectsList = await pb
      .collection('subjects')
      .getFullList({
        filter: courseFilter,
        sort: 'sort_order',
        expand: 'course',
      })
      .catch(() => [] as any[]);

    if (subjectsList.length > 0) {
      const subFilter = subjectsList.map((s) => `subject = "${s.id}"`).join(' || ');
      const topicsList = await pb
        .collection('topics')
        .getFullList({
          filter: subFilter,
          sort: 'seq_no',
        })
        .catch(() => [] as any[]);

      const studentLoggedTopicIds = new Set(entries.map((e) => e.topic));
      const topicsBySub = new Map<string, any[]>();
      for (const t of topicsList) {
        if (!topicsBySub.has(t.subject)) topicsBySub.set(t.subject, []);
        topicsBySub.get(t.subject)!.push(t);
      }

      assignedSubjectsWithTopics = subjectsList.map((s) => {
        const courseObj = (s.expand as any)?.course;
        const subTopics = topicsBySub.get(s.id) || [];
        return {
          id: s.id,
          name: s.name,
          courseCode: courseObj?.code || '',
          courseName: courseObj?.name || '',
          topics: subTopics.map((t) => ({
            id: t.id,
            seq_no: t.seq_no,
            name: t.name,
            loggedByStudent: studentLoggedTopicIds.has(t.id),
          })),
        };
      });
    }
  }

  const totalLogged = entries.length;
  const approvedEntries = entries.filter(
    (e) => e.status === 'covered' && (e.review_status === 'auto' || e.review_status === 'approved' || e.review_status === 'CLEARED')
  ).length;
  const pendingReview = entries.filter((e) => e.review_status === 'pending').length;
  const revisionCount = entries.filter(
    (e) => e.status === 'revision' || (e.flags && (e.flags as string[]).length > 0)
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl ${isAdmin ? 'bg-gradient-to-tr from-amber-600 to-amber-500 shadow-amber-500/20' : 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20'} text-white flex items-center justify-center font-black text-xs shadow-md`}>
              AA
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-tight block leading-tight">
                ABHIGYAN ACADEMY
              </span>
              <span className={`text-[10px] ${isAdmin ? 'text-amber-400' : 'text-zinc-400'} font-mono`}>
                {isAdmin ? 'Student Learning Center • Administrator Audit View' : 'Student Learning Center'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin ? (
              <StudentPinModal rollNo={student.roll_no} mustChangePin={mustChangePin} />
            ) : (
              <Link
                href="/student"
                className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/60 border border-amber-800/80 hover:bg-amber-900/60 px-3 py-1.5 rounded-xl transition-all font-semibold"
              >
                <Users className="w-3.5 h-3.5" />
                <span>All Students</span>
              </Link>
            )}

            {!isAdmin && (
              <Link
                href="/submit"
                className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-xl transition-all font-semibold shadow-md shadow-indigo-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Log Today&apos;s Class</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl transition-all font-medium"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Director Console</span>
              </Link>
            )}

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl transition-all font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Admin Audit Notice Banner */}
        {isAdmin && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                  Administrator Oversight Mode &bull; Read-Only Audit View
                </p>
                <p className="text-xs text-amber-300/80">
                  Viewing syllabus learning record for <strong>{student.name}</strong> ({student.roll_no}). Student credentials and personal session state remain isolated.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/student"
                className="text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-xl transition-all"
              >
                &larr; Return to Student Directory
              </Link>
            </div>
          </div>
        )}

        {/* Profile Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Roll No: {student.roll_no}
                </span>
                <span className="font-mono text-xs text-zinc-400 bg-zinc-800/80 px-2.5 py-0.5 rounded-full">
                  Status: {student.active ? 'Active Enrolled' : 'Inactive'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {isAdmin ? `Student Record: ${student.name}` : `Welcome, ${student.name}`}
              </h1>
              <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-zinc-300">Enrolled In:</span>
                {enrolledCourseNames.length > 0 ? (
                  enrolledCourseNames.map((name, idx) => (
                    <span key={idx} className="bg-zinc-800/60 border border-zinc-700/50 px-2 py-0.5 rounded text-[11px] text-zinc-200">
                      {name}
                    </span>
                  ))
                ) : (
                  <span>General Batch</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="w-full sm:w-auto text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Manage in Director Console</span>
                </Link>
              ) : (
                <Link
                  href="/submit"
                  className="w-full sm:w-auto text-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                >
                  + Log New Class Topic
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold font-mono">
                Total Logged
              </span>
              <BookOpen className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{totalLogged}</div>
            <p className="text-[10px] text-zinc-500">Submitted class records</p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold font-mono">
                Approved
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{approvedEntries}</div>
            <p className="text-[10px] text-zinc-500">Confirmed & endorsed</p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold font-mono">
                Under Review
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{pendingReview}</div>
            <p className="text-[10px] text-zinc-500">Awaiting faculty check</p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold font-mono">
                Review Flags
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-400">{revisionCount}</div>
            <p className="text-[10px] text-zinc-500">Needs attention / remarks</p>
          </div>
        </div>

        {/* Submissions Timeline / Table */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>{isAdmin ? `${student.name}'s Classroom Submission History` : 'My Classroom Submission History'}</span>
              </h2>
              <p className="text-xs text-zinc-400">
                {isAdmin
                  ? 'Audit log of syllabus topics completed and submitted by this student.'
                  : 'Log of syllabus topics you have completed and submitted for faculty endorsement.'}
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
              {entries.length} Entries
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-zinc-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {isAdmin ? 'No Submissions Found for Student' : 'No Class Submissions Yet'}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {isAdmin
                  ? 'This student has not yet recorded any classroom submissions.'
                  : 'You haven\'t logged any classroom entries yet. Log today\'s class topic to begin building your verified syllabus tracking record.'}
              </p>
              {isAdmin ? (
                <Link
                  href="/student"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl transition-all"
                >
                  &larr; Return to Student Directory
                </Link>
              ) : (
                <Link
                  href="/submit"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit First Entry</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4 font-bold">Class Date</th>
                    <th className="py-3 px-4 font-bold">Course & Subject</th>
                    <th className="py-3 px-4 font-bold">Topic Covered</th>
                    <th className="py-3 px-4 font-bold text-center">Status</th>
                    <th className="py-3 px-4 font-bold text-center">Verification</th>
                    <th className="py-3 px-4 font-bold">Feedback / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {entries.map((entry) => {
                    const topic = (entry.expand as any)?.topic;
                    const subject = (entry.expand as any)?.subject;
                    const course = (entry.expand as any)?.course;

                    const isApproved =
                      entry.review_status === 'approved' ||
                      entry.review_status === 'auto' ||
                      entry.review_status === 'CLEARED';

                    return (
                      <tr key={entry.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-zinc-300 whitespace-nowrap">
                          {entry.class_date}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-white">
                            {subject?.name || 'Subject'}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {course?.code || ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-medium text-zinc-200 truncate">
                            {topic?.seq_no ? `#${topic.seq_no} • ` : ''}
                            {topic?.name || 'Topic'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              entry.status === 'covered'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : entry.status === 'partial'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              isApproved
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : entry.review_status === 'pending'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {entry.review_status === 'auto'
                              ? 'Auto-Approved'
                              : entry.review_status === 'approved'
                              ? 'Faculty Approved'
                              : entry.review_status === 'CLEARED'
                              ? 'Cleared & Approved'
                              : entry.review_status === 'pending'
                              ? 'Pending Review'
                              : entry.review_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          {entry.remarks ? (
                            <span className="text-zinc-300 italic truncate block">
                              &ldquo;{entry.remarks}&rdquo;
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Assigned Subjects & Syllabus Curriculum */}
        {assignedSubjectsWithTopics.length > 0 && (
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>Assigned Subjects &amp; Syllabus Topics</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Curriculum subjects and class topics assigned to your enrolled batch ({enrolledCourseNames.join(', ')}).
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                {assignedSubjectsWithTopics.length} Subjects
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedSubjectsWithTopics.map((sub) => {
                const loggedCount = sub.topics.filter((t) => t.loggedByStudent).length;
                return (
                  <div
                    key={sub.id}
                    className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                          {sub.courseCode}
                        </span>
                        <h3 className="text-sm font-bold text-white mt-1">{sub.name}</h3>
                      </div>
                      <span className="text-xs font-mono text-zinc-400">
                        {loggedCount}/{sub.topics.length} Logged
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {sub.topics.map((top) => (
                        <div
                          key={top.id}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50"
                        >
                          <span className="text-zinc-300 truncate pr-2">
                            <strong className="font-mono text-zinc-500 mr-1.5">#{top.seq_no}</strong>
                            {top.name}
                          </span>
                          {top.loggedByStudent ? (
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                              Submitted
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                              Pending
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-4 text-center text-xs text-zinc-500 font-mono">
        Abhigyan Academy Syllabus Tracker &bull; Student Learning Portal &bull; Asia/Kolkata Reference
      </footer>
    </div>
  );
}
