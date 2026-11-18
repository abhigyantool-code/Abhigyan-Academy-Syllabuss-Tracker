import React from 'react';
import { getSession } from '@/lib/session';
import { getPbClient } from '@/lib/pb';
import { redirect } from 'next/navigation';
import { StudentLoginForm, SafeStudentItem } from '@/components/auth/student-login-form';
import { GraduationCap } from 'lucide-react';

export const metadata = {
  title: 'Student Login — Abhigyan Academy',
  description: 'Sign in to access your personal syllabus progress, classroom submissions, and teacher feedback.',
};

export const dynamic = 'force-dynamic';

export default async function StudentLoginPage() {
  const session = await getSession();
  if (session) {
    if (session.role === 'student') {
      redirect('/student');
    } else if (session.role === 'faculty') {
      redirect('/teacher');
    } else if (session.role === 'admin') {
      redirect('/admin');
    }
  }

  // Safe student roster fetch: strictly limits fields to id, name, roll_no
  // pin, pin_hash, and other sensitive attributes are NEVER serialized to client
  let safeStudents: SafeStudentItem[] = [];
  try {
    const pb = await getPbClient();
    const records = await pb.collection('students').getFullList({
      filter: 'active = true',
      sort: 'roll_no',
      fields: 'id,name,roll_no',
    });
    safeStudents = records.map((r) => ({
      id: r.id,
      name: r.name,
      roll_no: r.roll_no,
    }));
  } catch (err) {
    console.error('Failed to preload student roster for login:', err);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 text-white items-center justify-center font-black text-xl shadow-xl shadow-emerald-600/20 ring-1 ring-white/20 mb-2">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            ABHIGYAN ACADEMY
          </h1>
          <p className="text-xs text-zinc-400">
            Student Learning Center &bull; Verified Classroom Syllabus Tracker
          </p>
        </div>

        {/* Login Card - Dedicated Student Login Form */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <StudentLoginForm students={safeStudents} />
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-zinc-600">
          <span>Defence Exam Coaching Curriculum Tracker &bull; Student Portal &bull; IST</span>
        </div>
      </div>
    </div>
  );
}
