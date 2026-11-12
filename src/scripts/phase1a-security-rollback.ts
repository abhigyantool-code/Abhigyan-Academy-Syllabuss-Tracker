/**
 * Operation A: Security Rollback Script (BUG-022)
 * Restores PocketBase collection rules to their exact pre-lockdown state from a verified snapshot.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';

export async function runSecurityRollback(snapshotPath: string): Promise<{ restored: string[] }> {
  console.log('\n==================================================');
  console.log('🔄 OPERATION A: SECURITY RULES ROLLBACK');
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

  for (const [collectionName, rules] of Object.entries<any>(collections)) {
    console.log(`Restoring rules for: ${collectionName}...`);
    try {
      await pb.collections.update(collectionName, {
        listRule: rules.listRule,
        viewRule: rules.viewRule,
        createRule: rules.createRule,
        updateRule: rules.updateRule,
        deleteRule: rules.deleteRule,
      });

      // Verify restoration
      const updated = await pb.collections.getOne(collectionName);
      if (
        updated.listRule !== rules.listRule ||
        updated.viewRule !== rules.viewRule ||
        updated.createRule !== rules.createRule ||
        updated.updateRule !== rules.updateRule ||
        updated.deleteRule !== rules.deleteRule
      ) {
        throw new Error(`Rollback verification failed on ${collectionName}`);
      }

      restored.push(collectionName);
      console.log(`   ✓ ${collectionName}: Rules successfully restored`);
    } catch (err: any) {
      console.error(`   ✗ Error restoring ${collectionName}: ${err.message}`);
      throw err;
    }
  }

  console.log('\n==================================================');
  console.log(`✓ Restored rules on all ${restored.length} collections.`);
  console.log('==================================================\n');

  return { restored };
}

if (process.argv[1] && process.argv[1].endsWith('phase1a-security-rollback.ts')) {
  const argIndex = process.argv.indexOf('--snapshot');
  const snapshotPath = argIndex !== -1 ? process.argv[argIndex + 1] : '';

  if (!snapshotPath) {
    console.error('Usage: tsx phase1a-security-rollback.ts --snapshot <path-to-snapshot.json>');
    process.exit(1);
  }

  runSecurityRollback(snapshotPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal rollback error:', err);
      process.exit(1);
    });
}
