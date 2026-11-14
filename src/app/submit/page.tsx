import React from 'react';
import Link from 'next/link';
import { requireAccess } from '@/lib/auth-guard';
import { getSession } from '@/lib/session';
import { getPbClient } from '@/lib/pb';
import { getSubmitFormData } from '@/lib/submit-data';
import { StudentSubmitForm } from '@/components/submit/student-submit-form';
import { GraduationCap, LayoutDashboard, BookOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SubmitPage() {
  await requireAccess('submit');

  const [formData, session] = await Promise.all([
    getSubmitFormData(),
    getSession().catch(() => null),
  ]);

  let defaultStudentSession: {
    id: string;
    name: string;
    rollNo: string;
    courseId?: string;
  } | null = null;

  if (session?.role === 'student' && (session.studentId || session.userId)) {
    try {
      const pb = await getPbClient();
      const sId = session.studentId || session.userId;
      const [stu, enrolls] = await Promise.all([
        pb.collection('students').getOne(sId),
        pb.collection('enrollments').getFullList({ filter: `student = "${sId}"` }),
      ]);
      defaultStudentSession = {
        id: stu.id,
        name: stu.name,
        rollNo: stu.roll_no,
        courseId: enrolls[0]?.course || undefined,
      };
    } catch {
      // Non-fatal fallback
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-xs shadow-md shadow-emerald-500/20">
              AA
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-tight block leading-tight">
                ABHIGYAN ACADEMY
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Classroom Log Portal</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/student"
              className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-white bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 px-3 py-1.5 rounded-xl transition-all font-semibold"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Student Dashboard</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl transition-all font-medium"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Faculty Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Form Body */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        <StudentSubmitForm initialData={formData} defaultStudentSession={defaultStudentSession} />
      </main>

      <footer className="border-t border-zinc-800/80 py-4 text-center text-xs text-zinc-500 font-mono">
        Abhigyan Academy Syllabus Tracker &bull; Student Entry Mode &bull; IST Reference Enforced
      </footer>
    </div>
  );
}
