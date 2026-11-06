import { getSession } from './session';
import { redirect } from 'next/navigation';

export type AccessArea = 'admin' | 'dashboard' | 'submit' | 'faculty';

export interface AccessResult {
  allowed: boolean;
  area: AccessArea;
  user: {
    id: string;
    role: string;
    label: string;
    teacherId?: string;
  } | null;
  reason?: string;
}

export async function requireAccess(area: AccessArea): Promise<AccessResult> {
  const session = await getSession();

  // 1. Admin Area: Requires authenticated Director/Admin session
  if (area === 'admin') {
    if (!session || session.role !== 'admin') {
      redirect('/login?from=admin');
    }
    return {
      allowed: true,
      area,
      user: {
        id: session.userId,
        role: session.role,
        label: session.name,
      },
    };
  }

  // 2. Faculty Workspace (/teacher): Requires Faculty or Admin session
  if (area === 'faculty') {
    if (!session || (session.role !== 'faculty' && session.role !== 'admin')) {
      redirect('/login?from=teacher');
    }
    return {
      allowed: true,
      area,
      user: {
        id: session.userId,
        role: session.role,
        label: session.name,
        teacherId: session.teacherId,
      },
    };
  }

  // 3. Executive Dashboard (/dashboard): Accessible to Faculty and Admin
  if (area === 'dashboard') {
    if (!session || (session.role !== 'faculty' && session.role !== 'admin')) {
      redirect('/login?from=dashboard');
    }
    return {
      allowed: true,
      area,
      user: {
        id: session.userId,
        role: session.role,
        label: session.name,
        teacherId: session.teacherId,
      },
    };
  }

  // 4. Student Submission (/submit): Open entry form, protected by 4-digit PIN + active hours
  return {
    allowed: true,
    area,
    user: session
      ? {
          id: session.userId,
          role: session.role,
          label: session.name,
          teacherId: session.teacherId,
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
