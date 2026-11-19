import React from 'react';
import Link from 'next/link';
import {
  Shield,
  UserCheck,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { logoutAction } from '@/app/actions/auth-actions';

interface BrandHeaderProps {
  courseName: string;
  batchCode: string;
  userRole?: string;
  userName?: string;
}

export function BrandHeader({
  courseName,
  batchCode,
  userRole,
  userName,
}: BrandHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
      {/* Brand Wordmark & Context */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center shadow-[var(--shadow-soft)] shrink-0">
          <Sparkles className="w-5 h-5 text-[var(--icon-color)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Syllabus 360
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-semibold uppercase tracking-wider">
              {batchCode || 'NDA'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            {courseName} &bull; Defence Coaching Portal
          </p>
        </div>
      </div>

      {/* Quick Controls & Navigation */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {userRole === 'faculty' && (
          <Link
            href="/teacher"
            className="h-9 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-secondary)]"
            title="Faculty Workspace"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">My Workspace</span>
          </Link>
        )}

        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="h-9 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-secondary)]"
            title="Admin Governance Center"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Sign Out */}
        <form action={logoutAction} className="inline-flex">
          <button
            type="submit"
            aria-label="Sign Out"
            title={userName ? `Sign out (${userName})` : 'Sign out'}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 border border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:bg-[var(--status-red-bg)] text-[var(--icon-color)] hover:text-[var(--status-red)] shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-red)] cursor-pointer active:scale-95"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
