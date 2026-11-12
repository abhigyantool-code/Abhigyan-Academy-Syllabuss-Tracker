/**
 * Operation C: Read-Only Duplicate Preflight Scan (BUG-013)
 * Evaluates candidate unique index combinations across all collections.
 * Reports any duplicate conflicts before index creation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';

export interface PreflightResult {
  totalDuplicates: number;
  collectionsScanned: number;
  conflicts: Record<string, string[]>;
}

export async function runIndexesPreflight(): Promise<PreflightResult> {
  console.log('\n==================================================');
  console.log('🔍 OPERATION C: READ-ONLY DUPLICATE PREFLIGHT SCAN');
  console.log('==================================================\n');

  const pb = await getPbClient();
  const conflicts: Record<string, string[]> = {};
  let totalDuplicates = 0;

  const checks = [
    {
      col: 'teachers',
      desc: 'Unique teacher name',
      getKey: (r: any) => (r.name || '').trim().toLowerCase(),
    },
    {
      col: 'students',
      desc: 'Unique student roll number',
      getKey: (r: any) => (r.roll_no || '').trim().toUpperCase(),
    },
    {
      col: 'courses',
      desc: 'Unique course code',
      getKey: (r: any) => (r.code || '').trim().toUpperCase(),
    },
    {
      col: 'course_settings',
      desc: 'Unique course settings per course (BUG-030)',
      getKey: (r: any) => r.course || '',
    },
    {
      col: 'teacher_subjects',
      desc: 'Unique teacher-subject assignment',
      getKey: (r: any) => `${r.teacher}_${r.subject}`,
    },
    {
      col: 'enrollments',
      desc: 'Unique student enrollment per course',
      getKey: (r: any) => `${r.student}_${r.course}`,
    },
    {
      col: 'topics',
      desc: 'Unique topic sequence per subject',
      getKey: (r: any) => `${r.subject}_${r.seq_no}`,
    },
    {
      col: 'entries',
      desc: 'Unique entry per student, topic, and date',
      getKey: (r: any) => `${r.student}_${r.topic}_${r.class_date}`,
    },
  ];

  for (const check of checks) {
    console.log(`Scanning collection: ${check.col} (${check.desc})...`);
    try {
      const records = await pb.collection(check.col).getFullList();
      const seen = new Map<string, string[]>();

      for (const rec of records) {
        const key = check.getKey(rec);
        if (!key) continue;
        if (!seen.has(key)) {
          seen.set(key, []);
        }
        seen.get(key)!.push(rec.id);
      }

      const colConflicts: string[] = [];
      for (const [key, ids] of seen.entries()) {
        if (ids.length > 1) {
          colConflicts.push(`Key "${key}" duplicated across IDs: ${ids.join(', ')}`);
          totalDuplicates += ids.length - 1;
        }
      }

      if (colConflicts.length > 0) {
        conflicts[check.col] = colConflicts;
        console.error(`   ✗ Found ${colConflicts.length} duplicate conflicts in ${check.col}`);
      } else {
        console.log(`   ✓ ${check.col}: 0 duplicates found across ${records.length} records`);
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Notice scanning ${check.col}: ${err.message}`);
    }
  }

  // Check teaching_records if present
  try {
    const trRecords = await pb.collection('teaching_records').getFullList();
    console.log('Scanning teaching_records for active session duplicates...');
    const seenTr = new Map<string, string[]>();
    for (const tr of trRecords) {
      if (tr.is_voided) continue; // Partial index WHERE is_voided = 0
      const key = `${tr.teacher}_${tr.topic}_${tr.session_date}_${tr.session_number}`;
      if (!seenTr.has(key)) seenTr.set(key, []);
      seenTr.get(key)!.push(tr.id);
    }
    const trConflicts: string[] = [];
    for (const [key, ids] of seenTr.entries()) {
      if (ids.length > 1) {
        trConflicts.push(`Active session key "${key}" duplicated across IDs: ${ids.join(', ')}`);
        totalDuplicates += ids.length - 1;
      }
    }
    if (trConflicts.length > 0) {
      conflicts['teaching_records'] = trConflicts;
      console.error(`   ✗ Found ${trConflicts.length} duplicate conflicts in teaching_records`);
    } else {
      console.log(`   ✓ teaching_records: 0 active duplicate conflicts across ${trRecords.length} records`);
    }
  } catch {
    // teaching_records may not exist yet
  }

  const timestamp = Date.now().toString();
  const reportDir = path.join(process.cwd(), 'database/backups/indexes');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `duplicate_preflight_report_${timestamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ timestamp: new Date().toISOString(), totalDuplicates, conflicts }, null, 2),
    'utf-8'
  );

  console.log('\n==================================================');
  console.log(`PREFLIGHT SUMMARY:`);
  console.log(`Total Duplicate Conflicts: ${totalDuplicates}`);
  console.log(`Report written to: ${reportPath}`);
  console.log('==================================================\n');

  if (totalDuplicates > 0) {
    throw new Error(`PREFLIGHT ABORT: Found ${totalDuplicates} duplicate conflicts. Index creation blocked.`);
  }

  return { totalDuplicates, collectionsScanned: checks.length, conflicts };
}

if (process.argv[1] && process.argv[1].endsWith('phase1c-indexes-preflight.ts')) {
  runIndexesPreflight()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal preflight error:', err);
      process.exit(1);
    });
}
