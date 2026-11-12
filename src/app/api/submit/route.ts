import { NextRequest, NextResponse } from 'next/server';
import { getPbClient } from '@/lib/pb';
import { getTodayIST, checkAcademyHours } from '@/lib/date-utils';
import { verifyStudent } from '@/lib/student-guard';
import { submitEntrySchema, analyzeMisuseFlags } from '@/lib/submission-validation';
import { getClientIp } from '@/lib/rate-limit';

// In-memory sliding window rate limiter: max 30 submissions per IP per minute (bounded to prevent OOM, BUG-041)
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_SUBMIT_IP_BUCKETS = 10_000;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();

  // Enforce memory capacity bound if map reaches limit
  if (ipRateLimits.size >= MAX_SUBMIT_IP_BUCKETS) {
    for (const [key, val] of ipRateLimits.entries()) {
      if (val.resetAt < now) {
        ipRateLimits.delete(key);
      }
    }
    while (ipRateLimits.size >= MAX_SUBMIT_IP_BUCKETS) {
      const oldest = ipRateLimits.keys().next().value;
      if (oldest === undefined) break;
      ipRateLimits.delete(oldest);
    }
  }

  const limit = ipRateLimits.get(ip);
  if (!limit || limit.resetAt < now) {
    ipRateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (limit.count >= 30) {
    return false;
  }
  limit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 0. IP-Level Rate Limit (Roadmap 2D: max 30 requests per minute)
    const clientIp = getClientIp(request.headers);

    if (!checkIpRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded: Too many submission requests from your network. Please wait a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // 1. Active Academy Hours Check (06:30 AM - 09:00 PM IST, Mon-Sat)
    const hoursCheck = checkAcademyHours();
    if (!hoursCheck.allowed) {
      return NextResponse.json({ error: hoursCheck.reason }, { status: 400 });
    }

    // 2. Zod Validation
    const parseResult = submitEntrySchema.safeParse(body);
    if (!parseResult.success) {
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        (parseResult.error as any).errors?.[0]?.message ||
        'Invalid submission form data.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const input = parseResult.data;

    // 3. Honeypot check
    if (input.websiteUrlHp && input.websiteUrlHp.trim().length > 0) {
      return NextResponse.json(
        {
          success: true,
          referenceId: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
          status: input.status,
          message: 'Entry logged successfully.',
        },
        { status: 200 }
      );
    }

    // 4. Server-enforced IST Date
    const classDate = getTodayIST();
    const pb = await getPbClient();

    // 5. Anti-Proxy Device Check (Prevent 1 phone submitting for many students within 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');
    const deviceEntries = await pb.collection('entries').getFullList({
      filter: `device_id = "${input.deviceId}" && student != "${input.studentId}" && created >= "${twentyFourHoursAgo}"`,
      fields: 'student',
    });

    const distinctStudentsFromDevice = new Set(deviceEntries.map((e) => e.student));
    if (distinctStudentsFromDevice.size >= 2) {
      return NextResponse.json(
        {
          error:
            'Device limit reached: This device has logged entries for multiple other students in the last 24 hours. To ensure syllabus integrity, please submit from your own device.',
        },
        { status: 429 }
      );
    }

    // 6. Check Course exists & is active
    let course: any;
    try {
      course = await pb.collection('courses').getOne(input.courseId);
    } catch {
      return NextResponse.json(
        { error: 'The selected course is either inactive or does not exist.' },
        { status: 400 }
      );
    }

    if (!course.active) {
      return NextResponse.json(
        { error: 'The selected course is currently inactive.' },
        { status: 400 }
      );
    }

    let courseSettings: any = null;
    try {
      courseSettings = await pb.collection('course_settings').getFirstListItem(`course = "${input.courseId}"`);
    } catch {}

    const requireCode = Boolean(courseSettings?.require_class_code);
    const dailyCap = Number(courseSettings?.daily_entry_cap || 6);

    // 7. Class Code Verification
    let classCodeId: string | null = null;
    if (requireCode) {
      if (!input.classCode || !input.classCode.trim()) {
        return NextResponse.json(
          { error: 'Class code is required for this course. Please enter the code displayed by the teacher.' },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString().replace('T', ' ');
      try {
        const foundCode = await pb.collection('class_codes').getFirstListItem(
          `course = "${input.courseId}" && class_date = "${classDate}" && code = "${input.classCode.trim().toUpperCase()}" && valid_from <= "${nowIso}" && valid_until >= "${nowIso}"`
        );
        classCodeId = foundCode.id;
      } catch {
        return NextResponse.json(
          {
            error: 'Invalid or expired class code. Please check today’s active code displayed on the classroom board.',
          },
          { status: 400 }
        );
      }
    }

    // 8. Student Verification & PIN Check (active, enrolled & 4-digit PIN)
    const studentCheck = await verifyStudent(input.studentId, input.courseId, input.pin, clientIp);
    if (!studentCheck.valid || !studentCheck.student) {
      return NextResponse.json({ error: studentCheck.error || 'Student authentication failed.' }, { status: 400 });
    }
    const resolvedStudentId = studentCheck.student.id;

    // 9. Relational Verification: Teacher assigned to Subject
    try {
      await pb.collection('teacher_subjects').getFirstListItem(
        `teacher = "${input.teacherId}" && subject = "${input.subjectId}"`
      );
    } catch {
      return NextResponse.json(
        { error: 'Selected teacher is not allocated to teach this subject in this course.' },
        { status: 400 }
      );
    }

    // 10. Relational Verification: Topic belongs to Subject
    let topic: any;
    try {
      topic = await pb.collection('topics').getOne(input.topicId);
      if (topic.subject !== input.subjectId) {
        throw new Error('Subject mismatch');
      }
    } catch {
      return NextResponse.json(
        { error: 'Selected topic does not belong to the chosen subject.' },
        { status: 400 }
      );
    }
    const topicName = topic.name;

    // 11. Duplicate Protection: student + topic + class_date
    const dupCheck = await pb.collection('entries').getList(1, 1, {
      filter: `student = "${resolvedStudentId}" && topic = "${input.topicId}" && class_date = "${classDate}"`,
    });

    if (dupCheck.totalItems > 0) {
      return NextResponse.json(
        {
          error: 'You have already logged this topic for today’s class. Each student can only log a topic once per day.',
        },
        { status: 409 }
      );
    }

    // 12. Daily Entry Cap Check
    const capCheck = await pb.collection('entries').getList(1, 1, {
      filter: `student = "${resolvedStudentId}" && class_date = "${classDate}"`,
    });

    if (capCheck.totalItems >= dailyCap) {
      return NextResponse.json(
        {
          error: `Daily limit reached: You have already submitted ${capCheck.totalItems} class entries today. The daily cap is ${dailyCap}.`,
        },
        { status: 429 }
      );
    }

    // 13. Anti-Misuse Flagging Engine (Store & Flag, never drop)
    const { flags, reviewStatus } = await analyzeMisuseFlags({
      courseId: input.courseId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      studentId: resolvedStudentId,
      deviceId: input.deviceId,
    });

    // 14. Insert Entry into PocketBase
    const newEntry = await pb.collection('entries').create({
      course: input.courseId,
      student: resolvedStudentId,
      teacher: input.teacherId,
      subject: input.subjectId,
      topic: input.topicId,
      class_date: classDate,
      status: input.status,
      remarks: input.remarks ? input.remarks.trim() : null,
      class_code: classCodeId,
      device_id: input.deviceId,
      flags: flags,
      review_status: reviewStatus,
    });

    const shortRefId = `ABG-${newEntry.id.substring(0, 8).toUpperCase()}`;

    return NextResponse.json({
      success: true,
      referenceId: shortRefId,
      fullId: newEntry.id,
      topicName,
      status: input.status,
      classDate,
      reviewStatus,
      message:
        reviewStatus === 'pending'
          ? 'Your entry has been submitted and queued for faculty review.'
          : 'Class topic verified and recorded successfully!',
    });
  } catch (error: any) {
    console.error('Submission API error:', error);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while processing your class log.' },
      { status: 500 }
    );
  }
}
