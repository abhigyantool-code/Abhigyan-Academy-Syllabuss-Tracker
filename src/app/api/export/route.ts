import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAccess } from '@/lib/auth-guard';

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

  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
  }

  if (type === 'entries') {
    const res = await query(
      `SELECT e.id, e.class_date::text, c.name as course_name, s.name as subject_name,
              t.seq_no, t.name as topic_name, tea.name as teacher_name,
              stu.roll_no, stu.name as student_name, e.status, e.remarks,
              e.review_status, e.flags, e.created_at::text
       FROM entries e
       JOIN courses c ON c.id = e.course_id
       JOIN subjects s ON s.id = e.subject_id
       JOIN topics t ON t.id = e.topic_id
       JOIN teachers tea ON tea.id = e.teacher_id
       JOIN students stu ON stu.id = e.student_id
       WHERE e.course_id = $1
       ORDER BY e.created_at DESC`,
      [courseId]
    );

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
      'Flags',
      'Logged At (UTC)',
    ];

    const rows = res.rows.map((r) =>
      [
        r.id,
        r.class_date,
        r.course_name,
        r.subject_name,
        r.seq_no,
        r.topic_name,
        r.teacher_name,
        r.roll_no,
        r.student_name,
        r.status,
        r.remarks || '',
        r.review_status,
        JSON.stringify(r.flags || []),
        r.created_at,
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="entries_${courseId}_${Date.now()}.csv"`,
      },
    });
  } else if (type === 'progress') {
    const res = await query(
      `SELECT tp.course_name, tp.subject_name, tp.seq_no, tp.topic_name,
              tp.target_date::text, tp.status, tp.covered_confirmations,
              tp.effective_threshold, tp.first_date_taught::text, tp.last_date_taught::text,
              COALESCE(STRING_AGG(DISTINCT tea.name, '; '), 'Unassigned') as teachers
       FROM topic_progress tp
       LEFT JOIN teacher_subjects ts ON ts.subject_id = tp.subject_id
       LEFT JOIN teachers tea ON tea.id = ts.teacher_id
       WHERE tp.course_id = $1
       GROUP BY tp.topic_id, tp.course_name, tp.subject_name, tp.seq_no, tp.topic_name,
                tp.target_date, tp.status, tp.covered_confirmations,
                tp.effective_threshold, tp.first_date_taught, tp.last_date_taught
       ORDER BY tp.subject_name ASC, tp.seq_no ASC`,
      [courseId]
    );

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

    const rows = res.rows.map((r) =>
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
        r.teachers,
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="progress_${courseId}_${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
}
