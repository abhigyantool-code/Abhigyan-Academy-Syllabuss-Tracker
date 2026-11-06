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
 * Verifies student existence, active status, course enrollment, and 4-digit PIN.
 * Default PIN for all students is '1234'.
 */
export async function verifyStudent(
  studentId: string,
  courseId: string,
  pin?: string
): Promise<VerifyStudentResult> {
  try {
    // 1. Check student exists and is active
    const studentRes = await query(
      `SELECT id, roll_no, name, active, pin FROM students WHERE id = $1`,
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

    // 3. Verify Student PIN
    if (!pin || pin.trim() !== student.pin) {
      return {
        valid: false,
        error: 'Incorrect 4-digit Student PIN. (Default PIN: 1234)',
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
