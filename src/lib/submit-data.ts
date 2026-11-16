import { getPbClient } from './pb';

export interface SubmitCourseData {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  require_class_code: boolean;
}

export interface SubmitTeacher {
  id: string;
  name: string;
  course_id: string;
}

export interface SubmitSubject {
  id: string;
  name: string;
  course_id: string;
  teacher_id: string;
}

export interface SubmitTopic {
  id: string;
  subject_id: string;
  name: string;
  seq_no: number;
  target_date: string | null;
}

export interface SubmitStudent {
  id: string;
  roll_no: string;
  name: string;
  course_id?: string;
  courseIds: string[];
}

export interface SubmitStudentSession {
  id: string;
  name: string;
  rollNo: string;
  courseId?: string;
  courseIds?: string[];
}

export interface SubmitFormDataResult {
  courses: SubmitCourseData[];
  teachers: SubmitTeacher[];
  subjects: SubmitSubject[];
  topics: SubmitTopic[];
  students: SubmitStudent[];
}

export function sanitizeStudentsForSubmit(
  rawStudents: Array<Record<string, unknown>>,
  rawEnrollments: Array<Record<string, unknown>>
): SubmitStudent[] {
  const enrollmentMap = new Map<string, Set<string>>();
  for (const en of rawEnrollments) {
    const stuId = typeof en?.student === 'string' ? en.student : '';
    const courseId = typeof en?.course === 'string' ? en.course : '';
    if (stuId && courseId) {
      if (!enrollmentMap.has(stuId)) {
        enrollmentMap.set(stuId, new Set());
      }
      enrollmentMap.get(stuId)!.add(courseId);
    }
  }

  return rawStudents
    .filter((s) => s && Boolean(s.active))
    .map((s) => {
      const id = String(s.id);
      const courseIds = Array.from(enrollmentMap.get(id) || []);
      return {
        id,
        name: String(s.name),
        roll_no: String(s.roll_no),
        course_id: courseIds[0] || '',
        courseIds,
      };
    })
    .sort((a, b) =>
      a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true, sensitivity: 'base' })
    );
}

export function getSessionEnrolledCourseIds(
  students: SubmitStudent[],
  session?: SubmitStudentSession | null
): string[] {
  if (!session) return [];
  const matchedStu = students.find(
    (s) =>
      s.id === session.id ||
      (Boolean(session.rollNo) && s.roll_no.toUpperCase() === session.rollNo.toUpperCase())
  );
  const set = new Set<string>();
  if (Array.isArray(session.courseIds)) {
    for (const cid of session.courseIds) {
      if (cid) set.add(cid);
    }
  }
  if (session.courseId) {
    set.add(session.courseId);
  }
  if (matchedStu) {
    if (Array.isArray(matchedStu.courseIds)) {
      for (const cid of matchedStu.courseIds) {
        if (cid) set.add(cid);
      }
    }
    if (matchedStu.course_id) {
      set.add(matchedStu.course_id);
    }
  }
  return Array.from(set);
}

export function filterStudentsForCourse(
  students: SubmitStudent[],
  courseId: string,
  activeStudentSession?: SubmitStudentSession | null
): SubmitStudent[] {
  const filtered = students.filter((s) => {
    if (Array.isArray(s.courseIds)) {
      return s.courseIds.includes(courseId);
    }
    return s.course_id === courseId;
  });

  if (activeStudentSession) {
    const sessionCourseIds = getSessionEnrolledCourseIds(students, activeStudentSession);
    if (
      sessionCourseIds.includes(courseId) &&
      !filtered.some((s) => s.id === activeStudentSession.id)
    ) {
      filtered.unshift({
        id: activeStudentSession.id,
        name: activeStudentSession.name,
        roll_no: activeStudentSession.rollNo,
        course_id: courseId,
        courseIds: sessionCourseIds,
      });
    }
  }

  return filtered;
}

export function resolveCourseStudentSelection(
  courses: SubmitCourseData[],
  students: SubmitStudent[],
  activeStudentSession?: SubmitStudentSession | null,
  targetCourseId?: string,
  currentSelectedStudentId?: string
): {
  courseId: string;
  selectedStudentId: string;
  studentRollNo: string;
  verifiedStudent: { id: string; name: string; roll_no: string } | null;
} {
  const sessionCourseIds = getSessionEnrolledCourseIds(students, activeStudentSession);
  const courseId =
    targetCourseId ||
    sessionCourseIds.find((cid) => courses.some((c) => c.id === cid)) ||
    courses[0]?.id ||
    '';

  const enrolledInCourse = filterStudentsForCourse(students, courseId, activeStudentSession);

  // 1. Check if activeStudentSession is enrolled in courseId
  if (activeStudentSession && sessionCourseIds.includes(courseId)) {
    const matched = enrolledInCourse.find(
      (s) =>
        s.id === activeStudentSession.id ||
        (Boolean(activeStudentSession.rollNo) &&
          s.roll_no.toUpperCase() === activeStudentSession.rollNo.toUpperCase())
    );
    const id = matched?.id || activeStudentSession.id;
    const name = matched?.name || activeStudentSession.name;
    const rollNo = matched?.roll_no || activeStudentSession.rollNo;
    return {
      courseId,
      selectedStudentId: id,
      studentRollNo: rollNo,
      verifiedStudent: { id, name, roll_no: rollNo },
    };
  }

  // 2. If a student was manually selected and is also enrolled in the target course, preserve selection
  if (currentSelectedStudentId) {
    const matchedCurrent = enrolledInCourse.find((s) => s.id === currentSelectedStudentId);
    if (matchedCurrent) {
      return {
        courseId,
        selectedStudentId: matchedCurrent.id,
        studentRollNo: matchedCurrent.roll_no,
        verifiedStudent: {
          id: matchedCurrent.id,
          name: matchedCurrent.name,
          roll_no: matchedCurrent.roll_no,
        },
      };
    }
  }

  return {
    courseId,
    selectedStudentId: '',
    studentRollNo: '',
    verifiedStudent: null,
  };
}

let cachedSubmitData: { data: SubmitFormDataResult; expiry: number } | null = null;

export function invalidateSubmitFormDataCache() {
  cachedSubmitData = null;
}

export async function getSubmitFormData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSubmitData && cachedSubmitData.expiry > now) {
    return cachedSubmitData.data;
  }

  const pb = await getPbClient();

  // Fetch curriculum and active student roster (strictly non-sensitive fields only: id, roll_no, name, active)
  const [courses, settings, teacherSubjects, topics, rawStudents, rawEnrollments] = await Promise.all([
    pb.collection('courses').getFullList({ filter: 'active = true', sort: 'sort_order' }),
    pb.collection('course_settings').getFullList(),
    pb.collection('teacher_subjects').getFullList({ expand: 'teacher,subject' }),
    pb.collection('topics').getFullList({ sort: 'seq_no' }),
    pb.collection('students').getFullList({
      filter: 'active = true',
      sort: 'roll_no',
      fields: 'id,roll_no,name,active',
    }),
    pb.collection('enrollments').getFullList({ fields: 'student,course' }),
  ]);

  const settingsMap = new Map(settings.map((s) => [s.course, s]));
  const courseList: SubmitCourseData[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    sort_order: c.sort_order || 0,
    require_class_code: settingsMap.get(c.id)?.require_class_code ?? false,
  }));

  const teacherMap = new Map<string, SubmitTeacher>();
  const subjectMap = new Map<string, SubmitSubject>();

  for (const ts of teacherSubjects) {
    const expand = ts.expand as
      | {
          teacher?: { id: string; name: string; active?: boolean };
          subject?: { id: string; name: string; course: string };
        }
      | undefined;
    const teacher = expand?.teacher;
    const subject = expand?.subject;

    if (teacher && subject && teacher.active) {
      const teacherKey = `${teacher.id}_${subject.course}`;
      if (!teacherMap.has(teacherKey)) {
        teacherMap.set(teacherKey, {
          id: teacher.id,
          name: teacher.name,
          course_id: subject.course,
        });
      }

      const subjectKey = `${subject.id}_${teacher.id}`;
      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, {
          id: subject.id,
          name: subject.name,
          course_id: subject.course,
          teacher_id: teacher.id,
        });
      }
    }
  }

  const topicList: SubmitTopic[] = topics.map((t) => ({
    id: t.id,
    subject_id: t.subject,
    name: t.name,
    seq_no: t.seq_no,
    target_date: t.target_date ? t.target_date.split(' ')[0] : null,
  }));

  const studentList = sanitizeStudentsForSubmit(rawStudents, rawEnrollments);

  const result = {
    courses: courseList,
    teachers: Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    subjects: Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    topics: topicList,
    students: studentList,
  };

  cachedSubmitData = { data: result, expiry: now + 3_000 };
  return result;
}
