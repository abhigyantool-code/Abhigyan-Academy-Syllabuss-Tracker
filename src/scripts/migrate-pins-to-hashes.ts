/**
 * Safe PIN-to-Hash Migration Script (Priority 3, BUG-004, BUG-005)
 * Migrates plaintext student and teacher PINs to secure scrypt hashes.
 *
 * Safety guarantees:
 * 1. Defaults to --dry-run unless --execute is explicitly specified.
 * 2. Never deletes student or faculty records.
 * 3. Idempotent: Skips accounts that already have a valid scrypt$ hash.
 * 4. Captures local JSON snapshot before any mutation.
 * 5. Supports separate test database via TEST_POCKETBASE_URL / POCKETBASE_URL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';
import { hashPinSync } from '../lib/pin-hash';

interface MigrationStats {
  studentsExamined: number;
  studentsMigrated: number;
  studentsAlreadyHashed: number;
  studentsSkippedNoPin: number;
  teachersExamined: number;
  teachersMigrated: number;
  teachersAlreadyHashed: number;
  teachersSkippedNoPin: number;
  errors: string[];
}

export async function runPinMigration(options: {
  execute?: boolean;
  purgePlaintext?: boolean;
  snapshotDir?: string;
}): Promise<MigrationStats> {
  const isExecute = Boolean(options.execute);
  const purgePlaintext = Boolean(options.purgePlaintext);
  const snapshotBaseDir = options.snapshotDir || path.join(process.cwd(), 'database/backups/pin_migration');

  console.log(`\n==================================================`);
  console.log(`🔐 PIN-TO-HASH MIGRATION ENGINE`);
  console.log(`Mode: ${isExecute ? '⚡ LIVE EXECUTION' : '🛡️ DRY RUN (Read-Only Preview)'}`);
  console.log(`Purge Plaintext: ${purgePlaintext ? 'YES (WARNING)' : 'NO (Dual-Storage Safe Mode)'}`);
  console.log(`==================================================\n`);

  const stats: MigrationStats = {
    studentsExamined: 0,
    studentsMigrated: 0,
    studentsAlreadyHashed: 0,
    studentsSkippedNoPin: 0,
    teachersExamined: 0,
    teachersMigrated: 0,
    teachersAlreadyHashed: 0,
    teachersSkippedNoPin: 0,
    errors: [],
  };

  const pb = await getPbClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join(snapshotBaseDir, timestamp);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Step 1: Pre-flight snapshot of student & teacher records
  console.log('📦 Step 1: Capturing pre-migration snapshot...');
  const students = await pb.collection('students').getFullList();
  const teachers = await pb.collection('teachers').getFullList();

  fs.writeFileSync(
    path.join(sessionDir, 'pre_migration_students.json'),
    JSON.stringify(students, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(sessionDir, 'pre_migration_teachers.json'),
    JSON.stringify(teachers, null, 2),
    'utf-8'
  );
  console.log(`✓ Snapshot saved: ${sessionDir} (${students.length} students, ${teachers.length} teachers)\n`);

  // Step 1.5: Verify and provision pin_hash field on collections if missing
  console.log('🔍 Step 1.5: Verifying collection schema for pin_hash field...');
  for (const colName of ['students', 'teachers']) {
    try {
      const col = await pb.collections.getOne(colName);
      const fields = (col as any).fields || (col as any).schema || [];
      const hasPinHash = Array.isArray(fields) && fields.some((f: any) => f.name === 'pin_hash');
      if (!hasPinHash) {
        console.log(`   + Adding missing pin_hash field to "${colName}" collection...`);
        if (isExecute) {
          if (Array.isArray((col as any).fields)) {
            (col as any).fields.push({
              name: 'pin_hash',
              type: 'text',
              required: false,
            });
            await pb.collections.update(colName, { fields: (col as any).fields });
          } else if (Array.isArray((col as any).schema)) {
            (col as any).schema.push({
              name: 'pin_hash',
              type: 'text',
              required: false,
            });
            await pb.collections.update(colName, { schema: (col as any).schema });
          }
          console.log(`   ✓ pin_hash field added to "${colName}" schema.`);
        } else {
          console.log(`   ℹ [DRY RUN] Would add pin_hash field to "${colName}" schema.`);
        }
      } else {
        console.log(`   ✓ "${colName}" schema already contains pin_hash field.`);
      }
    } catch (schemaErr: any) {
      console.warn(`   ⚠️ Schema inspection note on "${colName}": ${schemaErr.message}`);
    }
  }

  // Step 2: Migrate Students
  console.log(`\n👥 Step 2: Processing ${students.length} Student records...`);
  for (const student of students) {
    stats.studentsExamined++;
    try {
      if (student.pin_hash && typeof student.pin_hash === 'string' && student.pin_hash.startsWith('scrypt$')) {
        stats.studentsAlreadyHashed++;
        continue;
      }

      if (!student.pin) {
        stats.studentsSkippedNoPin++;
        continue;
      }

      const hash = hashPinSync(student.pin);
      const updatePayload: Record<string, any> = {
        pin_hash: hash,
      };

      if (purgePlaintext) {
        updatePayload.pin = '';
      }

      if (isExecute) {
        await pb.collection('students').update(student.id, updatePayload);
      }
      stats.studentsMigrated++;
    } catch (err: any) {
      const msg = `Student ${student.roll_no || student.id} migration failed: ${err.message}`;
      console.error(`   ✗ ${msg}`);
      stats.errors.push(msg);
    }
  }

  // Step 3: Migrate Teachers
  console.log(`\n👨‍🏫 Step 3: Processing ${teachers.length} Teacher records...`);
  for (const teacher of teachers) {
    stats.teachersExamined++;
    try {
      if (teacher.pin_hash && typeof teacher.pin_hash === 'string' && teacher.pin_hash.startsWith('scrypt$')) {
        stats.teachersAlreadyHashed++;
        continue;
      }

      if (!teacher.pin) {
        stats.teachersSkippedNoPin++;
        continue;
      }

      const hash = hashPinSync(teacher.pin);
      const updatePayload: Record<string, any> = {
        pin_hash: hash,
      };

      if (purgePlaintext) {
        updatePayload.pin = '';
      }

      if (isExecute) {
        await pb.collection('teachers').update(teacher.id, updatePayload);
      }
      stats.teachersMigrated++;
    } catch (err: any) {
      const msg = `Teacher ${teacher.name || teacher.id} migration failed: ${err.message}`;
      console.error(`   ✗ ${msg}`);
      stats.errors.push(msg);
    }
  }

  console.log(`\n==================================================`);
  console.log(`📊 MIGRATION SUMMARY`);
  console.log(`Students: ${stats.studentsMigrated} migrated, ${stats.studentsAlreadyHashed} already hashed, ${stats.studentsSkippedNoPin} skipped`);
  console.log(`Teachers: ${stats.teachersMigrated} migrated, ${stats.teachersAlreadyHashed} already hashed, ${stats.teachersSkippedNoPin} skipped`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`==================================================\n`);

  fs.writeFileSync(
    path.join(sessionDir, 'migration_result.json'),
    JSON.stringify({ stats, isExecute, purgePlaintext, timestamp }, null, 2),
    'utf-8'
  );

  return stats;
}

if (process.argv[1] && process.argv[1].endsWith('migrate-pins-to-hashes.ts')) {
  const isExecute = process.argv.includes('--execute');
  const purgePlaintext = process.argv.includes('--purge-plaintext');

  runPinMigration({ execute: isExecute, purgePlaintext })
    .then((stats) => {
      if (stats.errors.length > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
