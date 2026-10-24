'use client';

import React, { useState } from 'react';
import { reviewEntryAction } from '@/app/actions/admin-actions';
import { formatISTDate, formatISTDateTime } from '@/lib/date-utils';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Smartphone, User, BookOpen } from 'lucide-react';

interface ReviewQueueItem {
  id: string;
  class_date: string;
  status: string;
  remarks: string | null;
  flags: string[];
  review_status: string;
  device_id: string;
  created_at: string;
  student_name: string;
  roll_no: string;
  teacher_name: string;
  subject_name: string;
  topic_name: string;
  seq_no: number;
  course_name: string;
  course_code: string;
}

interface ReviewQueueProps {
  entries: ReviewQueueItem[];
}

export function ReviewQueue({ entries }: ReviewQueueProps) {
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleReview = async (entryId: string, action: 'approved' | 'rejected') => {
    setProcessingId(entryId);
    try {
      await reviewEntryAction(entryId, action);
      setMsg({
        text: `Entry has been ${action === 'approved' ? 'approved and counted toward syllabus coverage' : 'rejected'}.`,
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'Review action failed', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            msg.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Flagged Submissions Review Queue
            <span className="text-xs font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
              {entries.length} pending
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Submissions flagged for rapid submission bursts, sequence jumping, or multi-student device reuse.
          </p>
        </div>
      </div>

      {/* Queue Cards / Table */}
      {entries.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-semibold text-slate-300">Review queue is empty</p>
          <p className="text-xs text-slate-500 mt-1">All student submissions are verified and clear of misuse flags.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {entries.map((e) => (
            <div
              key={e.id}
              className="bg-slate-900/70 border border-amber-500/30 rounded-xl p-5 shadow-lg space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                    {e.course_code}
                  </span>
                  <span className="text-sm font-bold text-slate-100">{e.student_name}</span>
                  <span className="text-xs font-mono text-slate-400">({e.roll_no})</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span>Class Date: <strong>{formatISTDate(e.class_date)}</strong></span>
                  <span>&bull;</span>
                  <span>Logged: {formatISTDateTime(e.created_at)}</span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Curriculum Topic</span>
                  <span className="font-semibold text-slate-200 block mt-0.5">
                    #{e.seq_no} {e.topic_name}
                  </span>
                  <span className="text-slate-400 text-[11px] block">{e.subject_name}</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Faculty Member</span>
                  <span className="font-semibold text-slate-200 block mt-0.5">{e.teacher_name}</span>
                  <span className="text-slate-400 text-[11px] block">Status Logged: {e.status.toUpperCase()}</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Device Fingerprint</span>
                  <span className="font-mono text-slate-400 text-[11px] truncate block mt-0.5" title={e.device_id}>
                    {e.device_id}
                  </span>
                  {e.remarks && <span className="text-slate-300 italic text-[11px] block mt-0.5">&quot;{e.remarks}&quot;</span>}
                </div>
              </div>

              {/* Flags & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Flags:
                  </span>
                  {e.flags && e.flags.length > 0 ? (
                    e.flags.map((flag) => (
                      <span
                        key={flag}
                        className="text-[11px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded font-semibold"
                      >
                        {flag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">None</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReview(e.id, 'rejected')}
                    disabled={processingId === e.id}
                    className="flex items-center gap-1 bg-slate-950 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Submission</span>
                  </button>
                  <button
                    onClick={() => handleReview(e.id, 'approved')}
                    disabled={processingId === e.id}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve as Valid</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
