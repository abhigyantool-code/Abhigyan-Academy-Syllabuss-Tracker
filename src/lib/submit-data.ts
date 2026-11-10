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
  course_id: string;
}

export async function getSubmitFormData() {
  const pb = await getPbClient();

  // 1. Courses with settings
  const [courses, settings] = await Promise.all([
    pb.collection('courses').getFullList({ filter: 'active = true', sort: 'sort_order' }),
    pb.collection('course_settings').getFullList(),
  ]);

  const settingsMap = new Map(settings.map((s) => [s.course, s]));
  const courseList: SubmitCourseData[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    sort_order: c.sort_order || 0,
    require_class_code: settingsMap.get(c.id)?.require_class_code ?? false,
  }));

  // 2 & 3. Teachers & Subjects via teacher_subjects mapping
  const teacherSubjects = await pb.collection('teacher_subjects').getFullList({
    expand: 'teacher,subject',
  });

  const teacherMap = new Map<string, SubmitTeacher>();
  const subjectMap = new Map<string, SubmitSubject>();

  for (const ts of teacherSubjects) {
    const teacher = (ts.expand as any)?.teacher;
    const subject = (ts.expand as any)?.subject;

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

  // 4. Topics
  const topics = await pb.collection('topics').getFullList({ sort: 'seq_no' });
  const topicList: SubmitTopic[] = topics.map((t) => ({
    id: t.id,
    subject_id: t.subject,
    name: t.name,
    seq_no: t.seq_no,
    target_date: t.target_date ? t.target_date.split(' ')[0] : null,
  }));

  // 5. Students via enrollments
  const enrollments = await pb.collection('enrollments').getFullList({
    expand: 'student',
  });

  const studentList: SubmitStudent[] = [];
  for (const en of enrollments) {
    const student = (en.expand as any)?.student;
    if (student && student.active) {
      studentList.push({
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        course_id: en.course,
      });
    }
  }

  studentList.sort((a, b) => a.roll_no.localeCompare(b.roll_no));

  return {
    courses: courseList,
    teachers: Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    subjects: Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    topics: topicList,
    students: studentList,
  };
}
