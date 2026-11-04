'use client';

import React, { useState } from 'react';
import {
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
  createTopicAction,
  updateTopicAction,
  deleteTopicAction,
  reorderTopicsAction,
  copySyllabusAction,
  bulkImportTopicsCsvAction,
} from '@/app/actions/admin-actions';
import { formatISTDate } from '@/lib/date-utils';
import {
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Upload,
  Download,
  Copy,
  FolderPlus,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface CourseItem {
  id: string;
  name: string;
  code: string;
}

interface SubjectItem {
  id: string;
  course_id: string;
  name: string;
  sort_order: number;
  topics_count: number;
}

interface TopicItem {
  id: string;
  subject_id: string;
  name: string;
  seq_no: number;
  target_date: string | null;
  notes: string | null;
  subject_name: string;
  course_id: string;
}

interface CurriculumManagerProps {
  courses: CourseItem[];
  subjects: SubjectItem[];
  topics: TopicItem[];
}

export function CurriculumManager({ courses, subjects, topics }: CurriculumManagerProps) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  const [showAddTopic, setShowAddTopic] = useState<string | null>(null); // subjectId
  const [topicName, setTopicName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [topicNotes, setTopicNotes] = useState('');

  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);

  // Bulk Import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvText, setCsvText] = useState(
    `Subject,Topic Name,Target Date,Notes\nMathematics,Limits & Continuity,2026-11-05,Calculus Part 1\nMathematics,Differentiation Basics,2026-11-12,Product & Quotient Rule\nEnglish,Active and Passive Voice,2026-11-08,Grammar section`
  );

  // Clone Syllabus state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState(courses[0]?.id || '');

  const filteredSubjects = subjects.filter((s) => s.course_id === selectedCourseId);

  const getTopicsForSubject = (subjectId: string) => {
    return topics.filter((t) => t.subject_id === subjectId).sort((a, b) => a.seq_no - b.seq_no);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      await createSubjectAction(selectedCourseId, newSubjectName, filteredSubjects.length + 1);
      setNewSubjectName('');
      setShowAddSubject(false);
      setMsg({ text: 'Subject created successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to create subject', type: 'error' });
    }
  };

  const handleDeleteSubject = async (subjectId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete subject "${name}" and all its topics?`)) return;
    try {
      await deleteSubjectAction(subjectId);
      setMsg({ text: 'Subject deleted successfully.', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to delete subject', type: 'error' });
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddTopic || !topicName.trim()) return;
    try {
      const subjectTopics = getTopicsForSubject(showAddTopic);
      const nextSeq = subjectTopics.length + 1;
      await createTopicAction(showAddTopic, topicName, nextSeq, targetDate || null, topicNotes || null);
      setTopicName('');
      setTargetDate('');
      setTopicNotes('');
      setShowAddTopic(null);
      setMsg({ text: 'Topic created successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to create topic', type: 'error' });
    }
  };

  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !editingTopic.name.trim()) return;
    try {
      await updateTopicAction(
        editingTopic.id,
        editingTopic.name,
        editingTopic.seq_no,
        editingTopic.target_date,
        editingTopic.notes
      );
      setEditingTopic(null);
      setMsg({ text: 'Topic updated successfully!', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to update topic', type: 'error' });
    }
  };

  const handleDeleteTopic = async (id: string, name: string) => {
    if (!confirm(`Delete topic "${name}"?`)) return;
    try {
      await deleteTopicAction(id);
      setMsg({ text: 'Topic removed.', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to delete topic', type: 'error' });
    }
  };

  const handleMoveTopic = async (subjectId: string, topicIndex: number, direction: 'up' | 'down') => {
    const list = [...getTopicsForSubject(subjectId)];
    const targetIndex = direction === 'up' ? topicIndex - 1 : topicIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap
    const temp = list[topicIndex];
    list[topicIndex] = list[targetIndex];
    list[targetIndex] = temp;

    const orderedIds = list.map((t) => t.id);
    try {
      await reorderTopicsAction(subjectId, orderedIds);
      setMsg({ text: 'Topic order updated.', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to reorder topics', type: 'error' });
    }
  };

  const handleBulkImport = async () => {
    if (!csvText.trim()) return;
    try {
      const res = await bulkImportTopicsCsvAction(selectedCourseId, csvText);
      setShowBulkModal(false);
      setMsg({ text: `Successfully imported ${res.count} topics into curriculum!`, type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Bulk import failed', type: 'error' });
    }
  };

  const handleCloneSyllabus = async () => {
    if (cloneSourceId === selectedCourseId) {
      alert('Source and target course must be different.');
      return;
    }
    if (!confirm('This will copy all subjects and topics from the selected course into this course. Continue?')) {
      return;
    }
    try {
      const res = await copySyllabusAction(cloneSourceId, selectedCourseId);
      setShowCloneModal(false);
      setMsg({
        text: `Cloned ${res.copiedSubjects} subjects and ${res.copiedTopics} topics successfully!`,
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'Syllabus clone failed', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
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

      {/* Top Controls: Course Selector & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Curriculum for Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 mt-0.5"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddSubject(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Bulk Import CSV</span>
          </button>

          <button
            onClick={() => setShowCloneModal(true)}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span>Clone Syllabus</span>
          </button>
        </div>
      </div>

      {/* Subject & Topics Tree */}
      <div className="space-y-4">
        {filteredSubjects.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500">
            <FolderPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No subjects found for this course.</p>
            <p className="text-xs mt-1 text-slate-600">Click &quot;Add Subject&quot; or &quot;Bulk Import CSV&quot; to begin building the syllabus.</p>
          </div>
        ) : (
          filteredSubjects.map((sub) => {
            const subjectTopics = getTopicsForSubject(sub.id);
            return (
              <div
                key={sub.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm"
              >
                {/* Subject Header */}
                <div className="bg-slate-900/90 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <h3 className="text-sm font-bold text-white">{sub.name}</h3>
                    <span className="text-[11px] font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                      {subjectTopics.length} topics
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddTopic(sub.id)}
                      className="flex items-center gap-1 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-md font-semibold transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Topic</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(sub.id, sub.name)}
                      className="p-1.5 rounded-md hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Topics Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-950/60 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800/80">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">Seq</th>
                        <th className="py-2 px-4">Topic Curriculum Block</th>
                        <th className="py-2 px-3 w-32">Target Date</th>
                        <th className="py-2 px-4">Notes</th>
                        <th className="py-2 px-3 w-28 text-center">Reorder</th>
                        <th className="py-2 px-3 w-20 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-sans">
                      {subjectTopics.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-500">
                            No topics added yet. Click &quot;Add Topic&quot; above.
                          </td>
                        </tr>
                      ) : (
                        subjectTopics.map((top, idx) => (
                          <tr
                            key={top.id}
                            className="hover:bg-slate-900/50 transition-colors group text-slate-300"
                          >
                            <td className="py-2 px-3 text-center font-mono text-slate-500 text-xs">
                              {top.seq_no}
                            </td>
                            <td className="py-2 px-4 font-semibold text-slate-200">
                              {top.name}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs text-slate-400">
                              {formatISTDate(top.target_date)}
                            </td>
                            <td className="py-2 px-4 text-slate-400 text-xs truncate max-w-xs">
                              {top.notes || '-'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveTopic(sub.id, idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleMoveTopic(sub.id, idx, 'down')}
                                  disabled={idx === subjectTopics.length - 1}
                                  className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => setEditingTopic(top)}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                  title="Edit Topic"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTopic(top.id, top.name)}
                                  className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400"
                                  title="Delete Topic"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add New Subject</h3>
            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. Mathematics, English, Physics"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubject(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {showAddTopic && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add Topic to Curriculum</h3>
            <form onSubmit={handleCreateTopic} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Topic Title</label>
                <input
                  type="text"
                  required
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="e.g. Matrices & Determinants"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Target Date (IST)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Curriculum Notes (Optional)</label>
                <textarea
                  value={topicNotes}
                  onChange={(e) => setTopicNotes(e.target.value)}
                  rows={2}
                  placeholder="Specific syllabus focus or question weightage"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTopic(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Add Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {editingTopic && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Topic</h3>
            <form onSubmit={handleUpdateTopic} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Topic Title</label>
                <input
                  type="text"
                  required
                  value={editingTopic.name}
                  onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Sequence Number</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editingTopic.seq_no}
                    onChange={(e) => setEditingTopic({ ...editingTopic, seq_no: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Target Date</label>
                  <input
                    type="date"
                    value={editingTopic.target_date || ''}
                    onChange={(e) => setEditingTopic({ ...editingTopic, target_date: e.target.value || null })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Notes</label>
                <textarea
                  value={editingTopic.notes || ''}
                  onChange={(e) => setEditingTopic({ ...editingTopic, notes: e.target.value || null })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTopic(null)}
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

      {/* Bulk Import CSV Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                Bulk Import Syllabus Topics from CSV
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <p className="leading-relaxed">
                Format: <code className="bg-slate-950 px-1 py-0.5 rounded text-slate-300">Subject,Topic Name,Target Date,Notes</code>
              </p>
              <a
                href="/templates/syllabus_curriculum_template.csv"
                download="syllabus_curriculum_template.csv"
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline font-medium shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template (.csv)
              </a>
            </div>
            <textarea
              rows={8}
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
                Execute Bulk Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Syllabus Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Copy className="w-4 h-4 text-amber-400" />
              Copy Curriculum from Another Course
            </h3>
            <p className="text-xs text-slate-400">
              Duplicates all subjects, topics, and target dates from the source course into the currently selected course.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Source Course</label>
              <select
                value={cloneSourceId}
                onChange={(e) => setCloneSourceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {courses
                  .filter((c) => c.id !== selectedCourseId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloneModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloneSyllabus}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white"
              >
                Clone Curriculum Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
