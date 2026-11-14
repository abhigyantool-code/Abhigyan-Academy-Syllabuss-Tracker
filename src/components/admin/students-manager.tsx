'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  createStudentAction,
  updateStudentAction,
  bulkImportStudentsCsvAction,
  resetStudentPinAction,
} from '@/app/actions/admin-actions';
import { Plus, Edit2, Upload, Download, KeyRound, ExternalLink } from 'lucide-react';

interface StudentItem {
  id: string;
  roll_no: string;
  name: string;
  active: boolean;
  enrolled_course_ids: string[];
  enrolled_course_codes: string;
}

interface CourseItem {
  id: string;
  name: string;
  code: string;
}

interface StudentsManagerProps {
  students: StudentItem[];
  courses: CourseItem[];
}

export function StudentsManager({ students, courses }: StudentsManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvText, setCsvText] = useState(
    `Roll No,Name,Course Code\nABG-2026-011,Vikas Tripathi,NDA\nABG-2026-012,Rohan Malhotra,CDS\nABG-2026-013,Sneha Kulkarni,SSB`
  );
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // PIN Reset state
  const [pinResetStudent, setPinResetStudent] = useState<StudentItem | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  // New form state
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNo.trim() || !name.trim()) return;
    try {
      const res = await createStudentAction(rollNo, name, selectedCourses);
      setRollNo('');
      setName('');
      setSelectedCourses([]);
      setShowAddModal(false);
      setMsg({
        text: `Student "${name}" (${rollNo}) created! Temporary PIN: ${res.temporaryPin}`,
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to create student', type: 'error' });
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await updateStudentAction(
        editingStudent.id,
        editingStudent.roll_no,
        editingStudent.name,
        editingStudent.active,
        editingStudent.enrolled_course_ids || []
      );
      setEditingStudent(null);
      setMsg({ text: 'Student record updated!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Update failed', type: 'error' });
    }
  };

  const handleBulkImport = async () => {
    if (!csvText.trim()) return;
    try {
      const res = await bulkImportStudentsCsvAction(csvText);
      setShowBulkModal(false);
      let reportText = `Imported ${res.count} students successfully!`;
      if (res.generatedPins && res.generatedPins.length > 0) {
        if (res.generatedPins.length <= 5) {
          reportText += ` Temporary PINs: ${res.generatedPins.map((p) => `${p.rollNo}: ${p.temporaryPin}`).join(', ')}`;
        } else {
          reportText += ` Temporary PINs generated for ${res.generatedPins.length} students. (First 5: ${res.generatedPins.slice(0, 5).map((p) => `${p.rollNo}: ${p.temporaryPin}`).join(', ')}...)`;
        }
      }
      if (res.errors && res.errors.length > 0) {
        reportText += ` (${res.errors.length} failed).`;
      }
      setMsg({ text: reportText, type: res.count > 0 ? 'success' : 'error' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Bulk import failed', type: 'error' });
    }
  };

  const handlePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinResetStudent) return;
    if (newPin && !/^\d{4,8}$/.test(newPin)) {
      setMsg({ text: 'PIN must be 4–8 numeric digits.', type: 'error' });
      return;
    }
    setPinBusy(true);
    try {
      const res = await resetStudentPinAction(pinResetStudent.id, newPin.trim() || undefined);
      setPinResetStudent(null);
      setNewPin('');
      setMsg({
        text: `PIN for ${pinResetStudent.name} reset successfully! Temporary PIN: ${res.temporaryPin}`,
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'PIN reset failed', type: 'error' });
    } finally {
      setPinBusy(false);
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
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Students & Course Enrollments</h3>
          <p className="text-xs text-slate-400">
            Registered students allowed to submit verified class topics ({students.length} total).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Bulk Import CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Student Sheet Table */}
      <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
            <tr>
              <th className="py-2.5 px-3 w-36 border-r border-slate-800/80">Roll Number</th>
              <th className="py-2.5 px-4 border-r border-slate-800/80">Student Name</th>
              <th className="py-2.5 px-4 border-r border-slate-800/80">Enrolled Courses</th>
              <th className="py-2.5 px-3 w-28 text-center border-r border-slate-800/80">Status</th>
              <th className="py-2.5 px-3 w-40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {students.map((stu) => (
              <tr key={stu.id} className="hover:bg-slate-900/60 transition-colors text-slate-300">
                <td className="py-2.5 px-3 font-mono font-bold text-slate-200 border-r border-slate-800/60">
                  {stu.roll_no}
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-100 border-r border-slate-800/60">
                  {stu.name}
                </td>
                <td className="py-2.5 px-4 border-r border-slate-800/60">
                  <span className="font-mono text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                    {stu.enrolled_course_codes}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center border-r border-slate-800/60">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      stu.active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {stu.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={`/student?studentId=${stu.id}`}
                      className="p-1 rounded hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300"
                      title="Inspect Student Progress & Audit Timeline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => { setPinResetStudent(stu); setNewPin(''); }}
                      className="p-1 rounded hover:bg-amber-500/20 text-amber-400 hover:text-amber-300"
                      title="Reset PIN"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingStudent(stu)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      title="Edit Student"
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

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Enroll New Student</h3>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="e.g. ABG-2026-015"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Siddharth Joshi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Enrolled Courses</label>
                <div className="space-y-1.5 border border-slate-800 rounded-lg p-2.5 bg-slate-950 max-h-40 overflow-y-auto">
                  {courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCourses.includes(c.id)}
                        onChange={() =>
                          setSelectedCourses((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          )
                        }
                        className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span>
                        {c.name} ({c.code})
                      </span>
                    </label>
                  ))}
                </div>
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
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Student Details</h3>
            <form onSubmit={handleUpdateStudent} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  value={editingStudent.roll_no}
                  onChange={(e) => setEditingStudent({ ...editingStudent, roll_no: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Enrolled Courses</label>
                <div className="space-y-1.5 border border-slate-800 rounded-lg p-2.5 bg-slate-950 max-h-40 overflow-y-auto">
                  {courses.map((c) => {
                    const isChecked = (editingStudent.enrolled_course_ids || []).includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const current = editingStudent.enrolled_course_ids || [];
                            const updated = isChecked
                              ? current.filter((id) => id !== c.id)
                              : [...current, c.id];
                            setEditingStudent({ ...editingStudent, enrolled_course_ids: updated });
                          }}
                          className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                        />
                        <span>
                          {c.name} ({c.code})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="stu_active"
                  checked={editingStudent.active}
                  onChange={(e) => setEditingStudent({ ...editingStudent, active: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="stu_active" className="text-xs font-medium text-slate-300">
                  Student is currently active
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
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

      {/* Bulk Import Students Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-400" />
              Bulk Import Students via CSV
            </h3>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <p>
                Format: <code className="bg-slate-950 px-1 py-0.5 rounded text-slate-300">Roll No,Name,Course Code</code>
              </p>
              <a
                href="/templates/students_roster_template.csv"
                download="students_roster_template.csv"
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline font-medium shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template (.csv)
              </a>
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white"
              >
                Import Students
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PIN Reset Modal */}
      {pinResetStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Reset PIN — {pinResetStudent.name}
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
                  onClick={() => { setPinResetStudent(null); setNewPin(''); }}
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
    </div>
  );
}
