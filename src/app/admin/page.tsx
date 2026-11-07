import React from 'react';
import Link from 'next/link';
import { requireAccess } from '@/lib/auth-guard';
import { getAdminInitialData } from '@/lib/admin-data';
import { formatISTDate } from '@/lib/date-utils';
import { logoutAction } from '@/app/actions/auth-actions';
import { AdminPanelClient } from '@/components/admin/admin-panel-client';
import { Shield, GraduationCap, LayoutDashboard, Calendar, LogOut, Download } from 'lucide-react';

export default async function AdminPage() {
  // Guard access: Enforces Director / Administrator session
  const access = await requireAccess('admin');

  const initialData = await getAdminInitialData();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Main Admin Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 flex items-center justify-center font-black">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">ABHIGYAN ACADEMY</h1>
                <span className="text-[10px] font-mono uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded font-semibold">
                  Director Console
                </span>
              </div>
              <p className="text-xs text-slate-400">Curriculum, Faculty, Student Roster &amp; Code Governance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>IST Today: <strong className="text-slate-200">{formatISTDate(initialData.today)}</strong></span>
            </div>

            <Link
              href="/submit"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Student Form</span>
            </Link>

            <Link
              href="/api/export?type=entries&courseId=all"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
              title="Download all entries as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
              <span>Executive Dashboard</span>
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-rose-500/30"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <AdminPanelClient initialData={initialData} />
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Abhigyan Academy Syllabus Tracker &bull; Admin Console (Phase 1: Open Mode) &bull; Changes automatically audit-logged
      </footer>
    </div>
  );
}
