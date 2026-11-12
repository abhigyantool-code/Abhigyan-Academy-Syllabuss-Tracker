/**
 * Operation B: Schema Creation Script for `teaching_records` (BUG-012, BUG-029)
 * Creates the `teaching_records` base collection with locked API rules (null),
 * 20 verified fields, and foreign key relations. Standardizes on `duration_minutes`.
 */

import { getPbClient } from '../lib/pb';

export async function runSchemaCreate(): Promise<{ collectionId: string; name: string }> {
  console.log('\n==================================================');
  console.log('🏗️  OPERATION B: CREATE `teaching_records` COLLECTION');
  console.log('==================================================\n');

  const pb = await getPbClient();

  // Check if collection already exists
  try {
    const existing = await pb.collections.getOne('teaching_records');
    console.log(`⚠️ Collection 'teaching_records' already exists (ID: ${existing.id}). Skipping creation.`);
    return { collectionId: existing.id, name: existing.name };
  } catch (err: any) {
    if (err.status !== 404) {
      throw err;
    }
  }

  // Retrieve relation target collection IDs
  console.log('Fetching relation target collections...');
  const [teachersCol, coursesCol, subjectsCol, topicsCol] = await Promise.all([
    pb.collections.getOne('teachers'),
    pb.collections.getOne('courses'),
    pb.collections.getOne('subjects'),
    pb.collections.getOne('topics'),
  ]);

  console.log('Building `teaching_records` schema specification...');

  const collectionData = {
    name: 'teaching_records',
    type: 'base',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: 'session_id',
        type: 'text',
        required: true,
        min: 8,
        max: 64,
      },
      {
        name: 'session_number',
        type: 'number',
        required: true,
        min: 1,
        max: 20,
      },
      {
        name: 'teacher',
        type: 'relation',
        collectionId: teachersCol.id,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
        required: true,
      },
      {
        name: 'course',
        type: 'relation',
        collectionId: coursesCol.id,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
        required: true,
      },
      {
        name: 'subject',
        type: 'relation',
        collectionId: subjectsCol.id,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
        required: true,
      },
      {
        name: 'topic',
        type: 'relation',
        collectionId: topicsCol.id,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
        required: true,
      },
      {
        name: 'session_date',
        type: 'text',
        required: true,
      },
      {
        name: 'session_type',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['lecture', 'revision', 'doubt_clearing', 'test_discussion', 'lab_practical'],
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['completed', 'in_progress', 'partially_covered', 'recap_only', 'cancelled'],
      },
      {
        // BUG-029: Standardized explicitly on duration_minutes across all components and schema
        name: 'duration_minutes',
        type: 'number',
        required: true,
        min: 15,
        max: 480,
      },
      {
        name: 'batch',
        type: 'text',
        required: false,
      },
      {
        name: 'attendance_count',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        name: 'remarks',
        type: 'text',
        required: false,
        max: 1000,
      },
      {
        name: 'is_voided',
        type: 'bool',
        required: false,
      },
      {
        name: 'voided_at',
        type: 'text',
        required: false,
      },
      {
        name: 'voided_by',
        type: 'text',
        required: false,
      },
      {
        name: 'void_reason',
        type: 'text',
        required: false,
        max: 500,
      },
      {
        name: 'correction_of',
        type: 'text',
        required: false,
        max: 15,
      },
      {
        name: 'version',
        type: 'number',
        required: true,
        min: 1,
      },
      {
        name: 'source',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['teacher_portal', 'admin_entry', 'system_migration'],
      },
    ],
  };

  console.log('Submitting collection creation request...');
  const created = await pb.collections.create(collectionData);

  // Immediate read-back verification
  const verified = await pb.collections.getOne('teaching_records');
  if (
    verified.listRule !== null ||
    verified.viewRule !== null ||
    verified.createRule !== null ||
    verified.updateRule !== null ||
    verified.deleteRule !== null
  ) {
    throw new Error('Verification failed: teaching_records rules are not set to null');
  }

  console.log(`   ✓ Collection created with ID: ${created.id}`);
  console.log(`   ✓ API rules verified locked to null (Superuser only)`);
  console.log(`   ✓ Total fields defined: ${verified.fields.length}\n`);

  // Record audit log
  try {
    await pb.collection('audit_log').create({
      action: 'SCHEMA_CREATE_TEACHING_RECORDS',
      actor_label: 'Admin (Schema Migration)',
      entity: 'collections',
      entity_id: created.id,
      after: {
        name: created.name,
        fieldsCount: verified.fields.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (auditErr: any) {
    console.warn('Audit logging note:', auditErr.message);
  }

  console.log('==================================================');
  console.log('🎉 `teaching_records` COLLECTION CREATED & VERIFIED!');
  console.log('==================================================\n');

  return { collectionId: created.id, name: created.name };
}

if (process.argv[1] && process.argv[1].endsWith('phase1b-schema-create.ts')) {
  runSchemaCreate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal schema create error:', err);
      process.exit(1);
    });
}
