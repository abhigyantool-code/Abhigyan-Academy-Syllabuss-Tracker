/**
 * Operation C: Database Indexes Pre-Flight Backup Script
 * Creates a verified server-side PocketBase backup and dumps existing index definitions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';

export async function runIndexesBackup(): Promise<{ backupKey: string; snapshotPath: string }> {
  console.log('\n==================================================');
  console.log('📦 OPERATION C: PRE-FLIGHT INDEXES BACKUP');
  console.log('==================================================\n');

  const pb = await getPbClient();
  const timestamp = Date.now().toString();
  const backupKey = `backup_indexes_${timestamp}.zip`;

  console.log(`Step 1: Creating verified server-side backup: ${backupKey}...`);
  await pb.backups.create(backupKey);

  const backups = await pb.backups.getFullList();
  const matched = backups.find((b) => b.key === backupKey);
  if (!matched || matched.size <= 0) {
    throw new Error(`FATAL: Backup ${backupKey} verification failed. Size: ${matched?.size ?? 0}`);
  }
  console.log(`   ✓ Server backup verified (${matched.size} bytes)\n`);

  console.log('Step 2: Dumping current index definitions across all collections...');
  const collections = await pb.collections.getFullList();
  const indexSnapshot: Record<string, { id: string; name: string; indexes: string[] }> = {};

  for (const col of collections) {
    indexSnapshot[col.name] = {
      id: col.id,
      name: col.name,
      indexes: col.indexes || [],
    };
    console.log(`   ✓ ${col.name}: ${(col.indexes || []).length} indexes recorded`);
  }

  const backupDir = path.join(process.cwd(), 'database/backups/indexes');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const snapshotPath = path.join(backupDir, `indexes_backup_${timestamp}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify({ timestamp: new Date().toISOString(), backupKey, collections: indexSnapshot }, null, 2), 'utf-8');
  console.log(`\n   ✓ Indexes state captured: ${snapshotPath}\n`);

  console.log('==================================================');
  console.log('✓ OPERATION C BACKUP & SNAPSHOT COMPLETE');
  console.log('==================================================\n');

  return { backupKey, snapshotPath };
}

if (process.argv[1] && process.argv[1].endsWith('phase1c-indexes-backup.ts')) {
  runIndexesBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal indexes backup error:', err);
      process.exit(1);
    });
}
