import React from 'react';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { TeacherLoginForm } from '@/components/auth/teacher-login-form';

export const metadata = {
  title: 'Academy Portal Login — Abhigyan Academy',
  description: 'Sign in to access your teacher workspace or director governance center.',
};

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = await searchParams;
  const initialTab = resolvedParams?.from === 'admin' ? 'admin' : 'faculty';

  const session = await getSession();
  if (session) {
    if (session.role === 'faculty') {
      redirect('/teacher');
    } else if (session.role === 'admin') {
      redirect('/admin');
    }
  }

  // Fetch active teachers for quick login selection
  const teachersRes = await query(
    `SELECT 
       t.id, 
       t.name, 
       t.phone,
       string_agg(DISTINCT s.name, ', ' ORDER BY s.name) as subjects
     FROM teachers t
     LEFT JOIN teacher_subjects ts ON t.id = ts.teacher_id
     LEFT JOIN subjects s ON ts.subject_id = s.id
     WHERE t.active = true
     GROUP BY t.id, t.name, t.phone
     ORDER BY t.name;`
  );

  const teachers = teachersRes.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    subjects: r.subjects || 'General Faculty',
  }));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white items-center justify-center font-black text-xl shadow-xl shadow-indigo-600/20 ring-1 ring-white/20 mb-2">
            AA
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            ABHIGYAN ACADEMY
          </h1>
          <p className="text-xs text-zinc-400">
            Academy Portals &bull; Faculty Workspace &amp; Director Governance Center
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <TeacherLoginForm teachers={teachers} initialTab={initialTab} />
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-zinc-600">
          <span>Defence Exam Coaching Curriculum Tracker &bull; Confidential &bull; IST</span>
        </div>
      </div>
    </div>
  );
}
