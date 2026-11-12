/**
 * Operation C: Database Indexes Rollback Script
 * Restores collection indexes to their exact pre-operation state from a verified snapshot.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';

export async function runIndexesRollback(snapshotPath: string): Promise<{ restored: string[] }> {
  console.log('\n==================================================');
  console.log('🔄 OPERATION C: DATABASE INDEXES ROLLBACK');
  console.log(`Snapshot: ${snapshotPath}`);
  console.log('==================================================\n');

  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot file not found: ${snapshotPath}`);
  }

  const snapshotContent = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  const collections = snapshotContent.collections;
  if (!collections || Object.keys(collections).length === 0) {
    throw new Error(`Invalid snapshot format: No collections found in ${snapshotPath}`);
  }

  const pb = await getPbClient();
  const restored: string[] = [];

  for (const [colName, data] of Object.entries<any>(collections)) {
    console.log(`Restoring original indexes for: ${colName}...`);
    try {
      let col;
      try {
        col = await pb.collections.getOne(colName);
      } catch (err: any) {
        if (err.status === 404) continue;
        throw err;
      }

      await pb.collections.update(col.id, { indexes: data.indexes || [] });
      restored.push(colName);
      console.log(`   ✓ ${colName}: Restored ${data.indexes.length} original indexes`);
    } catch (err: any) {
      console.error(`   ✗ Error restoring indexes on ${colName}: ${err.message}`);
      throw err;
    }
  }

  console.log('\n==================================================');
  console.log(`✓ Restored indexes across ${restored.length} collections.`);
  console.log('==================================================\n');

  return { restored };
}

if (process.argv[1] && process.argv[1].endsWith('phase1c-indexes-rollback.ts')) {
  const argIndex = process.argv.indexOf('--snapshot');
  const snapshotPath = argIndex !== -1 ? process.argv[argIndex + 1] : '';

  if (!snapshotPath) {
    console.error('Usage: tsx phase1c-indexes-rollback.ts --snapshot <path-to-snapshot.json>');
    process.exit(1);
  }

  runIndexesRollback(snapshotPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal index rollback error:', err);
      process.exit(1);
    });
}
