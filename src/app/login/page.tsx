import React from 'react';
import { getPbClient } from '@/lib/pb';
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
  let teachers: { id: string; name: string; phone: string | null; subjects: string }[] = [];
  try {
    const pb = await getPbClient();
    const [teachersList, teacherSubjectsList] = await Promise.all([
      pb.collection('teachers').getFullList({
        filter: 'active = true',
        sort: 'name',
      }),
      pb.collection('teacher_subjects').getFullList({
        expand: 'subject',
      }),
    ]);

    const teacherSubMap = new Map<string, Set<string>>();
    for (const ts of teacherSubjectsList) {
      const tId = ts.teacher;
      const subName = (ts.expand as any)?.subject?.name;
      if (tId && subName) {
        if (!teacherSubMap.has(tId)) {
          teacherSubMap.set(tId, new Set());
        }
        teacherSubMap.get(tId)!.add(subName);
      }
    }

    teachers = teachersList.map((t) => {
      const subNames = teacherSubMap.get(t.id);
      const subjectsStr = subNames && subNames.size > 0
        ? Array.from(subNames).sort().join(', ')
        : 'General Faculty';
      return {
        id: t.id,
        name: t.name,
        phone: t.phone || null,
        subjects: subjectsStr,
      };
    });
  } catch (err) {
    console.error('Failed to load teachers for login page:', err);
  }

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
