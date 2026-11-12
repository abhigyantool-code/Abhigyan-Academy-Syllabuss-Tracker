import { z } from 'zod';
import { getPbClient } from './pb';

const idRegex = /^[a-z0-9]{15}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const submitEntrySchema = z.object({
  courseId: z.string().regex(idRegex, 'Invalid course selected'),
  teacherId: z.string().regex(idRegex, 'Please select a faculty member'),
  subjectId: z.string().regex(idRegex, 'Please select a subject'),
  topicId: z.string().regex(idRegex, 'Please select a curriculum topic'),
  studentId: z.string().min(1, 'Please enter your student Roll Number or select your profile'),
  pin: z
    .string()
    .min(4, 'Student PIN must be at least 4 digits')
    .max(8, 'Student PIN cannot exceed 8 digits'),
  classCode: z.string().optional().default(''),
  status: z.enum(['covered', 'partial', 'revision']),
  remarks: z
    .string()
    .max(300, 'Remarks cannot exceed 300 characters')
    .optional()
    .nullable(),
  deviceId: z.string().min(1, 'Device identifier is required'),
  websiteUrlHp: z.string().optional().default(''), // Honeypot trap
});

export type SubmitEntryInput = z.infer<typeof submitEntrySchema>;

export interface MisuseAnalysisResult {
  flags: string[];
  reviewStatus: 'auto' | 'pending';
}

/**
 * Evaluates entry for suspicious activity using PocketBase:
 * - Sequence jump (> 3 topics ahead of lowest uncovered topic)
 * - Rapid submission burst (multiple entries in seconds)
 * - Device submitting for multiple distinct students within 24 hours
 */
export async function analyzeMisuseFlags(params: {
  courseId: string;
  subjectId: string;
  topicId: string;
  studentId: string;
  deviceId: string;
}): Promise<MisuseAnalysisResult> {
  const flags: string[] = [];
  const { subjectId, topicId, studentId, deviceId } = params;

  try {
    const pb = await getPbClient();

    // 1. Sequence Jump Check (BUG-014: Include auto-approved entries and teaching records)
    const coveredEntriesPromise = pb.collection('entries').getFullList({
      filter: `subject = "${subjectId}" && (status = "covered" || status = "revision") && (review_status = "approved" || review_status = "auto")`,
      fields: 'topic',
    });

    const teachingRecordsPromise = pb
      .collection('teaching_records')
      .getFullList({
        filter: `subject = "${subjectId}" && is_voided = false`,
        fields: 'topic',
      })
      .catch(() => [] as any[]);

    const [currentTopic, allSubjectTopics, coveredEntries, teachingRecords] = await Promise.all([
      pb.collection('topics').getOne(topicId),
      pb.collection('topics').getFullList({ filter: `subject = "${subjectId}"`, sort: 'seq_no' }),
      coveredEntriesPromise,
      teachingRecordsPromise,
    ]);

    const coveredTopicIds = new Set([
      ...coveredEntries.map((e: any) => e.topic),
      ...teachingRecords.map((t: any) => t.topic),
    ]);

    const lowestUncoveredTopic = allSubjectTopics.find((t) => !coveredTopicIds.has(t.id));
    const lowestUncoveredSeq = lowestUncoveredTopic ? lowestUncoveredTopic.seq_no : 1;
    const currentSeq = currentTopic.seq_no || 1;

    if (currentSeq - lowestUncoveredSeq > 3) {
      flags.push('FLAG_SEQUENCE_JUMP');
    }

    // 2. Rapid Burst Check (Same student or device within past 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString().replace('T', ' ');
    const burstEntries = await pb.collection('entries').getList(1, 10, {
      filter: `(student = "${studentId}" || device_id = "${deviceId}") && created >= "${thirtySecondsAgo}"`,
    });

    if (burstEntries.totalItems >= 2) {
      flags.push('FLAG_BURST_RATE');
    }

    // 3. Multi-Student Device Reuse (Same device logged for > 2 different students in 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');
    const deviceEntries = await pb.collection('entries').getFullList({
      filter: `device_id = "${deviceId}" && student != "${studentId}" && created >= "${twentyFourHoursAgo}"`,
      fields: 'student',
    });

    const distinctStudents = new Set(deviceEntries.map((e) => e.student));
    if (distinctStudents.size >= 2) {
      flags.push('FLAG_MULTI_STUDENT_DEVICE');
    }
  } catch (error) {
    console.error('Error analyzing misuse flags in PocketBase:', error);
  }

  return {
    flags,
    reviewStatus: flags.length > 0 ? 'pending' : 'auto',
  };
}
