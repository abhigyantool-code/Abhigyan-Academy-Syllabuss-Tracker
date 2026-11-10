import { NextRequest, NextResponse } from 'next/server';
import { getPbClient } from '@/lib/pb';
import { requireAccess } from '@/lib/auth-guard';
import { getDashboardData, getActiveCourses } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  // Guard access
  await requireAccess('dashboard');

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'entries';
  const courseId = searchParams.get('courseId');
  const subjectId = searchParams.get('subjectId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // 'all' means no course filter — export everything
  const isAllCourses = !courseId || courseId === 'all';
  const pb = await getPbClient();

  if (type === 'entries') {
    const filters: string[] = [];
    if (!isAllCourses) filters.push(`course = "${courseId}"`);
    if (subjectId && subjectId !== 'all') filters.push(`subject = "${subjectId}"`);
    if (startDate) filters.push(`class_date >= "${startDate}"`);
    if (endDate) filters.push(`class_date <= "${endDate}"`);

    const entries = await pb.collection('entries').getFullList({
      filter: filters.length > 0 ? filters.join(' && ') : undefined,
      sort: '-created',
      expand: 'course,subject,topic,teacher,student',
    });

    const headers = [
      'Reference ID',
      'Class Date',
      'Course',
      'Subject',
      'Topic Seq',
      'Topic Name',
      'Teacher',
      'Roll Number',
      'Student Name',
      'Status',
      'Remarks',
      'Review Status',
      'Teacher Endorsement Status',
      'Flags',
      'Logged At (UTC)',
    ];

    const rows = entries.map((r) => {
      const course = (r.expand as any)?.course;
      const subject = (r.expand as any)?.subject;
      const topic = (r.expand as any)?.topic;
      const teacher = (r.expand as any)?.teacher;
      const student = (r.expand as any)?.student;

      let endorsementStatus = 'Pending Endorsement';
      if (r.device_id === 'teacher-portal-endorse') {
        endorsementStatus = 'Endorsed (Direct)';
      } else if (r.review_status === 'approved' || r.review_status === 'CLEARED') {
        endorsementStatus = 'Endorsed';
      } else if (r.review_status === 'rejected' || r.review_status === 'VIOLATION') {
        endorsementStatus = 'Rejected';
      }

      return [
        r.id,
        r.class_date,
        course?.name || 'Unknown',
        subject?.name || 'Unknown',
        topic?.seq_no || '',
        topic?.name || 'Unknown',
        teacher?.name || 'Unknown',
        student?.roll_no || '',
        student?.name || 'Unknown',
        r.status,
        r.remarks || '',
        r.review_status,
        endorsementStatus,
        JSON.stringify(r.flags || []),
        r.created,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="entries_${isAllCourses ? 'all' : courseId}_${Date.now()}.csv"`,
      },
    });
  } else if (type === 'progress') {
    let allTopicProgress: any[] = [];

    if (isAllCourses) {
      const allCourses = await getActiveCourses();
      for (const c of allCourses) {
        const dData = await getDashboardData(c.id);
        if (dData?.topicProgress) {
          allTopicProgress.push(...dData.topicProgress);
        }
      }
    } else {
      const dData = await getDashboardData(courseId);
      if (dData?.topicProgress) {
        allTopicProgress = dData.topicProgress;
      }
    }

    const headers = [
      'Course',
      'Subject',
      'Seq No',
      'Topic Name',
      'Target Date',
      'Status',
      'Covered Confirmations',
      'Required Threshold',
      'First Date Taught',
      'Last Date Taught',
      'Faculty',
    ];

    const rows = allTopicProgress.map((r) =>
      [
        r.course_name,
        r.subject_name,
        r.seq_no,
        r.topic_name,
        r.target_date || '',
        r.status,
        r.covered_confirmations,
        r.effective_threshold,
        r.first_date_taught || '',
        r.last_date_taught || '',
        r.teacher_names || 'Unassigned',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="progress_${isAllCourses ? 'all' : courseId}_${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
}
