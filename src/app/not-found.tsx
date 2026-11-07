import Link from 'next/link';
import { FileQuestion, Home, Shield } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Academy Badge */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <FileQuestion className="w-8 h-8 text-violet-400" />
          </div>
        </div>

        {/* 404 Number */}
        <div>
          <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-violet-400 to-violet-700 select-none">
            404
          </div>
          <h1 className="text-xl font-bold text-white mt-2 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            This page doesn&apos;t exist in the Abhigyan Academy Syllabus Tracker.
          </p>
        </div>

        {/* Academy Branding */}
        <div className="inline-flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5 text-violet-400" />
          <span>ABHIGYAN ACADEMY — Defence Exam Coaching</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/submit"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow"
          >
            <Home className="w-4 h-4" />
            Go to Student Portal
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors border border-slate-700"
          >
            Faculty / Director Login
          </Link>
        </div>

        <p className="text-xs text-slate-600">
          If you think this is a mistake, contact your administrator.
        </p>
      </div>
    </div>
  );
}
