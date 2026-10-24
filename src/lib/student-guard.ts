import { query } from './db';

export interface VerifyStudentResult {
  valid: boolean;
  student?: {
    id: string;
    roll_no: string;
    name: string;
    active: boolean;
  };
  error?: string;
}

/**
 * Verifies student existence, active status, and course enrollment.
 * In Phase 1, PIN is not required (REQUIRE_PIN = false).
 * When authentication is added in future phases, PIN/OTP checks can be added here
 * without modifying any routes or forms.
 */
export async function verifyStudent(
  studentId: string,
  courseId: string
): Promise<VerifyStudentResult> {
  try {
    // 1. Check student exists and is active
    const studentRes = await query(
      `SELECT id, roll_no, name, active, pin_hash FROM students WHERE id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return { valid: false, error: 'Student not found in academy records.' };
    }

    const student = studentRes.rows[0];

    if (!student.active) {
      return {
        valid: false,
        error: `Student account for ${student.name} (${student.roll_no}) is inactive. Please contact administration.`,
      };
    }

    // 2. Check enrollment in course
    const enrollRes = await query(
      `SELECT course_id FROM enrollments WHERE student_id = $1 AND course_id = $2`,
      [studentId, courseId]
    );

    if (enrollRes.rows.length === 0) {
      return {
        valid: false,
        error: `Student ${student.name} (${student.roll_no}) is not enrolled in this course.`,
      };
    }

    return {
      valid: true,
      student: {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        active: student.active,
      },
    };
  } catch (err: any) {
    console.error('verifyStudent error:', err);
    return { valid: false, error: 'Internal verification error.' };
  }
}
