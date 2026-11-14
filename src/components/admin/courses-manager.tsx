'use client';

import React, { useState } from 'react';
import {
  createCourseAction,
  updateCourseAction,
  toggleCourseActiveAction,
  updateCourseSettingsAction,
} from '@/app/actions/admin-actions';
import { Plus, Edit2, Sliders, CheckCircle, XCircle, Shield } from 'lucide-react';

interface CourseWithSettings {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  active: boolean;
  confirmation_threshold: number;
  daily_entry_cap: number;
  code_ttl_minutes: number;
  require_class_code: boolean;
}

interface CoursesManagerProps {
  courses: CourseWithSettings[];
}

export function CoursesManager({ courses }: CoursesManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithSettings | null>(null);
  const [editingSettings, setEditingSettings] = useState<CourseWithSettings | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New course form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sortOrder, setSortOrder] = useState(courses.length + 1);
  const [threshold, setThreshold] = useState(5);
  const [dailyCap, setDailyCap] = useState(6);
  const [codeTtl, setCodeTtl] = useState(120);
  const [requireCode, setRequireCode] = useState(true);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    try {
      await createCourseAction({
        name,
        code,
        sort_order: sortOrder,
        confirmation_threshold: threshold,
        daily_entry_cap: dailyCap,
        code_ttl_minutes: codeTtl,
        require_class_code: requireCode,
      });
      setName('');
      setCode('');
      setShowAddModal(false);
      setMsg({ text: 'Course and settings created successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to create course', type: 'error' });
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      await updateCourseAction(editingCourse.id, {
        name: editingCourse.name,
        code: editingCourse.code,
        sort_order: editingCourse.sort_order,
        active: editingCourse.active,
      });
      setEditingCourse(null);
      setMsg({ text: 'Course details updated successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to update course', type: 'error' });
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await toggleCourseActiveAction(id, !current);
      setMsg({ text: `Course ${!current ? 'activated' : 'deactivated'}.`, type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Toggle failed', type: 'error' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSettings) return;
    try {
      await updateCourseSettingsAction(editingSettings.id, {
        confirmation_threshold: Number(editingSettings.confirmation_threshold),
        daily_entry_cap: Number(editingSettings.daily_entry_cap),
        code_ttl_minutes: Number(editingSettings.code_ttl_minutes),
        require_class_code: Boolean(editingSettings.require_class_code),
      });
      setEditingSettings(null);
      setMsg({ text: 'Course settings updated!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Settings update failed', type: 'error' });
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

      {/* Header with Add Button */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Courses & Settings</h3>
          <p className="text-xs text-slate-400">
            Active courses appear automatically as tabs on the student submission form and faculty dashboard.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Course</span>
        </button>
      </div>

      {/* Courses Sheet Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center border-r border-slate-800/80">Order</th>
              <th className="py-2.5 px-4 border-r border-slate-800/80">Course Name</th>
              <th className="py-2.5 px-3 w-24 text-center border-r border-slate-800/80">Code</th>
              <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Threshold</th>
              <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Daily Cap</th>
              <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Class Code</th>
              <th className="py-2.5 px-3 text-center border-r border-slate-800/80">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {courses.map((c) => (
              <tr key={c.id} className="hover:bg-slate-900/60 transition-colors text-slate-300">
                <td className="py-2.5 px-3 text-center font-mono text-slate-500 border-r border-slate-800/60">
                  {c.sort_order}
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-100 border-r border-slate-800/60">
                  {c.name}
                </td>
                <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400 border-r border-slate-800/60">
                  {c.code}
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-slate-300 border-r border-slate-800/60">
                  {c.confirmation_threshold || 5} students
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-slate-300 border-r border-slate-800/60">
                  {c.daily_entry_cap || 6} / day
                </td>
                <td className="py-2.5 px-3 text-center border-r border-slate-800/60">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      c.require_class_code
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {c.require_class_code ? 'Required' : 'Disabled'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center border-r border-slate-800/60">
                  <button
                    onClick={() => handleToggleActive(c.id, c.active)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                      c.active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {c.active ? (
                      <>
                        <CheckCircle className="w-3 h-3" /> Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" /> Inactive
                      </>
                    )}
                  </button>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => setEditingSettings(c)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400"
                      title="Adjust Course Threshold & Settings"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingCourse(c)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      title="Edit Course Name & Code"
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

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Create New Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Course Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. AFCAT Coaching"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. AFCAT"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Sort Order</label>
                  <input
                    type="number"
                    min={1}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Confirmation Threshold</label>
                  <input
                    type="number"
                    min={1}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Daily Cap</label>
                  <input
                    type="number"
                    min={1}
                    value={dailyCap}
                    onChange={(e) => setDailyCap(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="req_code_new"
                  checked={requireCode}
                  onChange={(e) => setRequireCode(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="req_code_new" className="text-xs font-medium text-slate-300">
                  Require daily class code from faculty for student submissions
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
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
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Settings Modal */}
      {editingSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Settings: {editingSettings.name}
            </h3>
            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Confirmation Threshold (Default distinct students needed to cover topic)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editingSettings.confirmation_threshold}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings,
                      confirmation_threshold: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Daily Submission Cap per Student (IST Day)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editingSettings.daily_entry_cap}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings,
                      daily_entry_cap: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Class Code Lifetime (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  value={editingSettings.code_ttl_minutes}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings,
                      code_ttl_minutes: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="req_code_edit"
                  checked={editingSettings.require_class_code}
                  onChange={(e) =>
                    setEditingSettings({
                      ...editingSettings,
                      require_class_code: e.target.checked,
                    })
                  }
                  className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="req_code_edit" className="text-xs font-medium text-slate-300">
                  Enforce class code validation on submission
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingSettings(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Update Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Course Details Modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-400" />
              Edit Course: {editingCourse.code}
            </h3>
            <form onSubmit={handleUpdateCourse} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Course Name</label>
                <input
                  type="text"
                  required
                  value={editingCourse.name}
                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Course Code</label>
                  <input
                    type="text"
                    required
                    value={editingCourse.code}
                    onChange={(e) => setEditingCourse({ ...editingCourse, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Sort Order</label>
                  <input
                    type="number"
                    min={1}
                    value={editingCourse.sort_order}
                    onChange={(e) => setEditingCourse({ ...editingCourse, sort_order: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="course_active_edit"
                  checked={editingCourse.active}
                  onChange={(e) => setEditingCourse({ ...editingCourse, active: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="course_active_edit" className="text-xs font-medium text-slate-300">
                  Course is active and visible on portals
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
