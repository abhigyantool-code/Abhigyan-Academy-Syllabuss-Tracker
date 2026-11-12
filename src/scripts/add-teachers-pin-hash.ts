/**
 * Script to add `pin_hash` field to `teachers` collection schema in PocketBase (NEW-03)
 */

import { getPbClient } from '../lib/pb';

export async function addTeacherPinHashField(): Promise<void> {
  console.log('\n==================================================');
  console.log('🔧 ADD `pin_hash` FIELD TO `teachers` SCHEMA (NEW-03)');
  console.log('==================================================\n');

  const pb = await getPbClient();
  const col = await pb.collections.getOne('teachers');
  const fields = (col as any).fields || [];

  const existingField = fields.find((f: any) => f.name === 'pin_hash');
  if (existingField) {
    console.log('✓ `pin_hash` field already exists on `teachers` collection. Nothing to do.');
    return;
  }

  console.log('Current fields on `teachers`:', fields.map((f: any) => f.name).join(', '));
  console.log('Adding `pin_hash` (text, optional) to `teachers` collection schema...');

  const updatedFields = [
    ...fields,
    {
      name: 'pin_hash',
      type: 'text',
      required: false,
    },
  ];

  await pb.collections.update('teachers', {
    fields: updatedFields,
  });

  // Verify immediately
  const verifiedCol = await pb.collections.getOne('teachers');
  const verifiedField = (verifiedCol as any).fields?.find((f: any) => f.name === 'pin_hash');

  if (!verifiedField) {
    throw new Error('Verification failed: `pin_hash` field was not found after update!');
  }

  console.log('✓ `pin_hash` field added and verified on `teachers` collection successfully.');
  console.log('Updated fields:', (verifiedCol as any).fields.map((f: any) => f.name).join(', '));

  try {
    await pb.collection('audit_log').create({
      action: 'SCHEMA_UPDATE_TEACHERS_ADD_PIN_HASH',
      actor_label: 'Admin (Schema Migration)',
      entity: 'collections',
      entity_id: verifiedCol.id,
      after: {
        fieldsCount: (verifiedCol as any).fields.length,
        addedField: 'pin_hash',
        timestamp: new Date().toISOString(),
      },
    });
    console.log('✓ Audit log created.');
  } catch (err: any) {
    console.warn('Audit log warning:', err.message);
  }

  console.log('==================================================\n');
}

if (process.argv[1] && process.argv[1].endsWith('add-teachers-pin-hash.ts')) {
  addTeacherPinHashField()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error adding pin_hash to teachers:', err);
      process.exit(1);
    });
}
