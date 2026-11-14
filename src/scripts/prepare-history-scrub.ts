/**
 * Helper & Pre-flight Script for Git History Scrubbing (BUG-042)
 *
 * Prepares the untracked git-filter-repo expressions file from .env.local
 * and verifies backup bundle presence before operator force-push.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BACKUP_BUNDLE = path.resolve(__dirname, '../../../syllabus-tracker-backup-complete.bundle');
const TMP_EXPRESSIONS_FILE = '/tmp/git-filter-replace-expressions.txt';

async function main() {
  console.log('\n============================================================');
  console.log('🛡️  BUG-042: GIT HISTORY SCRUB PREPARATION & PRE-FLIGHT');
  console.log('============================================================\n');

  // 1. Verify backup bundle exists
  console.log('1. Checking Full Git Bundle Backup...');
  if (!fs.existsSync(BACKUP_BUNDLE)) {
    console.error(`   ❌ Backup bundle not found at: ${BACKUP_BUNDLE}`);
    console.error('   Please run: git bundle create /home/ayush/.gemini/antigravity/scratch/syllabus-tracker-backup-complete.bundle --all');
    process.exit(1);
  }

  try {
    execSync(`git bundle verify "${BACKUP_BUNDLE}"`, { stdio: 'pipe' });
    const stat = fs.statSync(BACKUP_BUNDLE);
    console.log(`   ✓ Backup bundle verified: ${BACKUP_BUNDLE} (${(stat.size / 1024).toFixed(1)} KB)`);
  } catch (err: any) {
    console.error(`   ❌ Bundle verification failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Read secrets to scrub from .env.local
  console.log('\n2. Extracting secrets to redact from local environment...');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(`   ❌ .env.local not found at: ${envPath}`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const mPassMatch = envContent.match(/ADMIN_MASTER_PASSWORD=([^\r\n]+)/);
  const pbPassMatch = envContent.match(/PB_ADMIN_PASSWORD=([^\r\n]+)/);
  const oldSessionSecret = 'c68f9a2e1d4b8e7c5f3a0d9b8e7f6a5c4d3b2a1e0f9a8b7c6d5e4f3a2b1c0d9e';

  let masterPass = mPassMatch ? mPassMatch[1].trim() : '';
  let pbPass = pbPassMatch ? pbPassMatch[1].trim() : '';
  if (masterPass.startsWith('"') && masterPass.endsWith('"')) masterPass = masterPass.slice(1, -1);
  if (pbPass.startsWith('"') && pbPass.endsWith('"')) pbPass = pbPass.slice(1, -1);

  if (!masterPass || !pbPass) {
    console.error('   ❌ Could not resolve credentials from .env.local');
    process.exit(1);
  }

  // 3. Write untracked replacement expressions
  const expressions = [
    `${masterPass}==>[REDACTED_HISTORICAL_MASTER_PASSWORD]`,
    `${pbPass}==>[REDACTED_HISTORICAL_PB_PASSWORD]`,
    `${oldSessionSecret}==>[REDACTED_HISTORICAL_SESSION_SECRET]`,
  ].join('\n') + '\n';

  fs.writeFileSync(TMP_EXPRESSIONS_FILE, expressions, { mode: 0o600 });
  console.log(`   ✓ Replacement expressions written to untracked: ${TMP_EXPRESSIONS_FILE}`);

  // 4. Print Operator Instructions
  console.log('\n============================================================');
  console.log('📋 COORDINATED EXECUTION RUNBOOK FOR HUMAN OPERATOR:');
  console.log('============================================================');
  console.log(`
1. Ensure all team members have committed and pushed local changes, or saved uncommitted patches.
2. Confirm with the Academy Director their desired new ADMIN_MASTER_PASSWORD.
3. In Coolify console or via Coolify API:
   - Update ADMIN_MASTER_PASSWORD to the new value.
   - Update PB_ADMIN_PASSWORD to the new value after changing it in PocketBase (https://stracker.abhigyanintelligence.cloud/_/).
4. Run the history rewrite:
   python3 -m venv /tmp/filter_venv
   /tmp/filter_venv/bin/pip install git-filter-repo
   /tmp/filter_venv/bin/git-filter-repo --replace-text ${TMP_EXPRESSIONS_FILE} --force
   git remote add origin https://github.com/abhigyantool-code/Abhigyan-Academy-Syllabuss-Tracker.git
5. Verify unit tests:
   npm run test:unit
6. Force push with lease to GitHub:
   git push origin --force-with-lease --all
7. Delete temporary expressions file:
   rm -f ${TMP_EXPRESSIONS_FILE}
8. Have team members re-clone the repository:
   git clone https://github.com/abhigyantool-code/Abhigyan-Academy-Syllabuss-Tracker.git
9. Trigger a redeploy in Coolify to align container commit SHA:
   curl -X POST -H "Authorization: Bearer <TOKEN>" https://coolify.abhigyanintelligence.cloud/api/v1/deploy?uuid=pi2lobpfd3q6lr3hzinhkbs9
============================================================\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
