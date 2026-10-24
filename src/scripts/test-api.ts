import { query } from '../lib/db';
import { getTodayIST } from '../lib/date-utils';

async function testSubmitAPI() {
  console.log('--- Starting /api/submit Automated Test Suite ---');
  const today = getTodayIST();
  console.log(`IST Class Date: ${today}`);

  // Fetch NDA course info
  const course = (await query("SELECT id, code FROM courses WHERE code='NDA'")).rows[0];
  const teacher = (await query("SELECT id, name FROM teachers WHERE name LIKE '%Sharma%'")).rows[0];
  const subject = (await query("SELECT id, name FROM subjects WHERE course_id = $1 AND name = 'Mathematics'", [course.id])).rows[0];
  const topic = (await query("SELECT id, name, seq_no FROM topics WHERE subject_id = $1 AND seq_no = 4", [subject.id])).rows[0]; // Trigonometry
  const student = (await query("SELECT id, name, roll_no FROM students WHERE roll_no = 'ABG-2026-004'")).rows[0]; // Siddharth Nair
  const classCode = (await query("SELECT code FROM class_codes WHERE course_id = $1 AND class_date = $2", [course.id, today])).rows[0]?.code;

  console.log('Test Parameters:', {
    course: course.code,
    teacher: teacher.name,
    subject: subject.name,
    topic: topic.name,
    student: student.roll_no,
    classCode,
  });

  // Test 1: Invalid Class Code
  const res1 = await fetch('http://localhost:3000/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: course.id,
      teacherId: teacher.id,
      subjectId: subject.id,
      topicId: topic.id,
      studentId: student.id,
      classCode: 'WRONG-CODE',
      status: 'covered',
      deviceId: 'test-device-1',
    }),
  });
  const json1 = await res1.json();
  console.log(`Test 1 (Wrong Code): Status ${res1.status} -`, json1);
  if (res1.status !== 400) throw new Error('Expected 400 for wrong code');

  // Test 2: Valid Submission
  const res2 = await fetch('http://localhost:3000/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: course.id,
      teacherId: teacher.id,
      subjectId: subject.id,
      topicId: topic.id,
      studentId: student.id,
      classCode: classCode,
      status: 'covered',
      remarks: 'Covered full trigonometry formulas',
      deviceId: 'test-device-1',
    }),
  });
  const json2 = await res2.json();
  console.log(`Test 2 (Valid Submission): Status ${res2.status} -`, json2);
  if (res2.status !== 200) throw new Error('Expected 200 for valid submission');

  // Test 3: Duplicate Submission Rejection
  const res3 = await fetch('http://localhost:3000/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: course.id,
      teacherId: teacher.id,
      subjectId: subject.id,
      topicId: topic.id,
      studentId: student.id,
      classCode: classCode,
      status: 'covered',
      deviceId: 'test-device-1',
    }),
  });
  const json3 = await res3.json();
  console.log(`Test 3 (Duplicate Rejection): Status ${res3.status} -`, json3);
  if (res3.status !== 409) throw new Error('Expected 409 for duplicate submission');

  // Test 4: Honeypot Protection
  const res4 = await fetch('http://localhost:3000/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: course.id,
      teacherId: teacher.id,
      subjectId: subject.id,
      topicId: topic.id,
      studentId: student.id,
      classCode: classCode,
      status: 'covered',
      deviceId: 'bot-device',
      websiteUrlHp: 'http://spam-bot.xyz',
    }),
  });
  const json4 = await res4.json();
  console.log(`Test 4 (Honeypot Trap): Status ${res4.status} -`, json4);
  if (res4.status !== 200) throw new Error('Expected 200 for honeypot trap');

  console.log('✓ All /api/submit test scenarios passed successfully!');
  process.exit(0);
}

testSubmitAPI().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
