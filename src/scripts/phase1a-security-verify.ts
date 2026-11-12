/**
 * Operation A: Security Verification Script (55 Endpoints)
 * Verifies that unauthenticated public REST requests across all 11 collections are blocked (403/401).
 * Rejects 404 as false positive (BUG-023) and verifies superuser access is preserved.
 */

import fs from 'node:fs';
import path from 'node:path';

// 0. Auto-load .env.local if not already in process.env
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { getPbClient, PB_URL } from '../lib/pb';

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

export async function runSecurityVerify(): Promise<{
  passed: number;
  failed: number;
  leaks: string[];
  superuserHealthy: boolean;
}> {
  console.log('\n==================================================');
  console.log('🔍 OPERATION A: COMPREHENSIVE SECURITY VERIFICATION');
  console.log(`Target: ${PB_URL}`);
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;
  const leaks: string[] = [];

  console.log('--- Part 1: 55-Endpoint Unauthenticated Penetration Test ---');
  for (const col of TARGET_COLLECTIONS) {
    const fakeId = '000000000000000';
    const endpoints = [
      { op: 'LIST', method: 'GET', url: `${PB_URL}/api/collections/${col}/records?perPage=1` },
      { op: 'VIEW', method: 'GET', url: `${PB_URL}/api/collections/${col}/records/${fakeId}` },
      { op: 'CREATE', method: 'POST', url: `${PB_URL}/api/collections/${col}/records`, body: JSON.stringify({ test_probe: 'leak_check' }) },
      { op: 'UPDATE', method: 'PATCH', url: `${PB_URL}/api/collections/${col}/records/${fakeId}`, body: JSON.stringify({ test_probe: 'leak_check' }) },
      { op: 'DELETE', method: 'DELETE', url: `${PB_URL}/api/collections/${col}/records/${fakeId}` },
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, {
          method: ep.method,
          headers: ep.body ? { 'Content-Type': 'application/json' } : {},
          body: ep.body,
        });

        const status = res.status;

        // Pass condition: HTTP 403 Forbidden or 401 Unauthorized
        if (status === 403 || status === 401) {
          passed++;
        } else if (status === 404) {
          // BUG-023: Reject 404 as false positive for list/create or when rules should reject first
          failed++;
          const desc = `${col} ${ep.op} returned HTTP 404 (False positive check: endpoint or route misconfigured)`;
          leaks.push(desc);
          console.error(`   ✗ [FALSE POSITIVE] ${desc}`);
        } else if (status >= 200 && status < 300) {
          failed++;
          const desc = `${col} ${ep.op} LEAK: Returned HTTP ${status} (UNRESTRICTED PUBLIC ACCESS ACTIVE)`;
          leaks.push(desc);
          console.error(`   🚨 [CRITICAL LEAK] ${desc}`);
        } else {
          // Other unexpected status
          failed++;
          const desc = `${col} ${ep.op} unexpected status: HTTP ${status}`;
          leaks.push(desc);
          console.warn(`   ⚠️ ${desc}`);
        }
      } catch (err: any) {
        failed++;
        leaks.push(`${col} ${ep.op} network error: ${err.message}`);
      }
    }
    console.log(`   ✓ ${col}: 5/5 operations verified`);
  }

  console.log(`\nPart 1 Results: ${passed}/55 endpoints properly blocked. ${failed} defects/leaks detected.\n`);

  // Part 2: Superuser Connectivity Check
  console.log('--- Part 2: Superuser Client Verification ---');
  let superuserHealthy = false;
  try {
    const pb = await getPbClient();
    const testList = await pb.collection('courses').getList(1, 1);
    console.log(`   ✓ Superuser read successful (${testList.totalItems} courses accessible)`);
    superuserHealthy = true;
  } catch (err: any) {
    console.error(`   ✗ Superuser verification failed: ${err.message}`);
  }

  console.log('\n==================================================');
  console.log(`VERIFICATION SUMMARY:`);
  console.log(`Blocked Endpoints: ${passed}/55`);
  console.log(`Detected Leaks / Defects: ${failed}`);
  console.log(`Superuser Connectivity: ${superuserHealthy ? 'OK' : 'FAILED'}`);
  console.log('==================================================\n');

  return { passed, failed, leaks, superuserHealthy };
}

if (process.argv[1] && process.argv[1].endsWith('phase1a-security-verify.ts')) {
  runSecurityVerify()
    .then((res) => {
      if (res.failed > 0 || !res.superuserHealthy) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal verification error:', err);
      process.exit(1);
    });
}
