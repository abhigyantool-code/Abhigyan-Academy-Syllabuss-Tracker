'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('[Syllabus Tracker Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Academy Badge */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Abhigyan Academy — Syllabus Tracker encountered an unexpected error.
          </p>
        </div>

        {/* Error Detail */}
        {error.message && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-left">
            <p className="text-xs font-mono text-rose-300 break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs font-mono text-slate-500 mt-1">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/submit"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors border border-slate-700"
          >
            <Home className="w-4 h-4" />
            Go to Student Portal
          </Link>
        </div>

        <p className="text-xs text-slate-600">
          If this keeps happening, contact your administrator.
        </p>
      </div>
    </div>
  );
}
