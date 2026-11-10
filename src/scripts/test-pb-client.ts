import PocketBase from 'pocketbase';
import fs from 'fs';

try {
  if (typeof (process as any).loadEnvFile === 'function') {
    if (fs.existsSync('.env.local')) (process as any).loadEnvFile('.env.local');
  }
} catch {}

const PB_URL = (process.env.POCKETBASE_URL || 'https://stracker.abhigyanintelligence.cloud').replace(/\/_\/?$/, '').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '';

async function test() {
  console.log('Testing PocketBase client connection to:', PB_URL);
  const pb = new PocketBase(PB_URL);

  // Authenticate
  await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('✓ Auth successful! Token valid:', pb.authStore.isValid);

  // Query Courses
  const courses = await pb.collection('courses').getFullList({ sort: 'sort_order' });
  console.log(`✓ Fetched ${courses.length} courses:`, courses.map(c => c.code).join(', '));

  // Query Teachers
  const teachers = await pb.collection('teachers').getFullList({ sort: 'name' });
  console.log(`✓ Fetched ${teachers.length} teachers:`, teachers.map(t => t.name).join(', '));

  // Query Sample Topics
  const topicsSample = await pb.collection('topics').getList(1, 5, { expand: 'subject' });
  console.log(`✓ Fetched ${topicsSample.totalItems} total topics in PocketBase!`);
  for (const t of topicsSample.items) {
    console.log(`   - Topic [seq: ${t.seq_no}]: "${t.name}" (Subject: ${(t.expand as any)?.subject?.name || t.subject})`);
  }
}

test().catch(console.error);
