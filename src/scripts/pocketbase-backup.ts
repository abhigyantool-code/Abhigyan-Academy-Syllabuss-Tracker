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

  // 1. Trigger server-side snapshot in PocketBase
  try {
    console.log(`📦 Creating server snapshot: ${backupName}...`);
    await pb.backups.create(backupName);
    console.log(`✓ Server-side snapshot created successfully on VPS.`);
  } catch (err: any) {
    console.warn(`⚠️ Server-side snapshot notice:`, err.message || err);
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
