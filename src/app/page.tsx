import Link from 'next/link';
import { query } from '@/lib/db';
import { getTodayIST, formatISTDate } from '@/lib/date-utils';
import { BookOpen, GraduationCap, LayoutDashboard, Shield, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default async function Home() {
  const today = getTodayIST();
  let dbStatus = 'connected';
  let courseCount = 0;
  let studentCount = 0;
  let teacherCount = 0;

  try {
    const resCourses = await query('SELECT count(*) as count FROM courses WHERE active = true');
    const resStudents = await query('SELECT count(*) as count FROM students WHERE active = true');
    const resTeachers = await query('SELECT count(*) as count FROM teachers WHERE active = true');
    courseCount = Number(resCourses.rows[0]?.count || 0);
    studentCount = Number(resStudents.rows[0]?.count || 0);
    teacherCount = Number(resTeachers.rows[0]?.count || 0);
  } catch (err) {
    dbStatus = 'error';
    console.error('Home page DB error:', err);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Banner */}
      <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs md:text-sm text-center">
        ⚠️ <strong>Phase 1 Mode:</strong> Authentication is disabled across all routes for review and verification.
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

        {/* 3 Core Portals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Submit */}
          <Link
            href="/submit"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all shadow-xl hover:shadow-emerald-500/10"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                Student Entry
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">/submit</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mobile-first form for students to log daily covered topics, anti-misuse verification, and class codes.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
              Open Student Portal &rarr;
            </div>
          </Link>

          {/* Dashboard */}
          <Link
            href="/dashboard"
            className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-all shadow-xl hover:shadow-sky-500/10"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                Faculty Dashboard
                <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono">/dashboard</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Real-time syllabus coverage, planned vs actual variance curves, teacher scorecards, and progress exports.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition-transform">
              Open Faculty Dashboard &rarr;
            </div>
          </Link>

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
            <span>Database: <strong className="text-slate-200">PostgreSQL (Supabase RLS Enabled)</strong></span>
          </div>
          <div className="flex items-center gap-6">
            <span>Active Courses: <strong className="text-slate-200">{courseCount}</strong></span>
            <span>Teachers: <strong className="text-slate-200">{teacherCount}</strong></span>
            <span>Enrolled Students: <strong className="text-slate-200">{studentCount}</strong></span>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Abhigyan Academy Syllabus Tracker &bull; Phase 1 (No Authentication) &bull; Built with Next.js App Router, PostgreSQL, Tailwind & shadcn
      </footer>
    </div>
  );
}
