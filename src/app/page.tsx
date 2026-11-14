import Link from 'next/link';
import { getPbClient } from '@/lib/pb';
import { getTodayIST, formatISTDate } from '@/lib/date-utils';
import { BookOpen, GraduationCap, LayoutDashboard, Shield, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const today = getTodayIST();
  let dbStatus = 'connected';
  let courseCount = 0;
  let studentCount = 0;
  let teacherCount = 0;

  try {
    const pb = await getPbClient();
    const [resCourses, resStudents, resTeachers] = await Promise.all([
      pb.collection('courses').getList(1, 1, { filter: 'active = true' }),
      pb.collection('students').getList(1, 1, { filter: 'active = true' }),
      pb.collection('teachers').getList(1, 1, { filter: 'active = true' }),
    ]);
    courseCount = resCourses.totalItems;
    studentCount = resStudents.totalItems;
    teacherCount = resTeachers.totalItems;
  } catch (err) {
    dbStatus = 'error';
    console.error('Home page DB error:', err);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Status Banner */}
      <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 px-4 py-2 text-xs md:text-sm text-center flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span><strong>Production Active:</strong> Isolated Student, Faculty, and Admin Portals with Zero-Plaintext PIN Protection.</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 flex flex-col justify-center w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 text-xs text-slate-400 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            IST Reference Date: <strong className="text-slate-200">{formatISTDate(today)} ({today})</strong>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-3">
            ABHIGYAN ACADEMY
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto">
            Defence Exam Coaching Syllabus & Class Tracker
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded">NDA</span>
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded">CDS</span>
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded">SSB Interview</span>
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded">SSC</span>
          </div>
        </div>

        {/* Core Portals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Student Portal */}
          <div className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all shadow-xl hover:shadow-emerald-500/10">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                Student Portal
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">/student</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Log daily covered topics, inspect your personal syllabus curriculum, and view verified classroom submission history.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold">
              <Link
                href="/submit"
                className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                Log Class (/submit) &rarr;
              </Link>
              <Link
                href="/student"
                className="text-slate-300 hover:text-white bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                My Dashboard (/student)
              </Link>
            </div>
          </div>

          {/* Faculty Workspace & Dashboard */}
          <div className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-all shadow-xl hover:shadow-sky-500/10">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                Faculty Portal
                <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono">/teacher</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mark lecture topics taught, review student confirmations, and view real-time syllabus coverage &amp; variance curves.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold">
              <Link
                href="/teacher"
                className="text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                Faculty Workspace (/teacher) &rarr;
              </Link>
              <Link
                href="/dashboard"
                className="text-slate-300 hover:text-white bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Analytics (/dashboard)
              </Link>
            </div>
          </div>

          {/* Admin */}
          <Link
            href="/admin"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-900 transition-all shadow-xl hover:shadow-violet-500/10"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                Admin Center
                <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded font-mono">/admin</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Manage curriculum, drag-reorder topics, CSV bulk imports, class codes, review queue, and audit logs.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-violet-400 group-hover:translate-x-1 transition-transform">
              Open Admin Console &rarr;
            </div>
          </Link>
        </div>

        {/* Database & System Stats Bar */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <span>Database: <strong className="text-slate-200">PocketBase (Self-Hosted Cloud)</strong></span>
          </div>
          <div className="flex items-center gap-6">
            <span>Active Courses: <strong className="text-slate-200">{courseCount}</strong></span>
            <span>Teachers: <strong className="text-slate-200">{teacherCount}</strong></span>
            <span>Enrolled Students: <strong className="text-slate-200">{studentCount}</strong></span>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Abhigyan Academy Syllabus Tracker &bull; Production Release &bull; Built with Next.js App Router, PocketBase, Tailwind & shadcn
      </footer>
    </div>
  );
}
