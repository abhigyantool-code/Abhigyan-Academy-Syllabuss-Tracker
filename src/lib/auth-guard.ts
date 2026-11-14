import { getSession } from './session';
import { redirect } from 'next/navigation';

export type AccessArea = 'admin' | 'dashboard' | 'submit' | 'faculty' | 'student';

export interface AccessResult {
  allowed: boolean;
  area: AccessArea | AccessArea[];
  user: {
    id: string;
    role: string;
    label: string;
    teacherId?: string;
    studentId?: string;
    mustChangePin?: boolean;
  } | null;
  reason?: string;
}

export interface AccessEvaluation {
  allowed: boolean;
  redirectUrl?: string;
}

/**
 * Pure authorization evaluation policy matrix.
 * Evaluates whether a session role has permission for a specific area
 * and returns the appropriate portal login redirect destination if unauthorized.
 */
export function evaluateAccess(
  area: AccessArea | AccessArea[],
  session: { role: string; userId?: string; teacherId?: string; studentId?: string } | null
): AccessEvaluation {
  // Handle array of allowed areas/roles (BUG-035 Fix: Prevent fallthrough bypass)
  if (Array.isArray(area)) {
    if (!session) {
      return { allowed: false, redirectUrl: '/login' };
    }
    const isAllowed = area.some((a) => {
      if (a === 'admin' && session.role === 'admin') return true;
      if (a === 'faculty' && (session.role === 'faculty' || session.role === 'admin')) return true;
      if (a === 'dashboard' && (session.role === 'faculty' || session.role === 'admin')) return true;
      if (a === 'student' && (session.role === 'student' || session.role === 'admin')) return true;
      if (a === 'submit') return true;
      return false;
    });

    if (!isAllowed) {
      return { allowed: false, redirectUrl: '/login' };
    }

    return { allowed: true };
  }

  // 1. Admin Area: Requires authenticated Director/Admin session
  if (area === 'admin') {
    if (!session || session.role !== 'admin') {
      return { allowed: false, redirectUrl: '/admin/login' };
    }
    return { allowed: true };
  }

  // 2. Faculty Workspace (/teacher): Requires Faculty or Admin session
  if (area === 'faculty') {
    if (!session || (session.role !== 'faculty' && session.role !== 'admin')) {
      return { allowed: false, redirectUrl: '/teacher/login' };
    }
    return { allowed: true };
  }

  // 3. Executive Dashboard (/dashboard): Accessible to Faculty and Admin
  if (area === 'dashboard') {
    if (!session || (session.role !== 'faculty' && session.role !== 'admin')) {
      return { allowed: false, redirectUrl: '/teacher/login' };
    }
    return { allowed: true };
  }

  // 4. Student Area (/student): Accessible to Students and Admin
  if (area === 'student') {
    if (!session || (session.role !== 'student' && session.role !== 'admin')) {
      return { allowed: false, redirectUrl: '/student/login' };
    }
    return { allowed: true };
  }

  // 5. Student Submission (/submit): Open entry form, protected by 4-digit PIN + active hours
  return { allowed: true };
}

export async function requireAccess(area: AccessArea | AccessArea[]): Promise<AccessResult> {
  const session = await getSession();
  const evaluation = evaluateAccess(area, session);

  if (!evaluation.allowed) {
    redirect(evaluation.redirectUrl || '/login');
  }

  return {
    allowed: true,
    area,
    user: session
      ? {
          id: session.userId,
          role: session.role,
          label: session.name,
          teacherId: session.teacherId,
          studentId: session.studentId,
          mustChangePin: session.mustChangePin,
        }
      : null,
  };
}

// Student identity verification hook
export interface StudentVerification {
  valid: boolean;
  student?: {
    id: string;
    rollNo: string;
    name: string;
    active: boolean;
  };
  error?: string;
}
