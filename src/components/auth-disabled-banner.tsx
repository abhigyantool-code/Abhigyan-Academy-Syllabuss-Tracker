import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AuthDisabledBannerProps {
  area: 'admin' | 'dashboard' | 'submit';
}

export function AuthDisabledBanner({ area }: AuthDisabledBannerProps) {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between">
      <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          <strong className="font-semibold uppercase tracking-wider text-[11px] bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded mr-1.5">
            Phase 1 Notice
          </strong>
          Authentication is disabled. Route <code className="font-mono bg-amber-100 dark:bg-amber-950 px-1 rounded">/{area}</code> is currently open for development review.
        </span>
      </div>
    </div>
  );
}
