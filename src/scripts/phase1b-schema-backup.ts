/**
 * Operation B: Schema Pre-Flight Backup Script
 * Creates a verified server-side PocketBase backup and dumps relation target schemas.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';

export async function runSchemaBackup(): Promise<{ backupKey: string; snapshotPath: string }> {
  console.log('\n==================================================');
  console.log('📦 OPERATION B: PRE-FLIGHT SCHEMA BACKUP');
  console.log('==================================================\n');

  const pb = await getPbClient();
  const timestamp = Date.now().toString();
  const backupKey = `backup_schema_${timestamp}.zip`;

  console.log(`Step 1: Creating verified server-side backup: ${backupKey}...`);
  await pb.backups.create(backupKey);

  const backups = await pb.backups.getFullList();
  const matched = backups.find((b) => b.key === backupKey);
  if (!matched || matched.size <= 0) {
    throw new Error(`FATAL: Backup ${backupKey} verification failed. Size: ${matched?.size ?? 0}`);
  }
  console.log(`   ✓ Server backup verified (${matched.size} bytes)\n`);

  console.log('Step 2: Capturing schema state for relation targets...');
  const relationTargets = ['courses', 'teachers', 'subjects', 'topics'];
  const schemas: Record<string, any> = {};

  for (const colName of relationTargets) {
    const col = await pb.collections.getOne(colName);
    schemas[colName] = {
      id: col.id,
      name: col.name,
      fields: col.fields,
      indexes: col.indexes,
    };
  }

  const backupDir = path.join(process.cwd(), 'database/backups/schema');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const snapshotPath = path.join(backupDir, `target_schemas_${timestamp}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify({ timestamp: new Date().toISOString(), backupKey, schemas }, null, 2), 'utf-8');
  console.log(`   ✓ Schema state captured: ${snapshotPath}\n`);

  console.log('==================================================');
  console.log('✓ OPERATION B BACKUP & SNAPSHOT COMPLETE');
  console.log('==================================================\n');

  return { backupKey, snapshotPath };
}

if (process.argv[1] && process.argv[1].endsWith('phase1b-schema-backup.ts')) {
  runSchemaBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal schema backup error:', err);
      process.exit(1);
    });
}
