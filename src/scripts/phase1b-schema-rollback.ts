/**
 * Operation B: Schema Rollback Script
 * Safely removes `teaching_records` collection if creation failed or must be reverted.
 * Guarded against data loss: Refuses to delete if real records exist.
 */

import { getPbClient } from '../lib/pb';

export async function runSchemaRollback(): Promise<boolean> {
  console.log('\n==================================================');
  console.log('🔄 OPERATION B: `teaching_records` SCHEMA ROLLBACK');
  console.log('==================================================\n');

  const pb = await getPbClient();

  let collection;
  try {
    collection = await pb.collections.getOne('teaching_records');
  } catch (err: any) {
    if (err.status === 404) {
      console.log("Collection 'teaching_records' does not exist. Nothing to roll back.");
      return true;
    }
    throw err;
  }

  // Safety check: Assert collection is empty
  console.log('Checking collection record count...');
  const records = await pb.collection('teaching_records').getList(1, 10);
  if (records.totalItems > 0) {
    throw new Error(
      `FATAL SAFETY REJECTION: 'teaching_records' contains ${records.totalItems} records. Rollback aborted to prevent data loss.`
    );
  }

  console.log(`Deleting collection: teaching_records (ID: ${collection.id})...`);
  await pb.collections.delete(collection.id);

  // Verify deletion
  try {
    await pb.collections.getOne('teaching_records');
    throw new Error('Verification failed: teaching_records still exists after deletion');
  } catch (err: any) {
    if (err.status === 404) {
      console.log('   ✓ Verified collection deleted successfully.');
    } else {
      throw err;
    }
  }

  console.log('==================================================');
  console.log('✓ OPERATION B ROLLBACK COMPLETED');
  console.log('==================================================\n');

  return true;
}

if (process.argv[1] && process.argv[1].endsWith('phase1b-schema-rollback.ts')) {
  runSchemaRollback()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal schema rollback error:', err);
      process.exit(1);
    });
}
