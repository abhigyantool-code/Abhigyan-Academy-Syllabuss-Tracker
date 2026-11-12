/**
 * Operation C: Database Index Creation Script (BUG-013, BUG-030)
 * Applies partial unique indexes, foreign key lookup indexes, and query performance indexes in SQLite.
 * Preflight verified and incorporates `idx_course_settings_course` (BUG-030).
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';
import { runIndexesPreflight } from './phase1c-indexes-preflight';
import { runIndexesBackup } from './phase1c-indexes-backup';

export const INDEX_PLANS: Record<string, string[]> = {
  teachers: [
    'CREATE UNIQUE INDEX idx_teachers_name ON teachers (name)',
  ],
  students: [
    'CREATE UNIQUE INDEX idx_students_roll_no ON students (roll_no)',
    'CREATE INDEX idx_students_active ON students (active)',
  ],
  courses: [
    'CREATE UNIQUE INDEX idx_courses_code ON courses (code)',
  ],
  // BUG-030: Add missing unique index on course_settings.course
  course_settings: [
    'CREATE UNIQUE INDEX idx_course_settings_course ON course_settings (course)',
  ],
  teacher_subjects: [
    'CREATE UNIQUE INDEX idx_ts_teacher_subject ON teacher_subjects (teacher, subject)',
    'CREATE INDEX idx_ts_subject ON teacher_subjects (subject)',
    'CREATE INDEX idx_ts_teacher ON teacher_subjects (teacher)',
  ],
  enrollments: [
    'CREATE UNIQUE INDEX idx_enrollments_student_course ON enrollments (student, course)',
    'CREATE INDEX idx_enrollments_course ON enrollments (course)',
    'CREATE INDEX idx_enrollments_student ON enrollments (student)',
  ],
  topics: [
    'CREATE UNIQUE INDEX idx_topics_subject_seq ON topics (subject, seq_no)',
    'CREATE INDEX idx_topics_subject ON topics (subject)',
    'CREATE INDEX idx_topics_target_date ON topics (target_date)',
  ],
  entries: [
    'CREATE UNIQUE INDEX idx_entries_student_topic_date ON entries (student, topic, class_date)',
    'CREATE INDEX idx_entries_course ON entries (course)',
    'CREATE INDEX idx_entries_subject ON entries (subject)',
    'CREATE INDEX idx_entries_topic ON entries (topic)',
    'CREATE INDEX idx_entries_teacher ON entries (teacher)',
    'CREATE INDEX idx_entries_student ON entries (student)',
    'CREATE INDEX idx_entries_status ON entries (status)',
    'CREATE INDEX idx_entries_review_status ON entries (review_status)',
  ],
  subjects: [
    'CREATE INDEX idx_subjects_course ON subjects (course)',
  ],
  class_codes: [
    'CREATE INDEX idx_cc_course_date ON class_codes (course, class_date)',
  ],
  audit_log: [
    'CREATE INDEX idx_audit_created ON audit_log (created)',
    'CREATE INDEX idx_audit_action ON audit_log (action)',
  ],
  teaching_records: [
    'CREATE UNIQUE INDEX idx_tr_session_id ON teaching_records (session_id)',
    'CREATE UNIQUE INDEX idx_tr_active_session ON teaching_records (teacher, topic, session_date, session_number) WHERE is_voided = 0',
    'CREATE INDEX idx_tr_teacher_date ON teaching_records (teacher, session_date)',
    'CREATE INDEX idx_tr_course_date ON teaching_records (course, session_date)',
    'CREATE INDEX idx_tr_topic ON teaching_records (topic)',
    'CREATE INDEX idx_tr_subject ON teaching_records (subject)',
  ],
};

export async function runIndexesCreate(): Promise<{ modified: string[]; snapshotPath: string }> {
  console.log('\n==================================================');
  console.log('⚡ OPERATION C: DATABASE INDEX CREATION');
  console.log('==================================================\n');

  // Step 1: Duplicate Preflight
  console.log('--- Step 1: Duplicate Preflight Scan ---');
  const preflight = await runIndexesPreflight();
  if (preflight.totalDuplicates > 0) {
    throw new Error(`Index creation aborted: ${preflight.totalDuplicates} duplicates found.`);
  }

  // Step 2: Indexes Baseline Backup
  console.log('\n--- Step 2: Index Baseline Backup ---');
  const backup = await runIndexesBackup();

  // Step 3: Apply Indexes
  console.log('\n--- Step 3: Applying Indexes Collection by Collection ---');
  const pb = await getPbClient();
  const modified: string[] = [];

  for (const [colName, indexes] of Object.entries(INDEX_PLANS)) {
    let col;
    try {
      col = await pb.collections.getOne(colName);
    } catch (err: any) {
      if (err.status === 404) {
        console.log(`   ⏭️ Skipping '${colName}' (collection does not exist yet)`);
        continue;
      }
      throw err;
    }

    console.log(`Applying ${indexes.length} indexes to '${colName}'...`);
    try {
      // Merge unique indexes cleanly
      const current = new Set(col.indexes || []);
      for (const idx of indexes) {
        current.add(idx);
      }
      const newIndexes = Array.from(current);

      await pb.collections.update(col.id, { indexes: newIndexes });

      // Immediate verification
      const updated = await pb.collections.getOne(col.id);
      console.log(`   ✓ ${colName}: Now has ${(updated.indexes || []).length} active indexes`);
      modified.push(colName);
    } catch (err: any) {
      console.error(`\n❌ Error applying indexes to ${colName}: ${err.message}`);
      console.error(`Execute rollback immediately:`);
      console.error(`npx tsx src/scripts/phase1c-indexes-rollback.ts --snapshot "${backup.snapshotPath}"\n`);
      throw err;
    }
  }

  console.log('\n==================================================');
  console.log(`🎉 ALL INDEXES APPLIED ACROSS ${modified.length} COLLECTIONS!`);
  console.log('==================================================\n');

  return { modified, snapshotPath: backup.snapshotPath };
}

if (process.argv[1] && process.argv[1].endsWith('phase1c-indexes-create.ts')) {
  runIndexesCreate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal index create error:', err);
      process.exit(1);
    });
}
