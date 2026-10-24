import fs from 'fs';
import path from 'path';
import { query } from '../lib/db';

async function runMigrations() {
  console.log('--- Starting Database Migrations ---');
  try {
    const baseDir = path.join(process.cwd(), 'database');

    const schemaSql = fs.readFileSync(path.join(baseDir, 'schema.sql'), 'utf-8');
    console.log('Applying schema.sql...');
    await query(schemaSql);

    const viewsSql = fs.readFileSync(path.join(baseDir, 'views.sql'), 'utf-8');
    console.log('Applying views.sql...');
    await query(viewsSql);

    const rlsSql = fs.readFileSync(path.join(baseDir, 'rls.sql'), 'utf-8');
    console.log('Applying rls.sql...');
    await query(rlsSql);

    console.log('✓ All migrations applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
