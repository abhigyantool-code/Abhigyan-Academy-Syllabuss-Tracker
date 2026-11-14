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
  Lock,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react';
import { changeStudentPinAction, verifyStudentLookupAction } from '@/app/actions/auth-actions';

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
  const [studentRollNo, setStudentRollNo] = useState<string>('');
  const [verifiedStudent, setVerifiedStudent] = useState<{ id: string; name: string; roll_no: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [studentPin, setStudentPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [classCode, setClassCode] = useState<string>('');
  const [status, setStatus] = useState<'covered' | 'partial' | 'revision'>('covered');
  const [remarks, setRemarks] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>('');

  // Searchable student combobox state (kept for backwards compatibility if needed)
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

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changePinCurrentPin, setChangePinCurrentPin] = useState('');
  const [changePinNewPin, setChangePinNewPin] = useState('');
  const [changePinConfirm, setChangePinConfirm] = useState('');
  const [changePinMsg, setChangePinMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [changePinBusy, setChangePinBusy] = useState(false);

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

  // Helper to extract clean serial number display (e.g. "NDA-01" -> "#1")
  const getSerialDisplay = (rollNo: string) => {
    const match = rollNo.match(/-(\d+)$/);
    return match ? `#${parseInt(match[1], 10)}` : rollNo;
  };

  // Filtered students for searchable combobox (search by Serial No or Name)
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return enrolledStudents;
    return enrolledStudents.filter((s) => {
      const match = s.roll_no.match(/-(\d+)$/);
      const serialNum = match ? parseInt(match[1], 10).toString() : '';
      const rollLower = s.roll_no.toLowerCase();
      const nameLower = s.name.toLowerCase();
      return (
        nameLower.includes(q) ||
        rollLower.includes(q) ||
        serialNum === q ||
        (match && match[1].startsWith(q))
      );
    });
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
    setStudentRollNo('');
    setVerifiedStudent(null);
    setVerifyMessage(null);
    setStudentPin('');
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

  const handleVerifyStudent = async () => {
    if (!studentRollNo.trim()) {
      setVerifyMessage('Please enter your roll number first.');
      return;
    }
    if (!studentPin.trim() || studentPin.trim().length < 4) {
      setVerifyMessage('Please enter your 4-digit PIN first.');
      return;
    }
    setIsVerifying(true);
    setVerifyMessage(null);
    try {
      const res = await verifyStudentLookupAction(selectedCourseId, studentRollNo.trim(), studentPin.trim());
      if (res.success && res.student) {
        setVerifiedStudent(res.student);
        setSelectedStudentId(res.student.id);
        setVerifyMessage(null);
      } else {
        setVerifyMessage(res.error || 'Verification failed. Please check your Roll Number and PIN.');
      }
    } catch (err: any) {
      setVerifyMessage(err.message || 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
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
    const effectiveStudent = verifiedStudent?.id || selectedStudentId || studentRollNo.trim().toUpperCase();
    if (!effectiveStudent) {
      setErrorMessage('Please enter your student Roll Number.');
      return;
    }
    if (!studentPin.trim() || studentPin.trim().length < 4) {
      setErrorMessage('Please enter your 4–8 digit Student PIN.');
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
        studentId: effectiveStudent,
        pin: studentPin.trim(),
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

  // Handle student PIN change
  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinMsg(null);

    const studentIdentifier = verifiedStudent?.id || selectedStudentId || studentRollNo.trim().toUpperCase();
    if (!studentIdentifier) {
      setChangePinMsg({ text: 'Please enter your student Roll Number first (Step 4).', type: 'error' });
      return;
    }
    if (!/^\d{4,8}$/.test(changePinNewPin)) {
      setChangePinMsg({ text: 'New PIN must be 4–8 numeric digits.', type: 'error' });
      return;
    }
    if (changePinNewPin !== changePinConfirm) {
      setChangePinMsg({ text: 'New PIN and Confirm PIN do not match.', type: 'error' });
      return;
    }

    setChangePinBusy(true);
    try {
      const res = await changeStudentPinAction(studentIdentifier, changePinCurrentPin, changePinNewPin);
      if (res && !res.success) {
        setChangePinMsg({ text: res.error || 'PIN change failed.', type: 'error' });
        return;
      }
      setChangePinMsg({ text: 'PIN changed successfully! Use your new PIN for future logins.', type: 'success' });
      setChangePinCurrentPin('');
      setChangePinNewPin('');
      setChangePinConfirm('');
      setStudentPin(changePinNewPin);
    } catch (err: any) {
      setChangePinMsg({ text: err.message || 'PIN change failed.', type: 'error' });
    } finally {
      setChangePinBusy(false);
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
            setStudentPin('');
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

          {/* 4. Student Roll Number (PII Protected - BUG-003) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                  4
                </span>
                Student Roll Number
              </span>
              <span className="text-[11px] font-normal text-zinc-500">e.g. NDA-01, CDS-05</span>
            </label>

            {verifiedStudent ? (
              <div className="flex items-center justify-between bg-zinc-950 border border-emerald-500/50 rounded-xl px-3.5 py-2 text-xs">
                <div>
                  <span className="font-bold text-white block">{verifiedStudent.name}</span>
                  <span className="font-mono text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px]">
                      Verified
                    </span>
                    <span className="text-zinc-400">({verifiedStudent.roll_no})</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVerifiedStudent(null);
                    setSelectedStudentId('');
                    setStudentRollNo('');
                  }}
                  className="text-xs text-zinc-400 hover:text-white bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <User className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Enter your Roll Number (e.g. NDA-01, CDS-05)..."
                  value={studentRollNo}
                  onChange={(e) => {
                    setStudentRollNo(e.target.value.toUpperCase());
                    setVerifiedStudent(null);
                    setVerifyMessage(null);
                  }}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                />
              </div>
            )}
            {verifyMessage && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {verifyMessage}
              </p>
            )}
          </div>

          {/* 5. Student Authentication PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                  5
                </span>
                Student PIN
              </span>
              <span className="text-[11px] font-normal text-zinc-400 font-mono">
                4–8 Digits
              </span>
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                placeholder="Enter your PIN"
                value={studentPin}
                onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white tracking-widest placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Protects your student serial number from proxy submissions by others.
            </p>
            {/* Verify name & Change PIN links */}
            {(selectedStudentId || studentRollNo.trim()) && (
              <div className="flex items-center gap-3 mt-1">
                {!verifiedStudent && studentRollNo.trim() && studentPin.length >= 4 && (
                  <button
                    type="button"
                    onClick={handleVerifyStudent}
                    disabled={isVerifying}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                  >
                    {isVerifying ? 'Checking roll number...' : '✓ Verify my name'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setShowChangePinModal(true); setChangePinMsg(null); }}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Change My PIN
                </button>
              </div>
            )}
          </div>

          {/* 6. Class Code (displayed only when require_class_code is true) */}
          {currentCourse?.require_class_code && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-mono font-black">
                    6
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

          {/* Status Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px] font-mono font-black">
                {currentCourse?.require_class_code ? '7' : '6'}
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

      {/* Change PIN Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              Change My PIN
            </h3>
            {selectedStudentObj && (
              <p className="text-xs text-zinc-400">
                Changing PIN for <strong className="text-zinc-200">{selectedStudentObj.name}</strong> ({selectedStudentObj.roll_no}).
              </p>
            )}
            {changePinMsg && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
                  changePinMsg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                }`}
              >
                <span>{changePinMsg.text}</span>
                <button onClick={() => setChangePinMsg(null)} className="text-zinc-400 hover:text-white">&times;</button>
              </div>
            )}
            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  value={changePinCurrentPin}
                  onChange={(e) => setChangePinCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter current PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">New PIN (4–8 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  value={changePinNewPin}
                  onChange={(e) => setChangePinNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter new PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  value={changePinConfirm}
                  onChange={(e) => setChangePinConfirm(e.target.value.replace(/\D/g, ''))}
                  placeholder="Confirm new PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowChangePinModal(false); setChangePinMsg(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={changePinBusy}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {changePinBusy ? 'Saving…' : 'Save New PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
