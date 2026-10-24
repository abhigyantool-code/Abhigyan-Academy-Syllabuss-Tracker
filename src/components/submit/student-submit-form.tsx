'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  SubmitCourseData,
  SubmitTeacher,
  SubmitSubject,
  SubmitTopic,
  SubmitStudent,
} from '@/lib/submit-data';
import {
  GraduationCap,
  BookOpen,
  User,
  KeyRound,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Send,
  Layers,
  ShieldAlert,
} from 'lucide-react';

interface StudentSubmitFormProps {
  initialData: {
    courses: SubmitCourseData[];
    teachers: SubmitTeacher[];
    subjects: SubmitSubject[];
    topics: SubmitTopic[];
    students: SubmitStudent[];
  };
}

export function StudentSubmitForm({ initialData }: StudentSubmitFormProps) {
  const { courses, teachers, subjects, topics, students } = initialData;

  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [classCode, setClassCode] = useState<string>('');
  const [status, setStatus] = useState<'covered' | 'partial' | 'revision'>('covered');
  const [remarks, setRemarks] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>('');

  // Searchable student combobox state
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  // Device ID state
  const [deviceId, setDeviceId] = useState<string>('');

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    referenceId: string;
    topicName: string;
    classDate: string;
    status: string;
    reviewStatus: string;
    message: string;
  } | null>(null);

  // Initialize or read device_id cookie on mount
  useEffect(() => {
    function getCookie(name: string) {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    }

    let id = getCookie('abhigyan_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
      document.cookie = `abhigyan_device_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
    }
    setDeviceId(id);
  }, []);

  const currentCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || courses[0];
  }, [courses, selectedCourseId]);

  // 1. Cascading Teachers (teachers who teach subjects in this course)
  const availableTeachers = useMemo(() => {
    return teachers.filter((t) => t.course_id === selectedCourseId);
  }, [teachers, selectedCourseId]);

  // 2. Cascading Subjects (subjects taught by selected teacher in this course)
  const availableSubjects = useMemo(() => {
    if (!selectedTeacherId) return [];
    return subjects.filter(
      (s) => s.course_id === selectedCourseId && s.teacher_id === selectedTeacherId
    );
  }, [subjects, selectedCourseId, selectedTeacherId]);

  // 3. Cascading Topics (topics belonging to chosen subject)
  const availableTopics = useMemo(() => {
    if (!selectedSubjectId) return [];
    return topics
      .filter((t) => t.subject_id === selectedSubjectId)
      .sort((a, b) => a.seq_no - b.seq_no);
  }, [topics, selectedSubjectId]);

  // 4. Enrolled Students in this course
  const enrolledStudents = useMemo(() => {
    return students.filter((s) => s.course_id === selectedCourseId);
  }, [students, selectedCourseId]);

  // Filtered students for searchable combobox
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return enrolledStudents;
    const q = studentSearch.toLowerCase();
    return enrolledStudents.filter(
      (s) => s.roll_no.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [enrolledStudents, studentSearch]);

  const selectedStudentObj = useMemo(() => {
    return enrolledStudents.find((s) => s.id === selectedStudentId);
  }, [enrolledStudents, selectedStudentId]);

  // Reset dependent fields when course changes
  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedTeacherId('');
    setSelectedSubjectId('');
    setSelectedTopicId('');
    setSelectedStudentId('');
    setStudentSearch('');
    setClassCode('');
    setErrorMessage(null);
    setSuccessData(null);
  };

  // Reset subject & topic when teacher changes
  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setSelectedSubjectId('');
    setSelectedTopicId('');
    setErrorMessage(null);
  };

  // Reset topic when subject changes
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedTopicId('');
    setErrorMessage(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic client checks
    if (!selectedTeacherId) {
      setErrorMessage('Please select the teacher who conducted the class.');
      return;
    }
    if (!selectedSubjectId) {
      setErrorMessage('Please select the subject taught.');
      return;
    }
    if (!selectedTopicId) {
      setErrorMessage('Please select the specific syllabus topic covered.');
      return;
    }
    if (!selectedStudentId) {
      setErrorMessage('Please select your student profile / roll number.');
      return;
    }
    if (currentCourse?.require_class_code && !classCode.trim()) {
      setErrorMessage('Please enter the active class code shown on the classroom board.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        courseId: selectedCourseId,
        teacherId: selectedTeacherId,
        subjectId: selectedSubjectId,
        topicId: selectedTopicId,
        studentId: selectedStudentId,
        classCode: classCode.trim().toUpperCase(),
        status,
        remarks: remarks || null,
        deviceId: deviceId || 'anonymous_mobile_device',
        websiteUrlHp: honeypot, // Honeypot trap
      };

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Submission could not be completed.');
      }

      setSuccessData(json);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view with "Submit Another" flow
  if (successData) {
    return (
      <div className="w-full max-w-lg mx-auto bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div>
          <span className="text-[11px] font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold tracking-wider inline-block">
            {successData.reviewStatus === 'pending' ? 'Queued for Review' : 'Verified & Recorded'}
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-3">
            Class Logged Successfully
          </h2>
          <p className="text-xs text-zinc-400 mt-1">{successData.message}</p>
        </div>

        {/* Reference Ticket Card */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 text-left space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-500 uppercase text-[10px] tracking-wider">Reference ID</span>
            <span className="font-bold text-amber-400 text-sm select-all">
              {successData.referenceId}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-500 uppercase text-[10px]">Topic Covered</span>
            <span className="text-zinc-200 font-sans font-semibold text-right max-w-[200px] truncate">
              {successData.topicName}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-500 uppercase text-[10px]">Logged Status</span>
            <span className="text-emerald-400 font-bold uppercase">{successData.status}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-500 uppercase text-[10px]">Class Date (IST)</span>
            <span className="text-zinc-400">{successData.classDate}</span>
          </div>
        </div>

        <button
          onClick={() => {
            setSuccessData(null);
            setSelectedTopicId('');
            setRemarks('');
            setClassCode('');
          }}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm py-3 px-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-98"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Log Another Class</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* 1. Course Tabs Ribbon */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto shadow-lg">
        {courses.map((c) => {
          const isSelected = c.id === selectedCourseId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleCourseChange(c.id)}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
                isSelected
                  ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <span>{c.code}</span>
            </button>
          );
        })}
      </div>

      {/* Main Student Form Card */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              {currentCourse?.name}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">Mobile Entry</span>
          </div>
          <h2 className="text-lg font-black text-white tracking-tight mt-1.5">
            Log Today&apos;s Class Topic
          </h2>
          <p className="text-xs text-zinc-400">
            Submit what was covered in class to confirm syllabus progress.
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot field (hidden from real users) */}
          <div className="hidden" aria-hidden="true">
            <input
              type="text"
              name="website_url_hp"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* 1. Teacher Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                  1
                </span>
                Teacher / Faculty
              </span>
              <span className="text-[11px] font-normal text-zinc-500">Conducting class</span>
            </label>
            <div className="relative">
              <select
                required
                value={selectedTeacherId}
                onChange={(e) => handleTeacherChange(e.target.value)}
                className="w-full appearance-none bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium pr-10"
              >
                <option value="">-- Choose Faculty Member --</option>
                {availableTeachers.map((tea) => (
                  <option key={tea.id} value={tea.id}>
                    {tea.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. Subject Selector (cascaded from teacher) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                  2
                </span>
                Subject
              </span>
              <span className="text-[11px] font-normal text-zinc-500">Filtered by teacher</span>
            </label>
            <div className="relative">
              <select
                required
                disabled={!selectedTeacherId}
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full appearance-none bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium pr-10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">
                  {selectedTeacherId ? '-- Choose Subject --' : '-- Select teacher first --'}
                </option>
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 3. Topic Selector (cascaded from subject) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                  3
                </span>
                Curriculum Topic
              </span>
              <span className="text-[11px] font-normal text-zinc-500">Sequence & Title</span>
            </label>
            <div className="relative">
              <select
                required
                disabled={!selectedSubjectId}
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full appearance-none bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium pr-10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">
                  {selectedSubjectId ? '-- Choose Topic Covered --' : '-- Select subject first --'}
                </option>
                {availableTopics.map((top) => (
                  <option key={top.id} value={top.id}>
                    #{top.seq_no} &bull; {top.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 4. Searchable Student Dropdown (no free text) */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                  4
                </span>
                Your Student ID / Roll No
              </span>
              <span className="text-[11px] font-normal text-zinc-500">Enrolled students only</span>
            </label>

            {/* Selected Student Display or Search input */}
            {selectedStudentObj ? (
              <div className="flex items-center justify-between bg-zinc-950 border border-indigo-500/50 rounded-xl px-3.5 py-2 text-xs">
                <div>
                  <span className="font-bold text-white block">{selectedStudentObj.name}</span>
                  <span className="font-mono text-[11px] text-indigo-400 font-semibold">
                    {selectedStudentObj.roll_no}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentId('');
                    setStudentSearch('');
                    setIsStudentDropdownOpen(true);
                  }}
                  className="text-xs text-zinc-400 hover:text-white bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Type roll number (e.g. ABG-001) or name..."
                  value={studentSearch}
                  onFocus={() => setIsStudentDropdownOpen(true)}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setIsStudentDropdownOpen(true);
                  }}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans"
                />

                {/* Dropdown list */}
                {isStudentDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-h-52 overflow-y-auto p-1 divide-y divide-zinc-900">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-center text-xs text-zinc-500">
                        No enrolled student found matching &quot;{studentSearch}&quot;
                      </div>
                    ) : (
                      filteredStudents.map((stu) => (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(stu.id);
                            setIsStudentDropdownOpen(false);
                            setStudentSearch('');
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-zinc-900 transition-colors flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-zinc-200">{stu.name}</span>
                          <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                            {stu.roll_no}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Class Code (displayed only when require_class_code is true) */}
          {currentCourse?.require_class_code && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-mono font-black">
                    5
                  </span>
                  Class Code
                </span>
                <span className="text-[11px] font-normal text-amber-400/90 font-mono">
                  From blackboard
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. NDA-942"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-black text-amber-400 tracking-wider placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 uppercase"
                />
                <KeyRound className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* 6. Status Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                6
              </span>
              Class Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'covered',
                  label: 'Covered',
                  sub: 'Topic fully completed',
                  color: 'hover:border-emerald-500/50 text-emerald-400',
                  activeColor: 'bg-emerald-500/15 border-emerald-500 text-emerald-300',
                },
                {
                  id: 'partial',
                  label: 'Partial',
                  sub: 'Remaining in next class',
                  color: 'hover:border-blue-500/50 text-blue-400',
                  activeColor: 'bg-blue-500/15 border-blue-500 text-blue-300',
                },
                {
                  id: 'revision',
                  label: 'Revision',
                  sub: 'Past topic recap only',
                  color: 'hover:border-zinc-500 text-zinc-400',
                  activeColor: 'bg-zinc-800 border-zinc-600 text-zinc-200',
                },
              ].map((opt) => {
                const isSelected = status === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? opt.activeColor + ' shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-xs font-bold block">{opt.label}</span>
                    <span className="text-[10px] text-zinc-500 block leading-tight mt-0.5">
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Remarks (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 flex items-center justify-between">
              <span>Remarks (Optional)</span>
              <span className="text-[10px] text-zinc-500 font-mono">{remarks.length}/300</span>
            </label>
            <textarea
              rows={2}
              maxLength={300}
              placeholder="e.g. Completed questions 1 to 15 from exercise 2B..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm py-3 px-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/25 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying & Recording...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Confirm Topic Covered</span>
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-[11px] text-zinc-500 font-mono">
        Anti-misuse duplicate protection enabled &bull; Class date automatically stamped in IST
      </p>
    </div>
  );
}
