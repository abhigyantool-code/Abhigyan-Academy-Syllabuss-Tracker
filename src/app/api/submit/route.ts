import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getTodayIST } from '@/lib/date-utils';
import { verifyStudent } from '@/lib/student-guard';
import { submitEntrySchema, analyzeMisuseFlags } from '@/lib/submission-validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Zod Validation
    const parseResult = submitEntrySchema.safeParse(body);
    if (!parseResult.success) {
      const firstError =
        parseResult.error.issues?.[0]?.message ||
        (parseResult.error as any).errors?.[0]?.message ||
        'Invalid submission form data.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const input = parseResult.data;

    // 2. Honeypot check
    if (input.websiteUrlHp && input.websiteUrlHp.trim().length > 0) {
      // Bot trapped: return simulated success without writing to database
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

    // 3. Server-enforced IST Date
    const classDate = getTodayIST();

    // 4. Check Course exists & active
    const courseRes = await query(
      `SELECT c.id, c.name, c.code, c.active,
              cs.confirmation_threshold, cs.daily_entry_cap, cs.require_class_code
       FROM courses c
       LEFT JOIN course_settings cs ON cs.course_id = c.id
       WHERE c.id = $1`,
      [input.courseId]
    );

    if (courseRes.rows.length === 0 || !courseRes.rows[0].active) {
      return NextResponse.json(
        { error: 'The selected course is either inactive or does not exist.' },
        { status: 400 }
      );
    }

    const courseSettings = courseRes.rows[0];
    const requireCode = Boolean(courseSettings.require_class_code);
    const dailyCap = Number(courseSettings.daily_entry_cap || 6);

    // 5. Class Code Verification
    let classCodeId: string | null = null;
    if (requireCode) {
      if (!input.classCode || !input.classCode.trim()) {
        return NextResponse.json(
          { error: 'Class code is required for this course. Please enter the code displayed by the teacher.' },
          { status: 400 }
        );
      }

      const codeCheckRes = await query(
        `SELECT id, code, valid_from, valid_until
         FROM class_codes
         WHERE course_id = $1
           AND class_date = $2
           AND UPPER(TRIM(code)) = UPPER(TRIM($3))
           AND now() BETWEEN valid_from AND valid_until
         LIMIT 1`,
        [input.courseId, classDate, input.classCode.trim()]
      );

      if (codeCheckRes.rows.length === 0) {
        return NextResponse.json(
          {
            error:
              'Invalid or expired class code. Please check today’s active code displayed on the classroom board.',
          },
          { status: 400 }
        );
      }
      classCodeId = codeCheckRes.rows[0].id;
    }

    // 6. Student Verification Hook (active & enrolled)
    const studentCheck = await verifyStudent(input.studentId, input.courseId);
    if (!studentCheck.valid) {
      return NextResponse.json({ error: studentCheck.error }, { status: 400 });
    }

    // 7. Relational Verification: Teacher assigned to Subject
    const teacherSubjectRes = await query(
      `SELECT 1 FROM teacher_subjects WHERE teacher_id = $1 AND subject_id = $2`,
      [input.teacherId, input.subjectId]
    );

    if (teacherSubjectRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Selected teacher is not allocated to teach this subject in this course.' },
        { status: 400 }
      );
    }

    // 8. Relational Verification: Topic belongs to Subject
    const topicRes = await query(
      `SELECT id, name FROM topics WHERE id = $1 AND subject_id = $2`,
      [input.topicId, input.subjectId]
    );

    if (topicRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Selected topic does not belong to the chosen subject.' },
        { status: 400 }
      );
    }
    const topicName = topicRes.rows[0].name;

    // 9. Duplicate Protection: UNIQUE (student_id, topic_id, class_date)
    const dupRes = await query(
      `SELECT id FROM entries WHERE student_id = $1 AND topic_id = $2 AND class_date = $3`,
      [input.studentId, input.topicId, classDate]
    );

    if (dupRes.rows.length > 0) {
      return NextResponse.json(
        {
          error:
            'You have already logged this topic for today’s class. Each student can only log a topic once per day.',
        },
        { status: 409 }
      );
    }

    // 10. Daily Entry Cap Check
    const capRes = await query(
      `SELECT COUNT(*) as count FROM entries WHERE student_id = $1 AND class_date = $2`,
      [input.studentId, classDate]
    );

    const currentCount = Number(capRes.rows[0]?.count || 0);
    if (currentCount >= dailyCap) {
      return NextResponse.json(
        {
          error: `Daily limit reached: You have already submitted ${currentCount} class entries today. The daily cap is ${dailyCap}.`,
        },
        { status: 429 }
      );
    }

    // 11. Anti-Misuse Flagging Engine (Store & Flag, never drop)
    const { flags, reviewStatus } = await analyzeMisuseFlags({
      courseId: input.courseId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      studentId: input.studentId,
      deviceId: input.deviceId,
    });

    // 12. Insert Entry
    const insertRes = await query(
      `INSERT INTO entries (
        course_id, student_id, teacher_id, subject_id, topic_id,
        class_date, status, remarks, class_code_id, device_id,
        flags, review_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, created_at;`,
      [
        input.courseId,
        input.studentId,
        input.teacherId,
        input.subjectId,
        input.topicId,
        classDate,
        input.status,
        input.remarks ? input.remarks.trim() : null,
        classCodeId,
        input.deviceId,
        JSON.stringify(flags),
        reviewStatus,
      ]
    );

    const newEntry = insertRes.rows[0];
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
    // Handle database unique constraint race conditions gracefully
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You have already logged this topic for today’s class.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'An unexpected server error occurred while processing your class log.' },
      { status: 500 }
    );
  }
}
