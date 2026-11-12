# Phase 1 Script-by-Script Comprehensive Review & Safety Audit

**Document Status:** OFFICIAL SCRIPT AUDIT  
**Date:** 2026-11-11  
**Project:** Abhigyan Academy Syllabus Tracker  
**Target Environment:** PocketBase v0.28.2 (`https://stracker.abhigyanintelligence.cloud`)  
**Auditing Standard:** Strict Zero-Data-Loss & Production Safety Protocol  

---

## 1. Inventory & Inspection Summary

This document provides an independent technical review of every script associated with Phase 1. Two categories of scripts were audited:

1. **The 13 Prepared Phase 1 Scripts:** Designed in the Phase 1 Implementation Plan (`phase1_revised_plan.md`) across Operations A, B, and C.  
   *Critical Finding:* These 13 scripts are fully authored and reviewed as architectural artifacts, but **they exist only as embedded specifications in documentation; they have not yet been written to physical files in `src/scripts/` on disk.**
2. **The 12 Existing Scripts on Disk in `src/scripts/`:** Audited to evaluate legacy debt, backup practices, and potential confusion with obsolete PostgreSQL databases.

---

## 2. Review of the 13 Prepared Phase 1 Scripts

---

### Script 1: `src/scripts/phase1a-security-backup.ts`
- **1. Purpose:** Creates a Tier 1 PocketBase server-side zip backup and dumps a Tier 2 snapshot of exact collection API rules to JSON.
- **2. Expected Inputs:** Environment variables `POCKETBASE_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`.
- **3. Collections Affected:** Reads all 11 collections (`courses`, `course_settings`, `teachers`, `students`, `subjects`, `teacher_subjects`, `enrollments`, `topics`, `class_codes`, `entries`, `audit_log`).
- **4. Database Operations Performed:** `pb.backups.create(zipName)` (server-side zip creation); `pb.collections.getFullList()` (read-only query). Writes local JSON file `database/backups/security/rules_snapshot_<timestamp>.json`.
- **5. Permissions Required:** PocketBase Superuser (`_superusers` collection auth).
- **6. Preconditions:** PocketBase VPS has write permissions in `pb_data/backups/` and disk space available.
- **7. Backup Requirements:** None (this script is the pre-flight backup generator).
- **8. Failure Handling:** Catches backup creation exceptions and throws fatal error; queries `pb.backups.getFullList()` to verify non-zero size.
- **9. Rollback Method:** N/A (read-only plus backup creation).
- **10. Verification Procedure:** Confirms `foundBackup.size > 0` and local snapshot file existence.
- **11. Potential Data-Loss Risks:** Zero risk of data loss. Does not modify records or schema.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION (with recommendation to add offsite backup download).**

---

### Script 2: `src/scripts/phase1a-security-lockdown.ts`
- **1. Purpose:** Sets all API rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) to `null` across all 11 collections, restricting direct REST access to superusers only.
- **2. Expected Inputs:** Superuser credentials, validated snapshot path from Script 1.
- **3. Collections Affected:** All 11 application collections updated.
- **4. Database Operations Performed:** Sequential `pb.collections.update(name, { listRule: null, ... })`; writes `lockdown_progress_<timestamp>.json`; creates row in `audit_log`.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Script 1 (`phase1a-security-backup.ts`) must have completed successfully.
- **7. Backup Requirements:** Mandatory pre-flight snapshot path verified on disk before loop starts.
- **8. Failure Handling:** Sequential tracking in `lockdown_progress.json`. If update fails at collection #N, halts immediately, logs failure, and outputs exact rollback command.
- **9. Rollback Method:** Execute `phase1a-security-rollback.ts --snapshot <snapshotPath>`.
- **10. Verification Procedure:** Immediately reads back collection definition via `pb.collections.getOne(name)` and asserts all 5 rules evaluate to `null`.
- **11. Potential Data-Loss Risks:** No record data is modified or deleted. Risk is limited to temporary service denial for public endpoints if client components rely on direct PocketBase REST calls (audited: Next.js uses server actions, so zero impact).
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION (strictly sequential, verified per step).**

---

### Script 3: `src/scripts/phase1a-security-rollback.ts`
- **1. Purpose:** Restores PocketBase collection rules to their exact pre-lockdown state from a verified snapshot JSON file.
- **2. Expected Inputs:** CLI argument `--snapshot <path-to-rules_snapshot_*.json>`.
- **3. Collections Affected:** All 11 application collections.
- **4. Database Operations Performed:** `pb.collections.update(name, { listRule, viewRule, ... })` restoring exact snapshot values; writes `rollback_progress_<timestamp>.json`.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Snapshot file exists, is valid JSON, contains all 11 collections, and has valid rule types.
- **7. Backup Requirements:** Valid pre-operation snapshot file.
- **8. Failure Handling:** Rejects missing snapshot, corrupted JSON, or missing collections. Halts on first failure, logs progress.
- **9. Rollback Method:** Re-run script pointing to a verified baseline snapshot.
- **10. Verification Procedure:** Re-queries live collections and asserts exact character-for-character match with snapshot rules.
- **11. Potential Data-Loss Risks:** Zero record data loss. Prior flaw of defaulting missing rules to `""` was eliminated.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION.**

---

### Script 4: `src/scripts/phase1a-security-verify.ts`
- **1. Purpose:** Exhaustively audits security lockdown across 55 endpoints (11 collections x 5 operations: List, View, Create, Update, Delete) via unauthenticated REST requests. Verifies superuser client connectivity and `/submit` data privacy.
- **2. Expected Inputs:** `PB_URL`.
- **3. Collections Affected:** None (read-only and probe rejections).
- **4. Database Operations Performed:** 55 unauthenticated HTTP fetch requests; superuser `getList(1, 1)` reads; Next.js `getSubmitFormData()` call.
- **5. Permissions Required:** Unauthenticated for Part 1; Superuser for Part 2.
- **6. Preconditions:** Script 2 (`phase1a-security-lockdown.ts`) completed.
- **7. Backup Requirements:** None.
- **8. Failure Handling:** Accumulates `leakCount`. Throws fatal error if any endpoint returns a status other than 403 or 401. Rejects HTTP 404 as a false positive.
- **9. Rollback Method:** N/A (read-only verification).
- **10. Verification Procedure:** Verifies every endpoint returns HTTP 403 Forbidden.
- **11. Potential Data-Loss Risks:** Zero risk.
- **12. Production Safety Verdict:** **UNSAFE FOR EXECUTION IN CURRENT STATE (`BUG-034`).**  
  *Audit Defect Found:* Line 429 executes `import { getPbClient, PB_URL } from '../lib/pb';`. However, `PB_URL` is NOT exported in `src/lib/pb.ts` (declared as private `const PB_URL`). Executing this script will throw a fatal Node.js module export error: `SyntaxError: The requested module '../lib/pb' does not provide an export named 'PB_URL'`.  
  *Required Correction:* Add `export const PB_URL = ...;` to `src/lib/pb.ts` before placing script on disk.

---

### Script 5: `src/scripts/phase1b-schema-backup.ts`
- **1. Purpose:** Creates a Tier 1 PocketBase server-side zip backup and dumps relation target schemas (`courses`, `teachers`, `subjects`, `topics`) prior to creating `teaching_records`.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** Reads relation target collections.
- **4. Database Operations Performed:** `pb.backups.create('backup_schema_<timestamp>.zip')`; schema export to `database/backups/schema/`.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Operation A completed and verified.
- **7. Backup Requirements:** Self-generating.
- **8. Failure Handling:** Throws fatal error if backup creation fails or returns 0 bytes.
- **9. Rollback Method:** N/A.
- **10. Verification Procedure:** Confirms backup key in `getFullList()` with `size > 0`.
- **11. Potential Data-Loss Risks:** Zero risk.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION.**

---

### Script 6: `src/scripts/phase1b-schema-create.ts`
- **1. Purpose:** Creates the new `teaching_records` base collection with locked API rules (`null`), 20 defined fields, verified foreign key relations, and soft-void defaults.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** Creates new collection `teaching_records`.
- **4. Database Operations Performed:** `pb.collections.create(payload)`; writes audit log.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Target relation collections (`courses`, `teachers`, `subjects`, `topics`) exist. `teaching_records` does not already exist.
- **7. Backup Requirements:** Script 5 backup verified.
- **8. Failure Handling:** Checks if collection already exists (skips safely); throws fatal error on validation failure.
- **9. Rollback Method:** Run `phase1b-schema-rollback.ts`.
- **10. Verification Procedure:** Immediately reads back collection definition, asserting all 20 fields and locked rules exist.
- **11. Potential Data-Loss Risks:** Zero risk to existing collections. Creates an isolated new collection.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION.**

---

### Script 7: `src/scripts/phase1b-schema-rollback.ts`
- **1. Purpose:** Deletes the `teaching_records` collection if creation fails or must be reverted.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** Deletes `teaching_records`.
- **4. Database Operations Performed:** `pb.collection('teaching_records').getList(1, 1)`; `pb.collections.delete(col.id)`.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Safety check: collection must contain **0 records**. If any real records exist, script aborts immediately.
- **7. Backup Requirements:** Verified Tier 1 backup.
- **8. Failure Handling:** Refuses to delete non-empty collection.
- **9. Rollback Method:** Restore from Tier 1 backup.
- **10. Verification Procedure:** Confirms 404 response on collection get.
- **11. Potential Data-Loss Risks:** Guarded against data loss via explicit row-count check.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION.**

---

### Script 8: `src/scripts/phase1b-schema-verify.ts`
- **1. Purpose:** Validates `teaching_records` collection field defaults, tests soft-void lifecycle with mandatory `void_reason`, and verifies relation constraints.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** `teaching_records` (temporary probe record).
- **4. Database Operations Performed:** Inserts probe record (`PROBE_VERIFY_<timestamp>`); updates with soft-void metadata; deletes probe in `finally` block.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** `teaching_records` exists. Active courses, teachers, subjects exist.
- **7. Backup Requirements:** None.
- **8. Failure Handling:** Probe deletion is enclosed in guaranteed `try ... finally` block.
- **9. Rollback Method:** Manual deletion of probe record if process killed before `finally`.
- **10. Verification Procedure:** Verifies `is_voided: true`, `void_reason` matches, and probe record is removed.
- **11. Potential Data-Loss Risks:** Low. However, audit identified that it queries real academy courses (`courses[0]`) to obtain foreign keys. If process is terminated via `SIGKILL`, probe record remains.
- **12. Production Safety Verdict:** **CONDITIONALLY SAFE.** (Recommended correction: use dedicated test course fixture or purge orphaned probes on boot).

---

### Script 9: Server Action — `voidTeachingRecordAction` (Proposed in Plan; NOT in `src/app/actions/admin-actions.ts`)
- **1. Purpose:** Application-level server action to safely soft-void a teaching record with mandatory `void_reason` validation (min 10 characters), audit logging, and authorization checks.
- **2. Expected Inputs:** `recordId: string`, `voidReason: string`.
- **3. Collections Affected:** `teaching_records`, `audit_log`.
- **4. Database Operations Performed:** `pb.collection('teaching_records').update(recordId, { is_voided: true, voided_at, voided_by, void_reason })`; `logAudit(...)`.
- **5. Permissions Required:** Authenticated session with role `'admin'` or `'faculty'`.
- **6. Preconditions:** Session valid; record exists; record not already voided; reason >= 10 chars.
- **7. Backup Requirements:** N/A (application code).
- **8. Failure Handling:** Validates inputs and throws descriptive errors before updating.
- **9. Rollback Method:** Inverse update or database restore.
- **10. Verification Procedure:** Unit tests verifying reason validation, duplicate void rejection, and audit log row creation.
- **11. Potential Data-Loss Risks:** Zero. Never deletes records physically; performs non-destructive soft-voiding.
- **12. Production Safety Verdict:** **UNSAFE UNTIL CORRECTED (`BUG-035`).**  
  *Audit Defects Found:*  
  1. The prior report claimed this server action was already inspected in `src/app/actions/admin-actions.ts`. In reality, `src/app/actions/admin-actions.ts` ends at line 863; this function DOES NOT EXIST in the codebase yet.  
  2. Line 886 of `phase1_revised_plan.md` proposes `const session = await requireAccess(['admin', 'faculty']);`. However, `requireAccess` in `src/lib/auth-guard.ts` accepts only a single `AccessArea` string (`'admin' | 'faculty' | 'dashboard' | 'submit'`). Passing an array fails TypeScript compilation and at runtime causes the function to fall through all security checks to default case 4 (`submit`), granting public unauthenticated execution without authorization!  
  *Required Correction:* Rewrite authorization guard to `const session = await getSession(); if (!session || (session.role !== 'admin' && session.role !== 'faculty')) throw new Error('Unauthorized');`.

---

### Script 10: `src/scripts/phase1c-indexes-preflight.ts`
- **1. Purpose:** Read-only scanner that evaluates all candidate unique index combinations across all collections (including partial index filter `WHERE is_voided = 0`). Reports duplicate record IDs and halts execution if conflicts exist.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** None (read-only scan).
- **4. Database Operations Performed:** `pb.collection(name).getFullList()`; in-memory map grouping. Writes `database/backups/indexes/duplicate_preflight_report_<timestamp>.json`.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Target collections exist.
- **7. Backup Requirements:** None (read-only).
- **8. Failure Handling:** Throws error if any collection read fails; returns structured `DuplicateReport`.
- **9. Rollback Method:** N/A.
- **10. Verification Procedure:** Asserts `totalDuplicates === 0`.
- **11. Potential Data-Loss Risks:** Zero risk. Explicitly read-only; never deletes or modifies records.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION.**

---

### Script 11: `src/scripts/phase1c-indexes-backup.ts`
- **1. Purpose:** Creates a Tier 1 PocketBase server-side zip backup and dumps baseline database index definitions for all collections into JSON.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** Reads index definitions across all collections.
- **4. Database Operations Performed:** `pb.backups.create('backup_indexes_<timestamp>.zip')`; writes `database/backups/indexes/indexes_backup_<timestamp>.json`.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** PocketBase connection valid.
- **7. Backup Requirements:** Self-generating.
- **8. Failure Handling:** Throws fatal error if zip backup fails or has 0 bytes.
- **9. Rollback Method:** N/A.
- **10. Verification Procedure:** Verifies backup existence and local JSON snapshot.
- **11. Potential Data-Loss Risks:** Zero risk.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION.**

---

### Script 12: `src/scripts/phase1c-indexes-create.ts`
- **1. Purpose:** Applies unique, partial unique, and query performance indexes across 8 collections in SQLite.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** `teaching_records`, `entries`, `topics`, `teacher_subjects`, `enrollments`, `subjects`, `course_settings`, `class_codes`, `audit_log`.
- **4. Database Operations Performed:** Automatically runs duplicate preflight (Step 1); runs index backup (Step 2); executes `pb.collections.update(id, { indexes })` per collection; writes audit log.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Duplicate preflight passes with 0 duplicates.
- **7. Backup Requirements:** Mandatory pre-flight snapshot path verified.
- **8. Failure Handling:** If SQLite rejects an index, catches error, halts immediately without touching remaining collections, and provides rollback command.
- **9. Rollback Method:** Run `phase1c-indexes-rollback.ts --snapshot <snapshotPath>`.
- **10. Verification Procedure:** Immediately queries each collection and asserts index count increased.
- **11. Potential Data-Loss Risks:** Creating unique indexes on non-empty tables aborts if duplicates exist (guarded by preflight). Does not modify data rows.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION (after adding `course_settings` unique index).**

---

### Script 13: `src/scripts/phase1c-indexes-rollback.ts`
- **1. Purpose:** Restores original index arrays for all collections from baseline snapshot JSON file.
- **2. Expected Inputs:** CLI argument `--snapshot <path-to-indexes_backup_*.json>`.
- **3. Collections Affected:** All modified collections.
- **4. Database Operations Performed:** `pb.collections.update(name, { indexes: snapshot.indexes })`.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Snapshot file exists and contains valid index definitions.
- **7. Backup Requirements:** Verified baseline index snapshot.
- **8. Failure Handling:** Validates snapshot structure; halts on error; writes rollback progress log.
- **9. Rollback Method:** Re-run with valid snapshot.
- **10. Verification Procedure:** Re-queries collections and verifies active index strings match snapshot exactly.
- **11. Potential Data-Loss Risks:** Zero record data loss.
- **12. Production Safety Verdict:** **SAFE FOR EXECUTION.**

---

### Script 14: `src/scripts/phase1c-indexes-verify.ts`
- **1. Purpose:** Verifies all expected indexes exist in PocketBase and conducts an isolated uniqueness constraint enforcement test.
- **2. Expected Inputs:** Superuser credentials.
- **3. Collections Affected:** `teachers`, `subjects`, `teacher_subjects` (temporary probe records).
- **4. Database Operations Performed:** Reads collection index definitions; creates test teacher, test subject, and primary relation; attempts duplicate relation insert; asserts PocketBase returns HTTP 400 validation error; cleans up all test fixtures in `finally` block.
- **5. Permissions Required:** PocketBase Superuser.
- **6. Preconditions:** Operation C index creation completed.
- **7. Backup Requirements:** None.
- **8. Failure Handling:** Guaranteed fixture cleanup in `try ... finally`. Specifically verifies `err instanceof ClientResponseError && err.status === 400`.
- **9. Rollback Method:** Manual deletion of test fixtures if process killed before `finally`.
- **10. Verification Procedure:** Confirms index strings match expected list; confirms duplicate insert is rejected with 400; confirms test fixtures are deleted.
- **11. Potential Data-Loss Risks:** Relational contamination risk (`BUG-024`): links test subject to `courses[0]`. Test fixtures must be isolated from production courses.
- **12. Production Safety Verdict:** **CONDITIONALLY SAFE.** (Recommended correction: create isolated test course as parent fixture).

---

## 3. Review of the 12 Existing Scripts on Disk in `src/scripts/`

The project root currently contains 12 script files. An audit was conducted on each:

| Script Name | Target Database | Safety Assessment & Finding | Required Action |
|---|---|---|---|
| `pocketbase-backup.ts` | PocketBase | **VULNERABLE (`BUG-021`):** Wraps `pb.backups.create()` in `try...catch` logging `console.warn` without halting. Confuses app zip with VPS snapshot. | Replace with `phase1a-security-backup.ts`. |
| `pocketbase-setup.ts` | PocketBase | **HIGH RISK:** Contains initial seed and schema logic. Running on production risks overwriting existing courses or teachers. | Keep archived; do NOT run in production. |
| `test-pb-client.ts` | PocketBase | **SAFE:** Pure read-only query testing superuser auth and course/topic counts. | Retain as diagnostic utility. |
| `migrate.ts` | PostgreSQL | **OBSOLETE (`BUG-028`):** Executes PostgreSQL `schema.sql`, `views.sql`, `rls.sql` against dead PostgreSQL pool. | Archive / remove from `package.json`. |
| `seed.ts` | PostgreSQL | **OBSOLETE (`BUG-028`):** Seeds mock PostgreSQL data. | Archive / remove from `package.json`. |
| `test-api.ts` | PostgreSQL | **OBSOLETE & UNSAFE:** Runs SQL queries against PostgreSQL and deletes records (`DELETE FROM entries`). | Archive / remove from `package.json`. |
| `cleanup-mock-and-ingest-real.ts` | PostgreSQL | **OBSOLETE:** Imports `../lib/db` and mutates PostgreSQL tables. | Archive. |
| `ingest-maths-planners.ts` | PostgreSQL | **OBSOLETE:** Imports `../lib/db`. | Archive. |
| `ingest-nda-foundation-syllabus.ts` | PostgreSQL | **OBSOLETE:** Imports `../lib/db`. | Archive. |
| `ingest-real-students.ts` | PostgreSQL | **OBSOLETE:** Imports `../lib/db`. | Archive. |
| `propagate-common-syllabus.ts` | PostgreSQL | **OBSOLETE:** Imports `../lib/db`. | Archive. |
| `setup-real-academy-data.ts` | PostgreSQL | **OBSOLETE:** Imports `../lib/db`. | Archive. |

---

## 4. Script Consistency & Standards Alignment

All 13 Phase 1 scripts were audited against standard criteria:

1. **Collection Inventory Alignment:** All scripts use the verified 11-collection list (`courses`, `course_settings`, `teachers`, `students`, `subjects`, `teacher_subjects`, `enrollments`, `topics`, `class_codes`, `entries`, `audit_log`). Phantom `system_config` is completely absent.
2. **Superuser Authentication Method:** All scripts use the centralized `getPbClient()` singleton from `src/lib/pb.ts`, which authenticates via `_superusers` collection.
3. **Backup Checkpoints:** Every mutating operation (A, B, C) enforces a verified pre-flight backup check before executing any write calls.
4. **Error Handling & Classification:** Scripts throw explicit, unswallowed exceptions on any non-200 response, avoiding generic `catch {}` masking.
5. **Rollback Design:** Rollback scripts strictly load point-in-time snapshot JSON manifests and never fallback to empty string `""`.
