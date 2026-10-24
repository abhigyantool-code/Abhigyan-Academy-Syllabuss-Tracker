// Central Access Guard Function (Phase 1: No Auth Mode)
// When authentication is implemented in Phase 2, this will verify sessions, tokens, and roles
// WITHOUT rewriting any route handlers or page layouts.

export type AccessArea = 'admin' | 'dashboard' | 'submit';

export interface AccessResult {
  allowed: boolean;
  area: AccessArea;
  user: {
    id: string;
    role: string;
    label: string;
  } | null;
  reason?: string;
}

export async function requireAccess(area: AccessArea): Promise<AccessResult> {
  // Phase 1: Authentication is completely disabled.
  // Unrestricted access for all areas.
  return {
    allowed: true,
    area,
    user: {
      id: 'phase1-guest',
      role: area === 'admin' ? 'admin' : area === 'dashboard' ? 'faculty' : 'student',
      label: 'Guest Access (Auth Disabled)',
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
