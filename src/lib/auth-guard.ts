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

  // If accessing faculty portal, enforce faculty or admin session
  if (area === 'faculty') {
    if (!session || (session.role !== 'faculty' && session.role !== 'admin')) {
      redirect('/login');
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

  // Phase 1 open routes for review: admin, dashboard, submit
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
      : {
          id: 'guest',
          role: area === 'admin' ? 'admin' : area === 'dashboard' ? 'faculty' : 'student',
          label: 'Guest Access',
        },
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
