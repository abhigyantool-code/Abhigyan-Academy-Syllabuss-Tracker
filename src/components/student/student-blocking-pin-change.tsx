'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeStudentPinAction, logoutAction } from '@/app/actions/auth-actions';
import {
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  LogOut,
  GraduationCap,
} from 'lucide-react';

interface StudentBlockingPinChangeProps {
  studentName: string;
  rollNo: string;
}

export function StudentBlockingPinChange({ studentName, rollNo }: StudentBlockingPinChangeProps) {
  const router = useRouter();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin.trim() || !newPin.trim()) {
      setMsg({ text: 'All PIN fields are required.', type: 'error' });
      return;
    }

    if (newPin !== confirmPin) {
      setMsg({ text: 'New PIN and Confirm PIN do not match.', type: 'error' });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await changeStudentPinAction(rollNo, currentPin, newPin);
      if (res.success) {
        setMsg({ text: 'PIN successfully rotated! Loading your student dashboard...', type: 'success' });
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => {
          router.replace('/student');
          router.refresh();
        }, 1200);
      } else {
        setMsg({ text: res.error || 'Failed to update PIN.', type: 'error' });
      }
    } catch (err: any) {
      setMsg({ text: err?.message || 'An unexpected error occurred.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 text-white items-center justify-center font-black text-xl shadow-xl shadow-amber-600/20 ring-1 ring-white/20 mb-2">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Mandatory Credential Rotation
          </h1>
          <p className="text-xs text-zinc-400">
            Abhigyan Academy &bull; Student Security Requirement
          </p>
        </div>

        {/* Blocking Card */}
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              Welcome, <strong>{studentName}</strong> ({rollNo}). Your account is currently using a temporary admin-issued PIN. You must set a permanent personal PIN to activate your dashboard.
            </div>
          </div>

          {msg && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 ${
                msg.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Current Temporary PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                required
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter temporary PIN"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-300 block">
                  New Personal PIN
                </label>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                  4–8 Digits
                </span>
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Choose a strong PIN"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-amber-500 transition-all"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Once set, this PIN cannot be changed again without administrator assistance.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Confirm New PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Re-enter new PIN"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-600/25 active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating PIN...</span>
                </>
              ) : (
                <>
                  <span>Activate Personal PIN & Continue</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
            <span className="font-mono">Single-use PIN rotation policy</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
