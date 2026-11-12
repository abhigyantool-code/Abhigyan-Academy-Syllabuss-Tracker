/**
 * Safe PIN Migration Rollback Script (Priority 3)
 * Restores pre-migration student and teacher credentials from a snapshot.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';

export async function rollbackPinMigration(options: {
  snapshotDir: string;
  execute?: boolean;
}): Promise<{ studentsRestored: number; teachersRestored: number; errors: string[] }> {
  const isExecute = Boolean(options.execute);
  const snapshotDir = options.snapshotDir;

  console.log(`\n==================================================`);
  console.log(`🔄 PIN MIGRATION ROLLBACK ENGINE`);
  console.log(`Mode: ${isExecute ? '⚡ LIVE ROLLBACK' : '🛡️ DRY RUN (Read-Only Preview)'}`);
  console.log(`Snapshot Dir: ${snapshotDir}`);
  console.log(`==================================================\n`);

  const studentSnapshotPath = path.join(snapshotDir, 'pre_migration_students.json');
  const teacherSnapshotPath = path.join(snapshotDir, 'pre_migration_teachers.json');

  if (!fs.existsSync(studentSnapshotPath) || !fs.existsSync(teacherSnapshotPath)) {
    throw new Error(`Snapshot files missing in: ${snapshotDir}`);
  }

  const students = JSON.parse(fs.readFileSync(studentSnapshotPath, 'utf-8'));
  const teachers = JSON.parse(fs.readFileSync(teacherSnapshotPath, 'utf-8'));

  const pb = await getPbClient();
  let studentsRestored = 0;
  let teachersRestored = 0;
  const errors: string[] = [];

  console.log(`Restoring ${students.length} students...`);
  for (const student of students) {
    try {
      if (isExecute) {
        await pb.collection('students').update(student.id, {
          pin: student.pin,
          pin_hash: student.pin_hash || null,
        });
      }
      studentsRestored++;
    } catch (err: any) {
      errors.push(`Student ${student.id} rollback error: ${err.message}`);
    }
  }

  console.log(`Restoring ${teachers.length} teachers...`);
  for (const teacher of teachers) {
    try {
      if (isExecute) {
        await pb.collection('teachers').update(teacher.id, {
          pin: teacher.pin,
          pin_hash: teacher.pin_hash || null,
        });
      }
      teachersRestored++;
    } catch (err: any) {
      errors.push(`Teacher ${teacher.id} rollback error: ${err.message}`);
    }
  }

  console.log(`\nRollback completed: ${studentsRestored} students, ${teachersRestored} teachers. Errors: ${errors.length}\n`);
  return { studentsRestored, teachersRestored, errors };
}

if (process.argv[1] && process.argv[1].endsWith('rollback-pin-migration.ts')) {
  const isExecute = process.argv.includes('--execute');
  const dirIndex = process.argv.indexOf('--snapshot');
  const snapshotDir = dirIndex !== -1 ? process.argv[dirIndex + 1] : '';

  if (!snapshotDir) {
    console.error('Usage: tsx rollback-pin-migration.ts --snapshot <snapshot-dir> [--execute]');
    process.exit(1);
  }

  rollbackPinMigration({ snapshotDir, execute: isExecute })
    .then((res) => {
      if (res.errors.length > 0) process.exit(1);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal rollback error:', err);
      process.exit(1);
    });
}
