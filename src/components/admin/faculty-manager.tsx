'use client';

import React, { useState } from 'react';
import {
  createTeacherAction,
  updateTeacherAction,
  assignTeacherSubjectsAction,
  resetTeacherPinAction,
  voidTeachingRecordAction,
} from '@/app/actions/admin-actions';
import { Plus, Edit2, BookOpen, KeyRound, RotateCcw, CheckCircle2 } from 'lucide-react';

interface TeacherItem {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  assigned_subject_ids: string[];
  assigned_subject_names: string;
}

interface SubjectItem {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  name: string;
}

interface TeachingRecordAdminItem {
  id: string;
  session_date: string;
  status: string;
  remarks: string | null;
  is_voided: boolean;
  voided_by: string | null;
  void_reason: string | null;
  teacher_id: string;
  teacher_name: string;
  subject_name: string;
  topic_name: string;
  topic_seq: number;
  course_code: string;
}

interface FacultyManagerProps {
  teachers: TeacherItem[];
  subjects: SubjectItem[];
  teachingRecords?: TeachingRecordAdminItem[];
}

export function FacultyManager({ teachers, subjects, teachingRecords = [] }: FacultyManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [allocatingTeacher, setAllocatingTeacher] = useState<TeacherItem | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // PIN Reset state
  const [pinResetTeacher, setPinResetTeacher] = useState<TeacherItem | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  // Void teaching record state
  const [voidTarget, setVoidTarget] = useState<TeachingRecordAdminItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  // New form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await createTeacherAction(name, phone || null);
      setName('');
      setPhone('');
      setShowAddModal(false);
      setMsg({
        text: `Faculty member "${name}" added successfully! Temporary PIN: ${res.temporaryPin}`,
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to add teacher', type: 'error' });
    }
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    try {
      await updateTeacherAction(
        editingTeacher.id,
        editingTeacher.name,
        editingTeacher.phone,
        editingTeacher.active
      );
      setEditingTeacher(null);
      setMsg({ text: 'Faculty member updated!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Update failed', type: 'error' });
    }
  };

  const handleOpenAllocation = (teacher: TeacherItem) => {
    setAllocatingTeacher(teacher);
    setSelectedSubjectIds(teacher.assigned_subject_ids || []);
  };

  const handleSaveAllocations = async () => {
    if (!allocatingTeacher) return;
    try {
      await assignTeacherSubjectsAction(allocatingTeacher.id, selectedSubjectIds);
      setAllocatingTeacher(null);
      setMsg({ text: 'Subject allocations saved successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Allocation failed', type: 'error' });
    }
  };

  const toggleSubject = (sId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handlePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinResetTeacher) return;
    if (newPin && !/^\d{4,8}$/.test(newPin)) {
      setMsg({ text: 'PIN must be 4–8 numeric digits.', type: 'error' });
      return;
    }
    setPinBusy(true);
    try {
      const res = await resetTeacherPinAction(pinResetTeacher.id, newPin.trim() || undefined);
      setPinResetTeacher(null);
      setNewPin('');
      setMsg({
        text: `PIN for ${pinResetTeacher.name} reset successfully! Temporary PIN: ${res.temporaryPin}`,
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'PIN reset failed', type: 'error' });
    } finally {
      setPinBusy(false);
    }
  };

  const handleVoidRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    if (voidReason.trim().length < 10) {
      setMsg({ text: 'Void reason must be at least 10 characters long.', type: 'error' });
      return;
    }
    setVoidBusy(true);
    try {
      await voidTeachingRecordAction(voidTarget.id, voidReason.trim());
      setVoidTarget(null);
      setVoidReason('');
      setMsg({
        text: `Teaching record for "${voidTarget.topic_name}" (${voidTarget.teacher_name}) voided successfully.`,
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to void teaching record', type: 'error' });
    } finally {
      setVoidBusy(false);
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
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Faculty & Subject Allocations</h3>
          <p className="text-xs text-slate-400">
            Assign instructors to curriculum subjects to enable cascading teacher dropdowns on the student form.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Faculty</span>
        </button>
      </div>

      {/* Faculty Table */}
      <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
            <tr>
              <th className="py-2.5 px-4 border-r border-slate-800/80">Faculty Name</th>
              <th className="py-2.5 px-3 w-36 border-r border-slate-800/80">Phone</th>
              <th className="py-2.5 px-4 border-r border-slate-800/80">Assigned Curriculum Subjects</th>
              <th className="py-2.5 px-3 w-28 text-center border-r border-slate-800/80">Status</th>
              <th className="py-2.5 px-3 w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {teachers.map((tea) => (
              <tr key={tea.id} className="hover:bg-slate-900/60 transition-colors text-slate-300">
                <td className="py-2.5 px-4 font-semibold text-slate-100 border-r border-slate-800/60">
                  {tea.name}
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-400 border-r border-slate-800/60">
                  {tea.phone || '-'}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-300 border-r border-slate-800/60">
                  {tea.assigned_subject_names}
                </td>
                <td className="py-2.5 px-3 text-center border-r border-slate-800/60">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      tea.active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {tea.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => handleOpenAllocation(tea)}
                      className="flex items-center gap-1 text-[11px] bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded font-semibold transition-colors"
                      title="Assign Subjects"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Assign</span>
                    </button>
                    <button
                      onClick={() => { setPinResetTeacher(tea); setNewPin(''); }}
                      className="p-1 rounded hover:bg-amber-500/20 text-amber-400 hover:text-amber-300"
                      title="Reset PIN"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingTeacher(tea)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Faculty Teaching Records Monitoring */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Faculty Teaching Records Monitoring</span>
            </h3>
            <p className="text-xs text-slate-400">
              Audit log of lectures directly marked taught by faculty members ({teachingRecords.filter((tr) => !tr.is_voided).length} active).
            </p>
          </div>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="py-2.5 px-3 w-28 border-r border-slate-800/80">Session Date</th>
                <th className="py-2.5 px-4 border-r border-slate-800/80">Faculty Member</th>
                <th className="py-2.5 px-3 w-36 border-r border-slate-800/80">Course & Subject</th>
                <th className="py-2.5 px-4 border-r border-slate-800/80">Topic Endorsed</th>
                <th className="py-2.5 px-3 w-28 text-center border-r border-slate-800/80">Status</th>
                <th className="py-2.5 px-4 border-r border-slate-800/80">Remarks / Audit Note</th>
                <th className="py-2.5 px-3 w-32 text-right">Governance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {teachingRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 text-xs">
                    No faculty teaching records logged yet.
                  </td>
                </tr>
              ) : (
                teachingRecords.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-900/60 transition-colors text-slate-300">
                    <td className="py-2.5 px-3 font-mono text-slate-400 border-r border-slate-800/60 whitespace-nowrap">
                      {tr.session_date}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-100 border-r border-slate-800/60 whitespace-nowrap">
                      {tr.teacher_name}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-800/60 whitespace-nowrap">
                      <span className="font-semibold text-slate-200 block">{tr.subject_name}</span>
                      <span className="text-[10px] font-mono text-indigo-400 uppercase">{tr.course_code}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-200 border-r border-slate-800/60">
                      #{tr.topic_seq} &bull; {tr.topic_name}
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-slate-800/60 whitespace-nowrap">
                      {tr.is_voided ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Voided
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {tr.status}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-400 border-r border-slate-800/60">
                      {tr.is_voided
                        ? `Voided (${tr.voided_by || 'Admin'}): ${tr.void_reason || ''}`
                        : tr.remarks || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {tr.is_voided ? (
                        <span className="text-[10px] font-mono text-slate-500">Retracted</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setVoidTarget(tr);
                            setVoidReason('');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2.5 py-1 rounded transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Void</span>
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

      {/* Add Faculty Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add New Faculty</h3>
            <form onSubmit={handleCreateTeacher} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Full Name & Rank</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Col. A. K. Joshi (Retd.)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Save Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Faculty Profile</h3>
            <form onSubmit={handleUpdateTeacher} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Full Name & Rank</label>
                <input
                  type="text"
                  required
                  value={editingTeacher.name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={editingTeacher.phone || ''}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, phone: e.target.value || null })}
                  placeholder="+91 98765 00000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tea_active"
                  checked={editingTeacher.active}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, active: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="tea_active" className="text-xs font-medium text-slate-300">
                  Faculty account is currently active
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Subjects Modal */}
      {allocatingTeacher && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Assign Subjects to {allocatingTeacher.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Select the subjects this faculty member is qualified to teach.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 border border-slate-800 rounded-lg p-3 bg-slate-950">
              {subjects.map((sub) => {
                const isChecked = selectedSubjectIds.includes(sub.id);
                return (
                  <label
                    key={sub.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900/80 cursor-pointer border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSubject(sub.id)}
                        className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span className="text-xs font-medium text-slate-200">{sub.name}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                      {sub.course_code}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAllocatingTeacher(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAllocations}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save Allocations
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PIN Reset Modal — Faculty */}
      {pinResetTeacher && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Reset PIN — {pinResetTeacher.name}
            </h3>
            <p className="text-xs text-slate-400">
              Enter a custom 4–8 digit numeric PIN, or leave blank to automatically generate a secure 6-digit temporary PIN.
            </p>
            <form onSubmit={handlePinReset} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  New PIN (Optional — leave empty to auto-generate)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Leave empty for auto-generated PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setPinResetTeacher(null); setNewPin(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pinBusy}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
                >
                  {pinBusy ? 'Resetting…' : 'Reset PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Teaching Record Modal — Admin */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              Void Teaching Record — {voidTarget.teacher_name}
            </h3>
            <p className="text-xs text-slate-400">
              Retracting teaching record for <strong className="text-slate-200">{voidTarget.topic_name}</strong> ({voidTarget.course_code}). Provide a mandatory audit reason (at least 10 characters).
            </p>
            <form onSubmit={handleVoidRecord} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Governance Void Reason
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Incorrect topic logged by faculty; retracting per academy governance."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setVoidTarget(null); setVoidReason(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidBusy}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
                >
                  {voidBusy ? 'Voiding…' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
