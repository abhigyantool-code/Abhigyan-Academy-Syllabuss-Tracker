'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { teacherLoginAction } from '@/app/actions/auth-actions';
import { UserCheck, KeyRound, ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

interface TeacherItem {
  id: string;
  name: string;
  phone: string | null;
  subjects: string;
}

interface TeacherLoginFormProps {
  teachers: TeacherItem[];
}

export function TeacherLoginForm({ teachers }: TeacherLoginFormProps) {
  const router = useRouter();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      setError('Please choose your faculty profile.');
      return;
    }
    if (!pin.trim()) {
      setError('Please enter your 4-digit PIN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await teacherLoginAction(selectedTeacherId, pin);
      if (res.success) {
        router.push('/teacher');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            Select Your Faculty Profile
          </label>
          <span className="text-[11px] text-zinc-500 font-mono">8 Active</span>
        </div>
        <select
          value={selectedTeacherId}
          onChange={(e) => {
            setSelectedTeacherId(e.target.value);
            setError(null);
          }}
          className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        >
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.subjects})
            </option>
          ))}
        </select>
        {selectedTeacher && (
          <p className="text-[11px] text-indigo-400 mt-1.5 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"></span>
            Assigned Subjects: {selectedTeacher.subjects}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            Faculty 4-Digit PIN
          </label>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            Default: 1234
          </span>
        </div>
        <input
          type="password"
          maxLength={8}
          placeholder="Enter 4-digit PIN (1234)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-3 text-center text-lg font-mono tracking-widest font-black text-white placeholder:text-zinc-600 placeholder:text-xs placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/25 active:scale-98"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Signing into your session...</span>
          </>
        ) : (
          <>
            <span>Open My Teacher Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1 text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Isolated Teacher Session
        </span>
        <span>Port 3005</span>
      </div>
    </form>
  );
}
