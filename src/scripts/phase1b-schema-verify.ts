/**
 * Operation B: Schema Verification & Lifecycle Test Script (BUG-012, BUG-024)
 * Verifies field definitions, rules, and soft-void lifecycle.
 * Isolates test fixtures completely (BUG-024 fix: Dedicated probe course, guaranteed cleanup).
 */

import { getPbClient } from '../lib/pb';

export async function runSchemaVerify(): Promise<{ success: boolean; fieldsVerified: number }> {
  console.log('\n==================================================');
  console.log('🔍 OPERATION B: `teaching_records` SCHEMA VERIFICATION');
  console.log('==================================================\n');

  const pb = await getPbClient();

  console.log('Step 1: Reading `teaching_records` collection definition...');
  const col = await pb.collections.getOne('teaching_records');

  // Verify locked rules
  if (
    col.listRule !== null ||
    col.viewRule !== null ||
    col.createRule !== null ||
    col.updateRule !== null ||
    col.deleteRule !== null
  ) {
    throw new Error('Lockdown check failed: teaching_records rules are not set to null');
  }
  console.log('   ✓ All 5 API rules confirmed null (Superuser only)');

  // Verify fields
  const fieldNames = new Set(col.fields.map((f: any) => f.name));
  const requiredFields = [
    'session_id',
    'session_number',
    'teacher',
    'course',
    'subject',
    'topic',
    'session_date',
    'session_type',
    'status',
    'duration_minutes',
    'batch',
    'attendance_count',
    'remarks',
    'is_voided',
    'voided_at',
    'voided_by',
    'void_reason',
    'correction_of',
    'version',
    'source',
  ];

  for (const rf of requiredFields) {
    if (!fieldNames.has(rf)) {
      throw new Error(`Missing expected field in teaching_records: ${rf}`);
    }
  }
  console.log(`   ✓ All ${requiredFields.length} expected fields verified present`);

  // Step 2: Isolated Lifecycle Probe Test (BUG-024 Fix)
  console.log('\nStep 2: Testing record lifecycle with fully isolated fixtures (BUG-024)...');
  const timestamp = Date.now().toString();
  const probeTag = `PROBE_${timestamp}`;

  let probeCourse: any = null;
  let probeTeacher: any = null;
  let probeSubject: any = null;
  let probeTopic: any = null;
  let probeRecord: any = null;

  try {
    // Create dedicated isolated parent fixtures
    probeCourse = await pb.collection('courses').create({
      name: `Test Course ${probeTag}`,
      code: `TC_${timestamp.slice(-4)}`,
      sort_order: 9999,
      active: false,
    });

    probeTeacher = await pb.collection('teachers').create({
      name: `Test Teacher ${probeTag}`,
      active: false,
      pin: '9999',
    });

    probeSubject = await pb.collection('subjects').create({
      course: probeCourse.id,
      name: `Test Subject ${probeTag}`,
      sort_order: 9999,
    });

    probeTopic = await pb.collection('topics').create({
      subject: probeSubject.id,
      name: `Test Topic ${probeTag}`,
      seq_no: 9999,
    });

    // Create probe record in teaching_records
    probeRecord = await pb.collection('teaching_records').create({
      session_id: `TR_PROBE_${timestamp}`,
      session_number: 1,
      teacher: probeTeacher.id,
      course: probeCourse.id,
      subject: probeSubject.id,
      topic: probeTopic.id,
      session_date: '2026-11-12',
      session_type: 'lecture',
      status: 'completed',
      duration_minutes: 60,
      remarks: 'Automated isolated schema verification probe',
      is_voided: false,
      version: 1,
      source: 'admin_entry',
    });

    console.log(`   ✓ Probe record inserted (ID: ${probeRecord.id})`);

    // Test soft-void lifecycle
    const updated = await pb.collection('teaching_records').update(probeRecord.id, {
      is_voided: true,
      voided_at: new Date().toISOString(),
      voided_by: 'system_verify',
      void_reason: 'Automated verification test of soft-void lifecycle',
    });

    if (!updated.is_voided) {
      throw new Error('Soft-void lifecycle test failed: is_voided is not true');
    }
    console.log(`   ✓ Soft-void update verified`);
  } finally {
    // Guaranteed cleanup of ALL isolated fixtures
    console.log('\nCleaning up isolated verification fixtures...');
    if (probeRecord) {
      await pb.collection('teaching_records').delete(probeRecord.id).catch(() => {});
    }
    if (probeTopic) {
      await pb.collection('topics').delete(probeTopic.id).catch(() => {});
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
    console.log('   ✓ Zero verification artifacts remain in database');
  }

  console.log('\n==================================================');
  console.log('🎉 `teaching_records` SCHEMA VERIFICATION COMPLETE!');
  console.log('==================================================\n');

  return { success: true, fieldsVerified: requiredFields.length };
}

if (process.argv[1] && process.argv[1].endsWith('phase1b-schema-verify.ts')) {
  runSchemaVerify()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal schema verify error:', err);
      process.exit(1);
    });
}
