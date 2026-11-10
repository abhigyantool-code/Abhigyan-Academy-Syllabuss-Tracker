import { getPbClient } from './pb';

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
 * Verifies student existence, active status, course enrollment, and 4-digit PIN using PocketBase.
 * Default PIN for all students is '1234'.
 */
export async function verifyStudent(
  studentId: string,
  courseId: string,
  pin?: string
): Promise<VerifyStudentResult> {
  try {
    const pb = await getPbClient();

    // 1. Fetch student
    let student: any;
    try {
      student = await pb.collection('students').getOne(studentId);
    } catch {
      return { valid: false, error: 'Student not found in academy records.' };
    }

    if (!student.active) {
      return {
        valid: false,
        error: `Student account for ${student.name} (${student.roll_no}) is inactive. Please contact administration.`,
      };
    }

    // 2. Check enrollment in course
    try {
      await pb.collection('enrollments').getFirstListItem(`student="${studentId}" && course="${courseId}"`);
    } catch {
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
  } catch (error: any) {
    console.error('Error verifying student in PocketBase:', error);
    return {
      valid: false,
      error: 'An internal error occurred during student validation. Please try again.',
    };
  }
}
