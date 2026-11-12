'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { teacherLoginAction, adminLoginAction, studentLoginAction } from '@/app/actions/auth-actions';
import {
  UserCheck,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Shield,
  Lock,
  GraduationCap,
  User,
} from 'lucide-react';

interface TeacherItem {
  id: string;
  name: string;
  phone: string | null;
  subjects: string;
}

interface TeacherLoginFormProps {
  teachers: TeacherItem[];
  initialTab?: 'faculty' | 'admin' | 'student';
}

export function TeacherLoginForm({ teachers, initialTab = 'faculty' }: TeacherLoginFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'faculty' | 'admin' | 'student'>(initialTab);

  // Faculty form state
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [pin, setPin] = useState<string>('');

  // Admin form state
  const [adminPassword, setAdminPassword] = useState<string>('');

  // Student form state
  const [studentRollNo, setStudentRollNo] = useState<string>('');
  const [studentPin, setStudentPin] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentRollNo.trim()) {
      setError('Please enter your Student Roll Number.');
      return;
    }
    if (!studentPin.trim()) {
      setError('Please enter your 4-digit PIN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await studentLoginAction(studentRollNo, studentPin);
      if (res.success) {
        router.push('/student');
        router.refresh();
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFacultySubmit = async (e: React.FormEvent) => {
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
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setError('Please enter the Director Master Password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await adminLoginAction(adminPassword);
      if (res.success) {
        router.push('/admin');
        router.refresh();
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Access denied. Incorrect master password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="grid grid-cols-3 p-1 bg-zinc-950/80 border border-zinc-800 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('faculty');
            setError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'faculty'
              ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/10'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Faculty</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('student');
            setError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'student'
              ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/10'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Student</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('admin');
            setError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'admin'
              ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/10'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-violet-400" />
          <span>Director</span>
        </button>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Faculty Sign-In Form */}
      {activeTab === 'faculty' ? (
        <form onSubmit={handleFacultySubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Select Faculty Profile
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">8 Active</span>
            </div>
            <select
              value={selectedTeacherId}
              onChange={(e) => {
                setSelectedTeacherId(e.target.value);
                setError(null);
              }}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono tracking-widest font-black text-white placeholder:text-zinc-600 placeholder:text-xs placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/25 active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Opening Teacher Session...</span>
              </>
            ) : (
              <>
                <span>Open Teacher Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : activeTab === 'student' ? (
        /* Student Sign-In Form */
        <form onSubmit={handleStudentSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-400" />
                Student Roll Number
              </label>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Enrolled Student
              </span>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. NDA-01, CDS-05"
              value={studentRollNo}
              onChange={(e) => setStudentRollNo(e.target.value.toUpperCase())}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white uppercase placeholder:text-zinc-600 placeholder:text-xs placeholder:font-sans focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                Student 4-Digit PIN
              </label>
              <span className="text-[11px] font-normal text-zinc-500 font-mono">
                Default: <span className="text-emerald-400 font-bold">1234</span>
              </span>
            </div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              placeholder="Enter your PIN"
              value={studentPin}
              onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white tracking-widest placeholder:text-zinc-600 placeholder:text-xs placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <p className="text-[11px] text-zinc-500 mt-1.5">
              Access your personal class logs, syllabus progress percentage, and teacher feedback.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/25 active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Access Student Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        /* Director / Admin Form */
        <form onSubmit={handleAdminSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-violet-400" />
                Director Master Password
              </label>
              <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                Admin Console
              </span>
            </div>
            <input
              type="password"
              placeholder="Enter Director Master Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-sans font-medium text-white placeholder:text-zinc-600 placeholder:text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
            <p className="text-[11px] text-zinc-500 mt-1.5">
              Grants full administrative access to syllabus manager, faculty roster, and audit logs.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-lg shadow-violet-600/25 active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Director...</span>
              </>
            ) : (
              <>
                <span>Open Admin Governance Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1 text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Encrypted Session Cookie
        </span>
        <span className="font-mono">Port 3005</span>
      </div>
    </div>
  );
}
