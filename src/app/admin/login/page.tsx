import React from 'react';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { TeacherLoginForm } from '@/components/auth/teacher-login-form';
import { Shield } from 'lucide-react';

export const metadata = {
  title: 'Director Console Login — Abhigyan Academy',
  description: 'Sign in to access the Director Governance Center, syllabus administration, and faculty management.',
};

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) {
    if (session.role === 'admin') {
      redirect('/admin');
    } else if (session.role === 'faculty') {
      redirect('/teacher');
    } else if (session.role === 'student') {
      redirect('/student');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 font-sans selection:bg-violet-500/30 selection:text-violet-200">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 text-white items-center justify-center font-black text-xl shadow-xl shadow-violet-600/20 ring-1 ring-white/20 mb-2">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            ABHIGYAN ACADEMY
          </h1>
          <p className="text-xs text-zinc-400">
            Director Governance Center &bull; Curriculum, Roster &amp; Policy Administration
          </p>
        </div>

        {/* Login Card - Strictly Director/Admin Mode with zero teacher names loaded */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <TeacherLoginForm teachers={[]} portalMode="admin" />
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-zinc-600">
          <span>Defence Exam Coaching Curriculum Tracker &bull; Director Console &bull; Confidential</span>
        </div>
      </div>
    </div>
  );
}
