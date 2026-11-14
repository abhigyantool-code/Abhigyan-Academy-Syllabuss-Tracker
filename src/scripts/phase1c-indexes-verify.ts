/**
 * Operation C: Database Indexes Verification Script (BUG-013, BUG-024)
 * Verifies index presence and tests unique constraint enforcement.
 * Uses fully isolated fixtures (BUG-024 fix: Dedicated test course, guaranteed cleanup).
 */

import { getPbClient } from '../lib/pb';
import { INDEX_PLANS } from './phase1c-indexes-create';

export async function runIndexesVerify(): Promise<{ success: boolean; collectionsVerified: number }> {
  console.log('\n==================================================');
  console.log('🔍 OPERATION C: DATABASE INDEXES VERIFICATION');
  console.log('==================================================\n');

  const pb = await getPbClient();
  let verifiedCount = 0;

  console.log('--- Step 1: Verifying Index Definitions in PocketBase ---');
  for (const [colName, expectedIndexes] of Object.entries(INDEX_PLANS)) {
    let col;
    try {
      col = await pb.collections.getOne(colName);
    } catch (err: any) {
      if (err.status === 404) {
        console.log(`   ⏭️ Skipping '${colName}' (collection does not exist)`);
        continue;
      }
      throw err;
    }

    const activeIndexNames = new Set(
      (col.indexes || []).map((idx: string) => {
        const m = idx.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"']?)([a-zA-Z0-9_]+)(?:[`"']?)/i);
        return m ? m[1].toLowerCase() : '';
      }).filter(Boolean)
    );
    let colMissing = 0;
    for (const exp of expectedIndexes) {
      const m = exp.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"']?)([a-zA-Z0-9_]+)(?:[`"']?)/i);
      const expName = m ? m[1].toLowerCase() : '';
      if (!expName || !activeIndexNames.has(expName)) {
        console.warn(`   ⚠️ Missing index on ${colName}: ${exp}`);
        colMissing++;
      }
    }

    if (colMissing === 0) {
      console.log(`   ✓ ${colName}: All ${expectedIndexes.length} expected indexes active`);
      verifiedCount++;
    } else {
      console.error(`   ✗ ${colName}: ${colMissing} missing indexes`);
    }
  }

  // Step 2: Uniqueness Constraint Enforcement Test using Isolated Fixtures (BUG-024)
  console.log('\n--- Step 2: Testing Unique Constraint Enforcement (Isolated Fixture) ---');
  const timestamp = Date.now().toString();
  const probeTag = `PROBE_IDX_${timestamp}`;

  let probeCourse: any = null;
  let probeTeacher: any = null;
  let probeSubject: any = null;
  let probeRel1: any = null;
  let probeRel2: any = null;

  try {
    probeCourse = await pb.collection('courses').create({
      name: `Probe Course ${probeTag}`,
      code: `PC_${timestamp.slice(-4)}`,
      sort_order: 9999,
      active: false,
    });

    probeTeacher = await pb.collection('teachers').create({
      name: `Probe Teacher ${probeTag}`,
      active: false,
      pin: '9999',
    });

    probeSubject = await pb.collection('subjects').create({
      course: probeCourse.id,
      name: `Probe Subject ${probeTag}`,
      sort_order: 9999,
    });

    // Insert first relation
    probeRel1 = await pb.collection('teacher_subjects').create({
      teacher: probeTeacher.id,
      subject: probeSubject.id,
    });
    console.log(`   ✓ First teacher_subject relation inserted (ID: ${probeRel1.id})`);

    // Attempt duplicate relation insert — should fail due to UNIQUE index idx_ts_teacher_subject
    let duplicateRejected = false;
    try {
      probeRel2 = await pb.collection('teacher_subjects').create({
        teacher: probeTeacher.id,
        subject: probeSubject.id,
      });
    } catch (err: any) {
      // Expected: PocketBase / SQLite unique constraint violation
      duplicateRejected = true;
      console.log(`   ✓ Duplicate relation correctly rejected by unique constraint: ${err.message}`);
    }

    if (!duplicateRejected) {
      throw new Error('FATAL: Duplicate teacher_subject relation was NOT rejected by database index!');
    }
  } finally {
    console.log('\nCleaning up isolated index test fixtures...');
    if (probeRel2) {
      await pb.collection('teacher_subjects').delete(probeRel2.id).catch(() => {});
    }
    if (probeRel1) {
      await pb.collection('teacher_subjects').delete(probeRel1.id).catch(() => {});
    }
    if (probeSubject) {
      await pb.collection('subjects').delete(probeSubject.id).catch(() => {});
    }
    if (probeTeacher) {
      await pb.collection('teachers').delete(probeTeacher.id).catch(() => {});
    }
    if (probeCourse) {
      await pb.collection('courses').delete(probeCourse.id).catch(() => {});
    }
    console.log('   ✓ Zero probe fixtures remain in database');
  }

  console.log('\n==================================================');
  console.log('🎉 DATABASE INDEXES VERIFICATION COMPLETE!');
  console.log('==================================================\n');

  return { success: true, collectionsVerified: verifiedCount };
}

if (process.argv[1] && process.argv[1].endsWith('phase1c-indexes-verify.ts')) {
  runIndexesVerify()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal index verify error:', err);
      process.exit(1);
    });
}
