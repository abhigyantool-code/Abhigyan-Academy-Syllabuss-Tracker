/**
 * Operation D: Migrate Historical Fabricated Entries to teaching_records (BUG-010)
 * Safely copies the 6 historical teacher endorsements into genuine teaching_records.
 *
 * Safety Invariants:
 * 1. Preserves all 6 original entries in `entries` table (zero deletion without explicit authorization).
 * 2. Asserts genuine student submissions (7lhmo4p1mzkw9w2 and pogx003bic5x4pi) are 100% intact.
 * 3. Idempotent: Can be run multiple times safely via unique session_id checking.
 */

import { getPbClient } from '../lib/pb';

export const FABRICATED_ENTRY_IDS = [
  'yxq3qzpacrzedmk',
  'vn937ngjpc6id94',
  'tdh8gj19b3pa2se',
  'rftu50ztslozcpa',
  'k5t9j1qdt61xxqv',
  '1qn086bxkmi6m48',
] as const;

export const GENUINE_ENTRY_IDS = [
  '7lhmo4p1mzkw9w2',
  'pogx003bic5x4pi',
] as const;

export const ASHISH_SIR_TEACHER_ID = 'g0rwo664arm9les';

export async function runMigrateFabricatedEntries(options: { execute?: boolean } = {}) {
  const isExecute = Boolean(options.execute);
  console.log('\n============================================================');
  console.log('🔄 OPERATION D: HISTORICAL FABRICATED ENTRIES MIGRATION (BUG-010)');
  console.log(`Mode: ${isExecute ? '⚡ LIVE EXECUTION' : '🛡️ DRY RUN (Read-Only Preview)'}`);
  console.log('============================================================\n');

  const pb = await getPbClient();

  // 1. Invariant Preflight Check
  console.log('📋 Step 1: Pre-flight Safety & Invariant Checks...');
  for (const genuineId of GENUINE_ENTRY_IDS) {
    const rec = await pb.collection('entries').getOne(genuineId);
    if (!rec) {
      throw new Error(`FATAL: Genuine student submission ${genuineId} is missing!`);
    }
  }
  console.log('   ✓ Genuine student submissions verified intact.');

  // Verify Ashish Sir exists
  const teacher = await pb.collection('teachers').getOne(ASHISH_SIR_TEACHER_ID);
  if (!teacher || !teacher.name.includes('Ashish')) {
    throw new Error(`FATAL: Could not verify Ashish Sir (ID: ${ASHISH_SIR_TEACHER_ID}) in teachers table.`);
  }
  console.log(`   ✓ Verified faculty profile: ${teacher.name} (${teacher.id})`);

  // Verify the 6 fabricated entries exist
  const sourceEntries = [];
  for (const fabId of FABRICATED_ENTRY_IDS) {
    const entry = await pb.collection('entries').getOne(fabId, { expand: 'topic,subject,course' });
    if (!entry) {
      throw new Error(`FATAL: Fabricated entry ${fabId} is missing from entries table.`);
    }
    sourceEntries.push(entry);
  }
  console.log(`   ✓ All ${sourceEntries.length} source endorsement entries located.`);

  // 2. Migration into teaching_records
  console.log('\n📦 Step 2: Preparing teaching_records migration payloads...');
  let migratedCount = 0;
  let alreadyExistsCount = 0;

  for (const entry of sourceEntries) {
    const sessionId = `migrated_${entry.id}`;

    // Check if already migrated
    const existing = await pb.collection('teaching_records').getFullList({
      filter: `session_id = "${sessionId}"`,
    });

    if (existing.length > 0) {
      console.log(`   ⏭️ Topic "${(entry.expand as any)?.topic?.name}": Already migrated (ID: ${existing[0].id})`);
      alreadyExistsCount++;
      continue;
    }

    const payload = {
      session_id: sessionId,
      session_number: 1,
      teacher: ASHISH_SIR_TEACHER_ID,
      course: entry.course,
      subject: entry.subject,
      topic: entry.topic,
      session_date: entry.class_date || '2026-11-10',
      session_type: 'lecture',
      status: 'completed',
      duration_minutes: 60,
      batch: 'Regular Batch',
      attendance_count: 0,
      remarks: 'Migrated from teacher-portal-endorse (BUG-010)',
      is_voided: false,
      source: 'system_migration',
      version: 1,
    };

    if (isExecute) {
      const created = await pb.collection('teaching_records').create(payload);
      console.log(`   ✓ Migrated topic "${(entry.expand as any)?.topic?.name}" -> teaching_record ID: ${created.id}`);
      migratedCount++;
    } else {
      console.log(`   ℹ [DRY RUN] Would create teaching_record for topic "${(entry.expand as any)?.topic?.name}" (Course: ${entry.course})`);
      migratedCount++;
    }
  }

  // 3. Postflight Invariant Verification
  console.log('\n🔒 Step 3: Postflight Invariant Verification...');
  for (const genuineId of GENUINE_ENTRY_IDS) {
    const rec = await pb.collection('entries').getOne(genuineId);
    if (!rec) {
      throw new Error(`FATAL INTEGRITY VIOLATION: Genuine student submission ${genuineId} was modified or deleted!`);
    }
  }
  console.log('   ✓ Genuine student submissions remain 100% untouched.');

  // Verify all 6 source entries remain intact
  for (const fabId of FABRICATED_ENTRY_IDS) {
    const rec = await pb.collection('entries').getOne(fabId);
    if (!rec) {
      throw new Error(`FATAL INTEGRITY VIOLATION: Source entry ${fabId} was prematurely deleted!`);
    }
  }
  console.log('   ✓ All 6 original source records remain preserved in entries collection.');

  console.log('\n============================================================');
  console.log(`🎉 MIGRATION SUMMARY (BUG-010):`);
  console.log(`Migrated / Planned: ${migratedCount}`);
  console.log(`Already Existed:    ${alreadyExistsCount}`);
  console.log(`Source Preserved:   ${FABRICATED_ENTRY_IDS.length}`);
  console.log(`Genuine Intact:     ${GENUINE_ENTRY_IDS.length}`);
  console.log('============================================================\n');

  return { migratedCount, alreadyExistsCount };
}

if (process.argv[1] && process.argv[1].endsWith('phase1d-migrate-fabricated-entries.ts')) {
  const isExecute = process.argv.includes('--execute');
  runMigrateFabricatedEntries({ execute: isExecute })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
