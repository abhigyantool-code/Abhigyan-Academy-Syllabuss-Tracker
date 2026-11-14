'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TeacherDashboardData } from '@/lib/teacher-data';
import { logoutAction, teacherEndorseTopicAction, updateTeacherPinAction } from '@/app/actions/auth-actions';
import { voidTeachingRecordAction } from '@/app/actions/admin-actions';
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  LogOut,
  KeyRound,
  Layers,
  ChevronRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Loader2,
  Search,
  LayoutDashboard,
  Download,
  RotateCcw,
} from 'lucide-react';

interface TeacherPortalClientProps {
  data: TeacherDashboardData;
  teacherName: string;
  mustChangePin?: boolean;
}

export function TeacherPortalClient({ data, teacherName, mustChangePin = false }: TeacherPortalClientProps) {
  const router = useRouter();
  const { teacher, subjects, selectedSubjectId, topics, recentStudentLogs, teachingRecords = [], today } = data;

  const [activeTab, setActiveTab] = useState<'topics' | 'records' | 'logs' | 'settings'>('topics');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Void teaching record modal state
  const [voidTarget, setVoidTarget] = useState<{ id: string; topicName: string } | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  // Change PIN modal state
  const [showPinModal, setShowPinModal] = useState(mustChangePin);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(
    mustChangePin
      ? { text: '⚠️ Mandatory Credential Rotation: You are using a temporary or default PIN. Please enter your current PIN and set a secure personal PIN before continuing.', type: 'error' }
      : null
  );

  const currentSubject = subjects.find((s) => s.subject_id === selectedSubjectId) || subjects[0];

  // Filter topics
  const filteredTopics = topics.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.seq_no.toString() === searchQuery.trim()
  );

  const handleSubjectChange = (newSubjectId: string) => {
    router.push(`/teacher?subject=${newSubjectId}`);
  };

  const handleEndorse = async (topicId: string, subjectId: string, courseId: string) => {
    setActionLoadingId(topicId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await teacherEndorseTopicAction(topicId, subjectId, courseId);
      setSuccessMsg('Topic marked as completed and verified in academy records.');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to endorse topic.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleVoidRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    if (voidReason.trim().length < 10) {
      setErrorMsg('Correction / void reason must be at least 10 characters long.');
      return;
    }
    setVoidBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await voidTeachingRecordAction(voidTarget.id, voidReason.trim());
      setVoidTarget(null);
      setVoidReason('');
      setSuccessMsg(`Teaching record for "${voidTarget.topicName}" has been voided and coverage recalculated.`);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to void teaching record.');
    } finally {
      setVoidBusy(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setPinMsg({ text: 'New PIN and confirmation PIN do not match.', type: 'error' });
      return;
    }
    setPinLoading(true);
    setPinMsg(null);
    try {
      await updateTeacherPinAction(oldPin, newPin);
      setPinMsg({ text: 'PIN successfully updated! Remember your new PIN.', type: 'success' });
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setShowPinModal(false);
        router.replace('/teacher');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setPinMsg({ text: err.message || 'Failed to update PIN', type: 'error' });
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-black text-xs shadow-md shadow-indigo-600/20">
              AA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-white tracking-tight">
                  ABHIGYAN ACADEMY
                </h1>
                <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
                  Faculty Portal
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">Personal Lecture & Syllabus Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold text-zinc-200">{teacherName}</span>
            </div>

            <a
              href={`/api/export?type=topics&courseId=${currentSubject?.course_id || 'all'}`}
              title="Export Syllabus Topics CSV"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Export CSV</span>
            </a>

            <Link
              href="/dashboard"
              title="View Executive Performance Dashboard"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors text-xs flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Executive Dashboard</span>
            </Link>

            <button
              onClick={() => setShowPinModal(true)}
              title="Change Security PIN"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors text-xs flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Change PIN</span>
            </button>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950/30 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider font-bold">
                Logged in as Faculty
              </span>
              <span className="text-zinc-600">&bull;</span>
              <span className="text-xs text-zinc-400 font-mono">{today} (IST)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Welcome, {teacherName}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Your session is strictly isolated to your assigned subjects. Students submit topic logs from `/submit`.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-center">
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Assigned Batches</span>
              <span className="text-lg font-black text-indigo-400">{subjects.length}</span>
            </div>
            {currentSubject?.enrolled_students !== undefined && (
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-center">
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">Class Strength</span>
                <span className="text-lg font-black text-sky-400">{currentSubject.enrolled_students}</span>
              </div>
            )}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-center">
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Teaching Records</span>
              <span className="text-lg font-black text-amber-400">
                {teachingRecords.filter((tr) => !tr.is_voided).length}
              </span>
            </div>
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2 text-center">
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Student Logs</span>
              <span className="text-lg font-black text-emerald-400">{recentStudentLogs.length}</span>
            </div>
          </div>
        </div>

        {/* Global Alert Messages */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {successMsg}
            </span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
              &times;
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              {errorMsg}
            </span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
              &times;
            </button>
          </div>
        )}

        {/* Subject Selector Ribbon (if teacher teaches across multiple courses or subjects) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
            Select Batch & Subject
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {subjects.map((sub) => {
              const isSelected = sub.subject_id === selectedSubjectId;
              return (
                <button
                  key={sub.subject_id}
                  onClick={() => handleSubjectChange(sub.subject_id)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2.5 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20'
                      : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase bg-black/30 px-1.5 py-0.5 rounded">
                    {sub.course_code}
                  </span>
                  <span>{sub.subject_name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {sub.covered_topics}/{sub.total_topics} ({sub.progress_pct}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Subject Progress Bar */}
        {currentSubject && (
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>{currentSubject.course_name}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                  <span className="text-indigo-400">{currentSubject.subject_name}</span>
                  {currentSubject.enrolled_students !== undefined && (
                    <span className="text-[11px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                      {currentSubject.enrolled_students} Enrolled Students
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-400">
                  {currentSubject.covered_topics} of {currentSubject.total_topics} curriculum topics covered
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-white font-mono">{currentSubject.progress_pct}%</span>
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Completion</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, currentSubject.progress_pct))}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('topics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'topics'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Curriculum Topics ({topics.length})
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'records'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>My Teaching Records</span>
              <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded text-[10px]">
                {teachingRecords.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Recent Student Submissions</span>
              <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded text-[10px]">
                {recentStudentLogs.length}
              </span>
            </button>
          </div>

          {activeTab === 'topics' && (
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search topics or #seq..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* TAB 1: CURRICULUM TOPICS LIST */}
        {activeTab === 'topics' && (
          <div className="space-y-3">
            <div className="border border-zinc-800/80 rounded-2xl overflow-x-auto bg-zinc-950 shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-16 text-center border-r border-zinc-800/80">#Seq</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/80">Topic / Lecture Title</th>
                    <th className="py-2.5 px-3 w-32 border-r border-zinc-800/80">Target Date</th>
                    <th className="py-2.5 px-3 w-28 text-center border-r border-zinc-800/80">Status</th>
                    <th className="py-2.5 px-3 w-40 text-right">Faculty Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {filteredTopics.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500 text-xs">
                        No topics match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredTopics.map((top) => {
                      const isCovered = top.status === 'covered';
                      const isLoading = actionLoadingId === top.id;
                      const activeTeachingRec = teachingRecords.find(
                        (tr) => tr.topic_id === top.id && !tr.is_voided
                      );

                      return (
                        <tr key={top.id} className="hover:bg-zinc-900/50 transition-colors text-zinc-300">
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-500 border-r border-zinc-800/60">
                            #{top.seq_no}
                          </td>
                          <td className="py-2.5 px-4 border-r border-zinc-800/60 font-medium text-zinc-200">
                            <span>{top.name}</span>
                            {top.notes && (
                              <span className="block text-[11px] text-zinc-500 font-normal">{top.notes}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400 border-r border-zinc-800/60 whitespace-nowrap">
                            {top.target_date || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-zinc-800/60 whitespace-nowrap">
                            {isCovered ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Covered
                              </span>
                            ) : top.status === 'in_progress' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                Partial
                              </span>
                            ) : top.status === 'overdue' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/20">
                                Overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-800 text-zinc-500">
                                Upcoming
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {isCovered ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-emerald-400/80 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Verified
                                </span>
                                {activeTeachingRec && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVoidTarget({ id: activeTeachingRec.id, topicName: top.name });
                                      setVoidReason('');
                                    }}
                                    title="Void / Correct this teaching record"
                                    className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    <span>Retract</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEndorse(top.id, top.subject_id, top.course_id)}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                <span>Mark Taught</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MY TEACHING RECORDS (FACULTY ENDORSEMENTS & CORRECTIONS) */}
        {activeTab === 'records' && (
          <div className="space-y-3">
            <div className="border border-zinc-800/80 rounded-2xl overflow-x-auto bg-zinc-950 shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-28 border-r border-zinc-800/80">Session Date</th>
                    <th className="py-2.5 px-3 w-28 border-r border-zinc-800/80">Course & Subject</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/80">Topic Endorsed</th>
                    <th className="py-2.5 px-3 w-28 text-center border-r border-zinc-800/80">Status</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/80">Remarks / Correction Note</th>
                    <th className="py-2.5 px-3 w-32 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {teachingRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                        No teaching records logged yet. Click &ldquo;Mark Taught&rdquo; on any curriculum topic to record a completed class.
                      </td>
                    </tr>
                  ) : (
                    teachingRecords.map((tr) => (
                      <tr key={tr.id} className="hover:bg-zinc-900/50 transition-colors text-zinc-300">
                        <td className="py-2.5 px-3 font-mono text-zinc-400 border-r border-zinc-800/60 whitespace-nowrap">
                          {tr.session_date}
                        </td>
                        <td className="py-2.5 px-3 border-r border-zinc-800/60 whitespace-nowrap">
                          <span className="font-semibold text-zinc-100 block">{tr.subject_name}</span>
                          <span className="text-[10px] text-indigo-400 font-mono uppercase">{tr.course_code}</span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-zinc-200 border-r border-zinc-800/60">
                          #{tr.topic_seq} &bull; {tr.topic_name}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-zinc-800/60 whitespace-nowrap">
                          {tr.is_voided ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/20">
                              Voided
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              {tr.status}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-400 text-[11px] border-r border-zinc-800/60">
                          {tr.is_voided
                            ? `Voided: ${tr.void_reason || 'Retracted by faculty'}`
                            : tr.remarks || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {tr.is_voided ? (
                            <span className="text-[10px] font-mono text-zinc-500">Retracted</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidTarget({ id: tr.id, topicName: tr.topic_name });
                                setVoidReason('');
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Void / Correct</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: RECENT STUDENT SUBMISSIONS */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <div className="border border-zinc-800/80 rounded-2xl overflow-x-auto bg-zinc-950 shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-28 border-r border-zinc-800/80">Class Date</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/80">Student Name</th>
                    <th className="py-2.5 px-3 w-28 border-r border-zinc-800/80">S.No / ID</th>
                    <th className="py-2.5 px-4 border-r border-zinc-800/80">Topic Submitted</th>
                    <th className="py-2.5 px-3 w-24 text-center border-r border-zinc-800/80">Status</th>
                    <th className="py-2.5 px-3 text-right">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {recentStudentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                        No student submissions recorded yet for your classes.
                      </td>
                    </tr>
                  ) : (
                    recentStudentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors text-zinc-300">
                        <td className="py-2.5 px-3 font-mono text-zinc-400 border-r border-zinc-800/60">
                          {log.class_date}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-zinc-100 border-r border-zinc-800/60">
                          {log.student_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-400 font-bold border-r border-zinc-800/60">
                          {log.student_roll}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-zinc-200 border-r border-zinc-800/60">
                          <span>#{log.topic_seq} &bull; {log.topic_name}</span>
                          <span className="block text-[10px] text-zinc-500 font-mono uppercase">{log.course_code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-zinc-800/60">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-400 text-[11px] truncate max-w-[200px]">
                          {log.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Void / Correct Teaching Record Modal */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Void / Correct Teaching Record
              </h3>
              <button
                onClick={() => setVoidTarget(null)}
                className="text-zinc-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Retracting faculty endorsement for <strong className="text-zinc-200">{voidTarget.topicName}</strong>. Please provide a reason (at least 10 characters) for the academy audit log.
            </p>
            <form onSubmit={handleVoidRecord} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Reason for Correction / Retraction
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Marked topic #2 by mistake instead of topic #1 during morning lecture."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidTarget(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidBusy}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white flex items-center gap-1.5"
                >
                  {voidBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Confirm Retraction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                Change Faculty Security PIN
              </h3>
              {!mustChangePin && (
                <button
                  onClick={() => setShowPinModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  &times;
                </button>
              )}
            </div>

            {pinMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  pinMsg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{pinMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Current PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  placeholder="Enter current PIN"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  New 4–8 Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  placeholder="e.g. 582190"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Must be 4–8 digits. Avoid simple patterns like 1234 or 0000.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  placeholder="Re-enter new PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {!mustChangePin && (
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={pinLoading}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5"
                >
                  {pinLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Save New PIN</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
