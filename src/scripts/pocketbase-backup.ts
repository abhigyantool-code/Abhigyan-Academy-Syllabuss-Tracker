/**
 * PocketBase Backup Script
 * Creates a server-side zip snapshot on PocketBase and dumps JSON records locally.
 */

import fs from 'fs';
import path from 'path';
import { getPbClient } from '../lib/pb';
import { getTodayIST } from '../lib/date-utils';

async function main() {
  console.log('🔄 Initiating PocketBase Backup...');
  const pb = await getPbClient();
  const today = getTodayIST();
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '_').slice(0, 19);
  const backupName = `backup_${timestamp}.zip`;

  // 1. Trigger server-side snapshot in PocketBase with mandatory verification (BUG-021 Fix)
  console.log(`📦 Creating server snapshot: ${backupName}...`);
  try {
    await pb.backups.create(backupName);
    const backups = await pb.backups.getFullList();
    const created = backups.find((b) => b.key === backupName);
    if (!created || created.size <= 0) {
      throw new Error(`Backup verification failed: ${backupName} not found in PocketBase backups or has size 0.`);
    }
    console.log(`✓ Server-side snapshot created & verified successfully on VPS (${created.size} bytes).`);
  } catch (err: any) {
    console.error(`❌ FATAL: Server-side snapshot failed:`, err.message || err);
    throw err;
  }

  // 2. Local JSON Dump of All Collections for instant offline recovery
  const backupDir = path.join(process.cwd(), 'database/backups', today);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = [
    'courses',
    'course_settings',
    'teachers',
    'students',
    'enrollments',
    'subjects',
    'teacher_subjects',
    'topics',
    'entries',
    'class_codes',
    'audit_log',
    'teaching_records',
  ];

  console.log(`💾 Exporting JSON snapshots to ${backupDir}...`);
  for (const name of collections) {
    try {
      const records = await pb.collection(name).getFullList();
      const filePath = path.join(backupDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
      console.log(`   ✓ ${name}: ${records.length} records`);
    } catch (e: any) {
      console.error(`   ✗ Error backing up ${name}:`, e.message);
    }
  }

  console.log('\n🎉 PocketBase backup completed successfully!');
}

main().catch(console.error);
