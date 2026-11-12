/**
 * Operation A: Sequential Security Lockdown Script (BUG-001, BUG-044)
 * Sets listRule, viewRule, createRule, updateRule, deleteRule to null across all 11 collections.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getPbClient } from '../lib/pb';

const TARGET_COLLECTIONS = [
  'courses',
  'course_settings',
  'teachers',
  'students',
  'subjects',
  'teacher_subjects',
  'enrollments',
  'topics',
  'class_codes',
  'entries',
  'audit_log',
];

export async function runSecurityLockdown(snapshotPath?: string): Promise<{ locked: string[]; failed?: string }> {
  console.log('\n==================================================');
  console.log('🔒 OPERATION A: POCKETBASE API SECURITY LOCKDOWN');
  console.log('==================================================\n');

  const snapshotDir = path.join(process.cwd(), 'database/backups/security');

  // Verify snapshot existence
  if (!snapshotPath) {
    if (!fs.existsSync(snapshotDir)) {
      throw new Error(`Snapshot directory ${snapshotDir} does not exist. Run phase1a-security-backup.ts first.`);
    }
    const snapshots = fs.readdirSync(snapshotDir).filter((f) => f.startsWith('rules_snapshot_') && f.endsWith('.json'));
    if (snapshots.length === 0) {
      throw new Error('No rules snapshot found. Run phase1a-security-backup.ts before lockdown.');
    }
    snapshots.sort();
    snapshotPath = path.join(snapshotDir, snapshots[snapshots.length - 1]);
  }

  console.log(`Using verified pre-flight snapshot: ${snapshotPath}\n`);

  const pb = await getPbClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const progressPath = path.join(snapshotDir, `lockdown_progress_${timestamp}.json`);

  const progress: { locked: string[]; snapshotPath: string; status: string } = {
    locked: [],
    snapshotPath,
    status: 'in_progress',
  };

  for (const collectionName of TARGET_COLLECTIONS) {
    console.log(`Locking collection: ${collectionName}...`);
    try {
      await pb.collections.update(collectionName, {
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      });

      // Immediate read-back verification
      const updated = await pb.collections.getOne(collectionName);
      if (
        updated.listRule !== null ||
        updated.viewRule !== null ||
        updated.createRule !== null ||
        updated.updateRule !== null ||
        updated.deleteRule !== null
      ) {
        throw new Error(`Post-lock verification failed: rules were not set to null on ${collectionName}`);
      }

      progress.locked.push(collectionName);
      fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');
      console.log(`   ✓ ${collectionName}: All 5 rules set to null (Superuser-only)`);
    } catch (err: any) {
      progress.status = 'failed';
      fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');
      console.error(`\n❌ Failed locking ${collectionName}: ${err.message}`);
      console.error(`Execute rollback immediately:`);
      console.error(`npx tsx src/scripts/phase1a-security-rollback.ts --snapshot "${snapshotPath}"\n`);
      throw err;
    }
  }

  progress.status = 'completed';
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');

  // Record audit log entry
  try {
    await pb.collection('audit_log').create({
      action: 'SECURITY_LOCKDOWN_OPERATION_A',
      actor_type: 'admin',
      actor_id: 'system_security_lockdown',
      details: {
        lockedCollections: progress.locked,
        snapshotPath,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (auditErr: any) {
    console.warn('Audit logging note:', auditErr.message);
  }

  console.log('\n==================================================');
  console.log(`🎉 ALL ${progress.locked.length} COLLECTIONS SUCCESSFULLY LOCKED DOWN!`);
  console.log('Public REST API access severed. Superuser client retains access.');
  console.log('Next step: Run npx tsx src/scripts/phase1a-security-verify.ts');
  console.log('==================================================\n');

  return { locked: progress.locked };
}

if (process.argv[1] && process.argv[1].endsWith('phase1a-security-lockdown.ts')) {
  runSecurityLockdown()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal lockdown error:', err);
      process.exit(1);
    });
}
