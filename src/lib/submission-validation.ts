import { z } from 'zod';
import { query } from './db';

export const submitEntrySchema = z.object({
  courseId: z.string().uuid('Invalid course selected'),
  teacherId: z.string().uuid('Please select a faculty member'),
  subjectId: z.string().uuid('Please select a subject'),
  topicId: z.string().uuid('Please select a curriculum topic'),
  studentId: z.string().uuid('Please select your roll number / name'),
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
 * Evaluates entry for suspicious activity:
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
    // 1. Sequence Jump Check
    const [currentTopicRes, uncoveredRes] = await Promise.all([
      query(`SELECT seq_no FROM topics WHERE id = $1`, [topicId]),
      query(
        `SELECT MIN(t.seq_no) as lowest_uncovered_seq
         FROM topics t
         LEFT JOIN topic_progress tp ON tp.topic_id = t.id
         WHERE t.subject_id = $1 AND COALESCE(tp.status, 'not_started') NOT IN ('covered')`,
        [subjectId]
      ),
    ]);

    const currentSeq = Number(currentTopicRes.rows[0]?.seq_no || 1);
    const lowestUncovered = Number(uncoveredRes.rows[0]?.lowest_uncovered_seq || 1);

    if (currentSeq - lowestUncovered > 3) {
      flags.push('FLAG_SEQUENCE_JUMP');
    }

    // 2. Rapid Burst Check (Same student or device within past 30 seconds)
    const burstRes = await query(
      `SELECT COUNT(*) as count 
       FROM entries 
       WHERE (student_id = $1 OR device_id = $2) 
         AND created_at >= now() - interval '30 seconds'`,
      [studentId, deviceId]
    );

    if (Number(burstRes.rows[0]?.count || 0) >= 2) {
      flags.push('FLAG_BURST_RATE');
    }

    // 3. Multi-Student Device Reuse (Same device logged for > 2 different students in 24 hours)
    const multiStudentRes = await query(
      `SELECT COUNT(DISTINCT student_id) as count 
       FROM entries 
       WHERE device_id = $1 
         AND created_at >= now() - interval '24 hours' 
         AND student_id != $2`,
      [deviceId, studentId]
    );

    if (Number(multiStudentRes.rows[0]?.count || 0) >= 2) {
      flags.push('FLAG_MULTI_STUDENT_DEVICE');
    }
  } catch (error) {
    console.error('Error analyzing misuse flags:', error);
  }

  return {
    flags,
    reviewStatus: flags.length > 0 ? 'pending' : 'auto',
  };
}
