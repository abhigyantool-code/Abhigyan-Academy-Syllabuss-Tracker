'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { studentLoginAction } from '@/app/actions/auth-actions';
import {
  GraduationCap,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  User,
  ChevronDown,
} from 'lucide-react';

export interface SafeStudentItem {
  id: string;
  name: string;
  roll_no: string;
}

interface StudentLoginFormProps {
  students: SafeStudentItem[];
}

export function StudentLoginForm({ students }: StudentLoginFormProps) {
  const router = useRouter();

  // Selected roll number (from dropdown or typed)
  const [selectedRollNo, setSelectedRollNo] = useState<string>('');
  const [manualRollNo, setManualRollNo] = useState<string>('');
  const [useManualInput, setUseManualInput] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveRollNo = useManualInput ? manualRollNo.trim() : selectedRollNo.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRollNo) {
      setError('Please select or enter your Student Roll Number.');
      return;
    }
    if (!pin.trim()) {
      setError('Please enter your 4–8 digit Student PIN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await studentLoginAction(effectiveRollNo, pin);
      if (res.success) {
        if (res.mustChangePin) {
          router.push('/student?mustChangePin=true');
        } else {
          router.push('/student');
        }
        router.refresh();
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Alert Box */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Selector / Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              Student Profile / Roll Number
            </label>
            <button
              type="button"
              onClick={() => {
                setUseManualInput(!useManualInput);
                setError(null);
              }}
              className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {useManualInput ? 'Select from list' : 'Type Roll No'}
            </button>
          </div>

          {!useManualInput && students.length > 0 ? (
            <div className="relative">
              <select
                value={selectedRollNo}
                onChange={(e) => {
                  setSelectedRollNo(e.target.value);
                  setError(null);
                }}
                className="w-full appearance-none bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all pr-10"
              >
                <option value="">-- Choose your name & roll number --</option>
                {students.map((st) => (
                  <option key={st.id} value={st.roll_no}>
                    {st.name} ({st.roll_no})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              required
              placeholder="e.g. NDA-01, CDS-05"
              value={manualRollNo}
              onChange={(e) => {
                setManualRollNo(e.target.value.toUpperCase());
                setError(null);
              }}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white uppercase placeholder:text-zinc-600 placeholder:text-xs placeholder:font-sans focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          )}

          <p className="text-[11px] text-zinc-500 mt-1.5">
            Select your registered cadet name or enter your official Roll Number.
          </p>
        </div>

        {/* Student 4-8 Digit PIN */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              Student PIN
            </label>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              4–8 Digits
            </span>
          </div>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            required
            placeholder="Enter your security PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono tracking-widest font-black text-white placeholder:text-zinc-600 placeholder:text-xs placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Access your personal class logs, syllabus progress percentage, and teacher feedback.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/25 active:scale-98"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <>
              <span>Access Student Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Security Footer Notice */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1 text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Server-Derived Identity Security
        </span>
        <span className="font-mono text-zinc-500">IST Referenced</span>
      </div>
    </div>
  );
}
