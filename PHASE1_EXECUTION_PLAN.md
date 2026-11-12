# Phase 1 Execution Plan — Syllabus Tracker Security Lockdown, Schema Creation & Database Indexing

**Document Status:** OPERATIONAL EXECUTION PLAN  
**Date:** 2026-11-11  
**Project:** Abhigyan Academy Syllabus Tracker  
**Target Environment:** Hostinger VPS / Coolify / PocketBase v0.28.2 (`https://stracker.abhigyanintelligence.cloud`)  
**Execution Guard:** **STRICT READ-ONLY MODE MAINTAINED UNTIL EXPLICIT OPERATOR APPROVAL. DO NOT EXECUTE WITHOUT SIGN-OFF.**

---

## 1. Executive Overview & Sequence

Phase 1 establishes a secure, robust foundation for the Syllabus Tracker database without risking existing academy data. Phase 1 executes three sequential operations:

```
[ Preconditions & Offsite Backup ]
                |
                v
+-------------------------------------------------------+
| Operation A: PocketBase API Security Lockdown         |
|  1. Pre-flight Backup & Snapshot                      |
|  2. Sequential Rule Lockdown (all rules -> null)       |
|  3. Immediate Per-Collection Verification              |
|  4. 55-Endpoint Unauthenticated Penetration Test      |
+-------------------------------------------------------+
                |
                v
+-------------------------------------------------------+
| Operation B: `teaching_records` Collection Creation   |
|  1. Pre-flight Schema Backup                          |
|  2. Create Collection with Locked Rules (null)        |
|  3. Verify Schema, Relations & Soft-Void Defaults     |
|  4. Verify Isolated Lifecycle Probe                   |
+-------------------------------------------------------+
                |
                v
+-------------------------------------------------------+
| Operation C: Database Index Creation & Preflight      |
|  1. Read-Only Duplicate Preflight Scan                |
|  2. Pre-flight Index State Backup                     |
|  3. Apply Unique & Performance Indexes                |
|  4. Verify Constraints via Isolated Probe Tests       |
+-------------------------------------------------------+
                |
                v
[ Phase 1 Post-Execution Audit & Director Sign-Off ]
```

---

## 2. Mandatory Preconditions Checklist

Before launching any Phase 1 script, the operator and lead engineer must confirm every item below:

- [ ] **Precondition 1 — Live PocketBase Access:** PocketBase is healthy at `https://stracker.abhigyanintelligence.cloud/api/health`.
- [ ] **Precondition 2 — Superuser Authentication Verified:** Valid superuser credentials configured in `.env.local` (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`).
- [ ] **Precondition 3 — Script Files Placed on Disk & Compiling:** All 13 TypeScript scripts saved to `src/scripts/`, `export const PB_URL` added to `src/lib/pb.ts` (`BUG-034`), and type-checked via `npx tsc --noEmit`.
- [ ] **Precondition 4 — Server Action Auth Guard Validated:** `voidTeachingRecordAction` refactored to use valid session check instead of passing string array to `requireAccess` (`BUG-035`).
- [ ] **Precondition 5 — Prohibit Restoration of Outdated Backup:** `backup_1794303176111.zip` blacklisted from recovery procedures because it predates genuine entry `pogx003bic5x4pi` by 2.5 hours (`BUG-033`).
- [ ] **Precondition 6 — Fresh Tier 1 Backup Created & Verified:** A new PocketBase zip backup captured containing all current entries and verified non-zero.
- [ ] **Precondition 7 — VPS Hypervisor Disk Snapshot (Tier 3):** An out-of-band VPS snapshot or Hostinger backup completed via VPS panel.
- [ ] **Precondition 8 — Verified Duplicate Preflight:** `phase1c-indexes-preflight.ts` has executed in read-only mode and confirmed 0 duplicates across all target collections.
- [ ] **Precondition 9 — Two Genuine Student Records Verified:** Confirmed IDs `7lhmo4p1mzkw9w2` and `pogx003bic5x4pi` exist intact in `entries`.
- [ ] **Precondition 10 — Dashboard Metric Migration Handshake:** Verify `src/lib/dashboard-data.ts` update plan is ready so removing entries does not zero out progress metrics (`BUG-036`).
- [ ] **Precondition 11 — Director Written Authorization:** Written approval received from the Academy Director to execute Phase 1.

---

## 3. Disaster Recovery & Backup Architecture

Phase 1 uses a 3-tier disaster recovery architecture:

```
+--------------------------------------------------------------------------+
| Tier 3: Infrastructure / VPS Hypervisor Snapshot (Pre-Execution)         |
|  - Scope: Complete VPS disk image taken via Hostinger / Coolify panel.   |
|  - Recovery: Total system rollback to snapshot if VPS filesystem corrupts.|
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
| Tier 1: PocketBase Server-Side Zip Backup (`pb.backups.create()`)        |
|  - Scope: Complete SQLite data folder zip stored in `pb_data/backups/`.  |
|  - Verification: Check `size > 0`, download zip locally, verify archive. |
|  - Recovery: Point-in-time disaster restore via `pb.backups.restore()`.  |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
| Tier 2: Operation-Specific Point-in-Time JSON Snapshots                  |
|  - Scope: Local JSON dumps of exact live API rules, schemas, and indexes.|
|  - Storage: `database/backups/<operation>/`                              |
|  - Recovery: Surgical rollback scripts (`phase1a-security-rollback.ts`). |
+--------------------------------------------------------------------------+
```

---

## 4. Detailed Step-by-Step Execution Plan

### Operation A — PocketBase API Security Lockdown

**Objective:** Secure all 11 active application collections by changing all API rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) from `""` to `null` (Superuser-only).

#### Step A.1: Pre-Flight Backup & Snapshot
- **Command:** `npx tsx src/scripts/phase1a-security-backup.ts`
- **Actions:**
  1. Calls `pb.backups.create('backup_security_<timestamp>.zip')`.
  2. Queries `pb.backups.getFullList()` and verifies backup exists with `size > 0`.
  3. Dumps exact API rules for all 11 collections into `database/backups/security/rules_snapshot_<timestamp>.json`.
  4. Asserts all 11 collections exist and rules are preserved without coercion.
- **Pass Criteria:** Tier 1 backup confirmed on VPS, rules JSON written, returns snapshot path.
- **On Failure:** Halt immediately. Do not proceed to Step A.2.

#### Step A.2: Sequential Security Lockdown
- **Command:** `npx tsx src/scripts/phase1a-security-lockdown.ts`
- **Actions:**
  1. Initializes progress tracker: `database/backups/security/lockdown_progress_<timestamp>.json`.
  2. Iterates over 11 collections: `courses`, `course_settings`, `teachers`, `students`, `subjects`, `teacher_subjects`, `enrollments`, `topics`, `class_codes`, `entries`, `audit_log`.
  3. Updates each collection to `{ listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }`.
  4. Immediately fetches updated collection definition and verifies all 5 rules evaluate to `null`.
  5. Records audit log in `audit_log` collection.
- **Pass Criteria:** All 11 collections verified locked with `null` rules.
- **On Failure:** Script halts immediately on first error. Run rollback command displayed in terminal.

#### Step A.3: Comprehensive Security Verification (55 Endpoints)
- **Command:** `npx tsx src/scripts/phase1a-security-verify.ts`
- **Actions:**
  1. Tests unauthenticated access across all 11 collections for List, View, Create, Update, Delete (55 endpoint checks).
  2. Asserts HTTP 403 Forbidden on all 55 endpoints. Explicitly rejects HTTP 404 as a false positive.
  3. Verifies authenticated superuser client retains full read/write access.
  4. Audits `/submit` data loader to ensure student PINs are not exposed.
- **Pass Criteria:** 55/55 endpoints return HTTP 403/401; 0 leaks detected.
- **On Failure:** Review leaked endpoint; trigger Operation A Rollback.

---

### Operation B — `teaching_records` Collection Creation

**Objective:** Deploy an independent collection to track teacher syllabus instruction sessions, resolving `BUG-009` and enabling migration of fabricated entries.

#### Step B.1: Pre-Flight Schema Backup
- **Command:** `npx tsx src/scripts/phase1b-schema-backup.ts`
- **Actions:**
  1. Calls `pb.backups.create('backup_schema_<timestamp>.zip')` and verifies `size > 0`.
  2. Dumps collection schemas for relation targets (`courses`, `teachers`, `subjects`, `topics`) to `database/backups/schema/`.
- **Pass Criteria:** Tier 1 backup verified; schema state captured.

#### Step B.2: Schema Creation Execution
- **Command:** `npx tsx src/scripts/phase1b-schema-create.ts`
- **Actions:**
  1. Confirms target collections exist and retrieves their collection IDs.
  2. Submits creation payload for `teaching_records` with locked rules (`null` across all 5 operations).
  3. Defines all 20 required fields:
     - `session_id` (text, required, min: 8, max: 64)
     - `session_number` (number, required, min: 1, max: 20)
     - `teacher` (relation -> `teachers`, required)
     - `course` (relation -> `courses`, required)
     - `subject` (relation -> `subjects`, required)
     - `topic` (relation -> `topics`, required)
     - `session_date` (text, required, format: `YYYY-MM-DD`)
     - `session_type` (select: `lecture`, `revision`, `doubt_clearing`, `test_discussion`, `lab_practical`)
     - `status` (select: `completed`, `in_progress`, `partially_covered`, `recap_only`, `cancelled`)
     - `duration_minutes` (number, required, min: 15, max: 480)
     - `batch` (text, optional)
     - `attendance_count` (number, optional, min: 0)
     - `remarks` (text, optional, max: 1000)
     - `is_voided` (bool, required: false)
     - `voided_at` (text, optional)
     - `voided_by` (text, optional)
     - `void_reason` (text, optional, max: 500)
     - `correction_of` (text, optional, max: 15)
     - `version` (number, required, min: 1)
     - `source` (select: `teacher_portal`, `admin_entry`, `system_migration`)
  4. Immediately re-reads collection from PocketBase and verifies field count and types.
- **Pass Criteria:** `teaching_records` created with ID returned and locked rules confirmed.

#### Step B.3: Schema & Lifecycle Verification
- **Command:** `npx tsx src/scripts/phase1b-schema-verify.ts`
- **Actions:**
  1. Verifies `is_voided` has `required: false`.
  2. Inserts temporary probe record using dedicated test identifiers.
  3. Tests soft-void update lifecycle: updates `is_voided: true`, sets `void_reason` (min 10 characters).
  4. Guaranteed cleanup of test probe in `try ... finally`.
- **Pass Criteria:** Probe insert, update, soft-void, and cleanup succeed without errors.

---

### Operation C — Database Index Creation & Preflight Checks

**Objective:** Apply partial unique indexes, foreign key lookup indexes, and performance indexes across all collections, resolving `BUG-013` and `BUG-030`.

#### Step C.1: Read-Only Duplicate Preflight Scan
- **Command:** `npx tsx src/scripts/phase1c-indexes-preflight.ts`
- **Actions:**
  1. Scans all candidate unique index combinations across all collections.
  2. Evaluates partial index filters (`WHERE is_voided = 0`).
  3. Asserts 0 duplicates exist.
- **Pass Criteria:** `Total Duplicates: 0` reported.
- **On Failure:** Abort index creation immediately. Do not modify or delete any records.

#### Step C.2: Pre-Flight Index Backup
- **Command:** `npx tsx src/scripts/phase1c-indexes-backup.ts`
- **Actions:**
  1. Calls `pb.backups.create('backup_indexes_<timestamp>.zip')` and verifies `size > 0`.
  2. Dumps existing index definitions from all collections into `database/backups/indexes/indexes_backup_<timestamp>.json`.
- **Pass Criteria:** Tier 1 backup verified; baseline indexes snapshot written.

#### Step C.3: Index Creation Execution
- **Command:** `npx tsx src/scripts/phase1c-indexes-create.ts`
- **Actions:**
  Applies index definitions to PocketBase collections:
  - **`teaching_records`:**
    - `CREATE UNIQUE INDEX idx_tr_session_id ON teaching_records (session_id)`
    - `CREATE UNIQUE INDEX idx_tr_teacher_topic_date_session_active ON teaching_records (teacher, topic, session_date, session_number) WHERE is_voided = 0`
    - `CREATE INDEX idx_tr_teacher_date ON teaching_records (teacher, session_date)`
    - `CREATE INDEX idx_tr_course_date ON teaching_records (course, session_date)`
    - `CREATE INDEX idx_tr_topic ON teaching_records (topic)`
    - `CREATE INDEX idx_tr_subject ON teaching_records (subject)`
    - `CREATE INDEX idx_tr_status_active ON teaching_records (status) WHERE is_voided = 0`
  - **`entries`:**
    - `CREATE UNIQUE INDEX idx_entries_student_topic_date ON entries (student, topic, class_date)`
    - `CREATE INDEX idx_entries_course_date ON entries (course, class_date)`
    - `CREATE INDEX idx_entries_teacher ON entries (teacher)`
    - `CREATE INDEX idx_entries_topic ON entries (topic)`
    - `CREATE INDEX idx_entries_review_status ON entries (review_status)`
  - **`topics`:**
    - `CREATE UNIQUE INDEX idx_topics_subject_seq ON topics (subject, seq_no)`
  - **`teacher_subjects`:**
    - `CREATE UNIQUE INDEX idx_teacher_subjects_pair ON teacher_subjects (teacher, subject)`
    - `CREATE INDEX idx_teacher_subjects_subject ON teacher_subjects (subject)`
  - **`enrollments`:**
    - `CREATE UNIQUE INDEX idx_enrollments_student_course ON enrollments (student, course)`
    - `CREATE INDEX idx_enrollments_course ON enrollments (course)`
  - **`subjects`:**
    - `CREATE UNIQUE INDEX idx_subjects_course_name ON subjects (course, name)`
  - **`course_settings`:**
    - `CREATE UNIQUE INDEX idx_course_settings_course ON course_settings (course)`
  - **`class_codes`:**
    - `CREATE INDEX idx_class_codes_course_date ON class_codes (course, class_date)`
    - `CREATE INDEX idx_class_codes_code ON class_codes (code)`
  - **`audit_log`:**
    - `CREATE INDEX idx_audit_log_entity ON audit_log (entity, entity_id)`
- **Pass Criteria:** All collections report updated indexes; immediate re-read confirms active indexes.

#### Step C.4: Index Verification & Constraint Enforcement
- **Command:** `npx tsx src/scripts/phase1c-indexes-verify.ts`
- **Actions:**
  1. Verifies all expected index names exist in SQLite index lists.
  2. Performs isolated constraint rejection test: inserts a dedicated probe pair into `teacher_subjects`, attempts duplicate insert, asserts PocketBase rejects with HTTP 400 validation error.
  3. Enforces guaranteed fixture cleanup in `try ... finally`.
- **Pass Criteria:** Index existence verified; duplicate insert rejected; probe fixtures cleanly deleted.

---

## 5. Rollback Procedures & Runbooks

If any operation fails or encounters an unhandled exception, execution must halt immediately. Follow these exact rollback runbooks:

### Runbook A: Operation A Rollback (Security Rules)
- **Trigger:** Operation A halts halfway or verification detects an unexpected rule state.
- **Rollback Command:**
  ```bash
  npx tsx src/scripts/phase1a-security-rollback.ts --snapshot database/backups/security/rules_snapshot_<timestamp>.json
  ```
- **Execution:**
  1. Script loads the verified snapshot JSON.
  2. Restores exact original rule strings for each collection.
  3. Re-verifies restored rules against snapshot.
  4. Writes progress log to `database/backups/security/rollback_progress_<timestamp>.json`.
- **Safety Guarantee:** Never uses empty string fallback `""`. Requires verified snapshot file.

### Runbook B: Operation B Rollback (`teaching_records`)
- **Trigger:** Operation B schema creation or verification fails.
- **Rollback Command:**
  ```bash
  npx tsx src/scripts/phase1b-schema-rollback.ts
  ```
- **Execution:**
  1. Checks if `teaching_records` contains any real data records (`getList(1, 1)`).
  2. If real records exist, **ABORTS IMMEDIATELY** to prevent accidental data loss.
  3. If collection is empty, deletes the collection via `pb.collections.delete()`.
  4. Verifies collection is gone via 404 response.

### Runbook C: Operation C Rollback (Database Indexes)
- **Trigger:** SQLite rejects an index due to conflict or operation fails.
- **Rollback Command:**
  ```bash
  npx tsx src/scripts/phase1c-indexes-rollback.ts --snapshot database/backups/indexes/indexes_backup_<timestamp>.json
  ```
- **Execution:**
  1. Loads baseline index snapshot.
  2. Updates each collection to restore its original `indexes` array.
  3. Verifies active indexes match pre-operation baseline.

### Runbook D: Catastrophic Disaster Recovery (Tier 1 PocketBase Server Restore)
- **Trigger:** Unrecoverable database corruption, schema lockup, or process crash during migration.
- **Procedure:**
  1. Identify verified pre-operation backup key (e.g. `backup_security_2026_11_11_...zip`).
  2. Access PocketBase Admin UI: `https://stracker.abhigyanintelligence.cloud/_/` -> Settings -> Backups.
  3. Select the verified backup and click **Restore**.
  4. Wait for PocketBase process restart (approx. 10–15 seconds).
  5. Verify system health at `https://stracker.abhigyanintelligence.cloud/api/health`.

---

## 6. Failure Recovery Matrix

| Scenario | Point of Failure | Impact | Immediate Action | Recovery Runbook |
|---|---|---|---|---|
| **Network drop during Operation A** | Halts at collection #5 during rule update | Collections 1–4 locked, 5–11 open | Process exits with error; `lockdown_progress.json` saved. | Run `phase1a-security-rollback.ts --snapshot <path>`. Re-verify. |
| **Verification detects rule leak** | Step A.3 reports HTTP 200 or 404 | Specific collection not locked | Script throws audit failure exception. | Re-run `phase1a-security-lockdown.ts` or rollback to baseline. |
| **Operation B schema validation rejection** | Step B.2 field definition rejected by Go validator | Collection not created | Script halts before committing schema. | Check field options. If empty collection created, run Runbook B. |
| **Duplicate detected during Preflight** | Step C.1 finds matching composite keys | Unique index cannot be applied | Script outputs conflicting IDs and halts. | **DO NOT DELETE DATA.** Report duplicate IDs to Director for manual resolution. |
| **SQLite unique constraint failed during index build** | Step C.3 index creation rejected | Target collection indexes unchanged | Script catches error, halts without modifying remaining collections. | Run Runbook C using baseline indexes snapshot. |
| **Server process crash / power loss** | Any step | Unpredictable mid-flight state | Inspect VPS status via Coolify. Check `pb_data`. | Restore Tier 1 PocketBase server backup (Runbook D). |

---

## 7. Go / No-Go Final Decision Protocol

Phase 1 execution is **STRICTLY PROHIBITED** until the following checklist is 100% completed:

```
[ ] 1. All 13 scripts written to src/scripts/ on disk
[ ] 2. Out-of-band VPS snapshot completed on Hostinger panel
[ ] 3. Pre-execution Tier 1 backup verified (size > 0, downloaded)
[ ] 4. Preflight duplicate check verified (0 duplicate groups)
[ ] 5. Two genuine student records verified intact (Mafruza & Sangey)
[ ] 6. Director written authorization signed

ALL 6 CONDITIONS MET? 
[ ] YES -> PROCEED WITH OPERATION A
[X] NO  -> NO-GO: REMAIN IN AUDIT / PLANNING MODE
```

**Current Operational Status:** **NO-GO — NOT READY FOR PRODUCTION EXECUTION.**
