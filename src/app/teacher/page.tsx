import React from 'react';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { getTeacherDashboardData } from '@/lib/teacher-data';
import { TeacherPortalClient } from '@/components/teacher/teacher-portal-client';

export const metadata = {
  title: 'Faculty Portal — Abhigyan Academy',
  description: 'Dedicated individual teacher dashboard for lecture pacing and syllabus verification.',
};

export const dynamic = 'force-dynamic';

interface TeacherPageProps {
  searchParams: Promise<{ subject?: string }>;
}

export default async function TeacherPage({ searchParams }: TeacherPageProps) {
  const session = await getSession();

  // If no faculty session, redirect to login
  if (!session || session.role !== 'faculty' || !session.teacherId) {
    redirect('/teacher/login');
  }

  const resolvedParams = await searchParams;
  const subjectId = resolvedParams.subject;

  const data = await getTeacherDashboardData(session.teacherId, subjectId);

  if (!data) {
    redirect('/teacher/login');
  }

  return <TeacherPortalClient data={data} teacherName={session.name} />;
}
