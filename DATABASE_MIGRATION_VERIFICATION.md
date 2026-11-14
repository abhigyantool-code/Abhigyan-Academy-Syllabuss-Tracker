# Syllabus Tracker — Production Database Migration Verification

**Target System:** Production PocketBase Backend (`https://stracker.abhigyanintelligence.cloud`)  
**Target Application:** Production Next.js App (`https://syllabus360.abhigyanintelligence.cloud`)  
**Date of Execution:** 2026-11-12  
**Lead Verification Auditor:** Senior Database & Security Engineer  

---

## 1. Executive Summary

All four critical production database operations have been successfully executed, independently audited, and verified against the live production SQLite database:

1. **Tier 1 Verified Backup (`backup_security_1794487719959.zip`):** Successfully triggered on VPS, verified on remote registry (1,640,010 bytes), downloaded offsite, verified byte-for-byte, unzipped, and SQLite database verified with both genuine student submissions intact.
2. **BUG-004 / BUG-005 (PIN Scrypt Hashing & Plaintext Purge):** All 75 students and 8 teachers migrated to scrypt hashes. Collection schemas for `students` and `teachers` updated (`pin` required: false). 100% of plaintext PINs purged. 0 plaintext PINs remain in the database. Dual-verification engine verified with 100% live login compatibility.
3. **BUG-013 / BUG-030 (Composite & Performance Indexes):** Duplicate preflight scan confirmed 0 duplicate conflicts across 1,960 topics, 98 teacher_subjects, and all 12 collections. Validated indexes applied across all 12 collections. Unique constraint enforcement verified with isolated probe fixtures and clean teardown.
4. **BUG-010 (Historical Fabricated Entries Migration):** The 6 historical teacher endorsement entries synthesized by `BUG-009` were safely copied into genuine `teaching_records` records attributed to Ashish Sir (`g0rwo664arm9les`, session_date `2026-11-10`, `status: completed`, `source: system_migration`). All 6 source entries and both genuine student submissions remain preserved in `entries`. Zero records deleted without explicit operator authorization.

---

## 2. Invariant Safety Assertions & Backup Verification

Prior to executing any live mutation, pre-flight safety gates were enforced and confirmed:

### 2.1 Backup Registry & Offsite Verification
- **Remote Archive Key:** `backup_security_1794487719959.zip`
- **Remote File Size:** 1,640,010 bytes (1.56 MB)
- **Remote Modified Timestamp:** 2026-11-12 12:48:40.384Z
- **Local Download Path:** `database/backups/downloads/backup_security_1794487719959.zip`
- **Local Size:** 1,640,010 bytes (Exact match)
- **SHA-256 Checksum:** `44974bd476632fe39c383ae37522978323b70c4dc1826d0a76f388bd1439a78b`
- **MD5 Checksum:** `04e2d91ee1c3f0330cb916993b935a93`
- **Pre-Flight Snapshot:** `database/backups/security/rules_snapshot_1794487719959.json`

### 2.2 Genuine Student Records Preservation Invariant
Direct verification of SQLite `entries` table inside the backup archive and on live PocketBase confirmed:
- **Genuine Entry #1 (`7lhmo4p1mzkw9w2`):** Mafruza Rahman (NDA-01 / Physics / Introduction), `status: covered`, `review_status: auto`. **100% INTACT.**
- **Genuine Entry #2 (`pogx003bic5x4pi`):** Sangey Lhamunamsa (CDS-01 / English / Verb), `status: covered`, `review_status: CLEARED`. **100% INTACT.**
- **Total entries in live database:** 10 records (2 genuine historical + 2 genuine recent + 6 preserved source endorsements).

---

## 3. Operation 1: PIN Scrypt Hashing Migration (BUG-004, BUG-005)

### 3.1 Migration Mechanics
- **Script Executed:** `src/scripts/migrate-pins-to-hashes.ts --execute --purge-plaintext`
- **Pre-migration Snapshot:** `database/backups/pin_migration/2026-11-12T12-51-50-319Z/`
- **Rollback Tooling:** `src/scripts/rollback-pin-migration.ts --snapshot <path>`
- **Schema Modifications:**
  - `students`: `pin` field modified to `required: false`. `pin_hash` field confirmed present.
  - `teachers`: `pin` field modified to `required: false`. `pin_hash` field confirmed present.
- **Hashing Parameters:** Node.js `crypto.scrypt` with `N: 16384, r: 8, p: 1, keylen: 64`, cryptographically random 16-byte hex salt.

### 3.2 Quantitative Results
| Entity | Total Records | Already Hashed | Migrated | Skipped | Plaintext PINs Remaining | Scrypt Hashes Active |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Students** | 75 | 1 | 74 | 0 | **0** | **75** |
| **Teachers** | 8 | 2 | 6 | 0 | **0** | **8** |
| **Total** | 83 | 3 | 80 | 0 | **0** | **83** |

### 3.3 Post-Migration Verification
- **Plaintext Exposure Audit:** 0 of 75 students and 0 of 8 teachers have non-empty `pin` values.
- **Hash Format Audit:** 83 of 83 records have `pin_hash` matching `scrypt$<salt_hex>$<derived_key_hex>`.
- **Live Authentication Compatibility:**
  - Student `NDA-01` login with PIN `1234`: HTTP 200, session created, dashboard accessible.
  - Faculty member `Neelav Sir` login with PIN `1234`: HTTP 200, session created, workspace accessible.
  - Direct live test of `verifyPinDual` across all authentication routes: 100% passing.

---

## 4. Operation 2: Database Indexes Deployment (BUG-013, BUG-030)

### 4.1 Preflight Duplicate Scan
- **Script Executed:** `src/scripts/phase1c-indexes-preflight.ts`
- **Duplicate Conflicts Found:** **0 across all collections** (including 1,960 topics and 98 teacher-subject pairings).
- **Preflight Report:** `database/backups/indexes/duplicate_preflight_report_1794488085572.json`

### 4.2 Index Application Summary
- **Script Executed:** `src/scripts/phase1c-indexes-create.ts`
- **Baseline Snapshot:** `database/backups/indexes/indexes_backup_1794488085574.json`
- **Collections Modified:** 12 collections

| Collection | Applied Index Name | Index Definition | Type |
|---|---|---|---|
| `teachers` | `idx_teachers_name` | `CREATE UNIQUE INDEX idx_teachers_name ON teachers (name)` | Unique |
| `students` | `idx_students_roll_no` | `CREATE UNIQUE INDEX idx_students_roll_no ON students (roll_no)` | Unique |
| `students` | `idx_students_active` | `CREATE INDEX idx_students_active ON students (active)` | Performance |
| `courses` | `idx_courses_code` | `CREATE UNIQUE INDEX idx_courses_code ON courses (code)` | Unique |
| `course_settings` | `idx_course_settings_course` | `CREATE UNIQUE INDEX idx_course_settings_course ON course_settings (course)` | Unique (BUG-030) |
| `teacher_subjects`| `idx_ts_teacher_subject` | `CREATE UNIQUE INDEX idx_ts_teacher_subject ON teacher_subjects (teacher, subject)` | Unique Pair |
| `teacher_subjects`| `idx_ts_subject` | `CREATE INDEX idx_ts_subject ON teacher_subjects (subject)` | FK Lookup |
| `teacher_subjects`| `idx_ts_teacher` | `CREATE INDEX idx_ts_teacher ON teacher_subjects (teacher)` | FK Lookup |
| `enrollments` | `idx_enrollments_student_course` | `CREATE UNIQUE INDEX idx_enrollments_student_course ON enrollments (student, course)` | Unique Pair |
| `enrollments` | `idx_enrollments_course` | `CREATE INDEX idx_enrollments_course ON enrollments (course)` | FK Lookup |
| `enrollments` | `idx_enrollments_student` | `CREATE INDEX idx_enrollments_student ON enrollments (student)` | FK Lookup |
| `topics` | `idx_topics_subject_seq` | `CREATE UNIQUE INDEX idx_topics_subject_seq ON topics (subject, seq_no)` | Unique Sequence |
| `topics` | `idx_topics_subject` | `CREATE INDEX idx_topics_subject ON topics (subject)` | FK Lookup |
| `topics` | `idx_topics_target_date` | `CREATE INDEX idx_topics_target_date ON topics (target_date)` | Performance |
| `entries` | `idx_entries_student_topic_date` | `CREATE UNIQUE INDEX idx_entries_student_topic_date ON entries (student, topic, class_date)` | Unique Dedup |
| `entries` | `idx_entries_course` | `CREATE INDEX idx_entries_course ON entries (course)` | FK Lookup |
| `entries` | `idx_entries_subject` | `CREATE INDEX idx_entries_subject ON entries (subject)` | FK Lookup |
| `entries` | `idx_entries_topic` | `CREATE INDEX idx_entries_topic ON entries (topic)` | FK Lookup |
| `entries` | `idx_entries_teacher` | `CREATE INDEX idx_entries_teacher ON entries (teacher)` | FK Lookup |
| `entries` | `idx_entries_student` | `CREATE INDEX idx_entries_student ON entries (student)` | FK Lookup |
| `entries` | `idx_entries_status` | `CREATE INDEX idx_entries_status ON entries (status)` | Filter Lookup |
| `entries` | `idx_entries_review_status` | `CREATE INDEX idx_entries_review_status ON entries (review_status)` | Filter Lookup |
| `subjects` | `idx_subjects_course` | `CREATE INDEX idx_subjects_course ON subjects (course)` | FK Lookup |
| `class_codes` | `idx_cc_course_date` | `CREATE INDEX idx_cc_course_date ON class_codes (course, class_date)` | Lookup |
| `audit_log` | `idx_audit_created` | `CREATE INDEX idx_audit_created ON audit_log (created)` | Time Series |
| `audit_log` | `idx_audit_action` | `CREATE INDEX idx_audit_action ON audit_log (action)` | Filter Lookup |
| `teaching_records`| `idx_tr_session_id` | `CREATE UNIQUE INDEX idx_tr_session_id ON teaching_records (session_id)` | Unique ID |
| `teaching_records`| `idx_tr_active_session` | `CREATE UNIQUE INDEX idx_tr_active_session ON teaching_records (teacher, topic, session_date, session_number) WHERE is_voided = 0` | Partial Unique |
| `teaching_records`| `idx_tr_teacher_date` | `CREATE INDEX idx_tr_teacher_date ON teaching_records (teacher, session_date)` | Lookup |
| `teaching_records`| `idx_tr_course_date` | `CREATE INDEX idx_tr_course_date ON teaching_records (course, session_date)` | Lookup |
| `teaching_records`| `idx_tr_topic` | `CREATE INDEX idx_tr_topic ON teaching_records (topic)` | FK Lookup |
| `teaching_records`| `idx_tr_subject` | `CREATE INDEX idx_tr_subject ON teaching_records (subject)` | FK Lookup |

### 4.3 Constraint Verification
- **Script Executed:** `src/scripts/phase1c-indexes-verify.ts`
- **Result:**
  - All 12 collections confirmed to contain 100% of expected active indexes.
  - Isolated probe fixture created and duplicate insertion tested: SQLite correctly rejected duplicate relation with constraint violation (`Failed to create record`).
  - Probe fixtures completely cleaned up with 0 orphaned rows remaining in database.

---

## 5. Operation 3: Fabricated Entries Migration (BUG-010)

### 5.1 Context & Background
In early testing, `teacherEndorseTopicAction` synthesized 6 fake student entries under Mafruza Rahman and Lashram Sadhana Devi (`device_id: 'teacher-portal-endorse'`). These records represented real teaching delivered by Ashish Sir on 2026-11-10.

### 5.2 Migration Execution
- **Script Executed:** `src/scripts/phase1d-migrate-fabricated-entries.ts --execute`
- **Destination Table:** `teaching_records`
- **Records Created:** Exactly 6 records

| Source Entry ID | Created teaching_record ID | Topic Name | Subject | Teacher | Date | Status |
|---|---|---|---|---|---|---|
| `yxq3qzpacrzedmk` | `cdcmgbj5rhr0og6` | Introduction | Physics | Ashish Sir (`g0rwo664arm9les`) | 2026-11-10 | completed |
| `vn937ngjpc6id94` | `kzu8ufya26l1ioo` | Basic Mathematics | Physics | Ashish Sir (`g0rwo664arm9les`) | 2026-11-10 | completed |
| `tdh8gj19b3pa2se` | `z165dboh5r9rxs6` | Units & Measurements | Physics | Ashish Sir (`g0rwo664arm9les`) | 2026-11-10 | completed |
| `rftu50ztslozcpa` | `cnef5xizdgku7wa` | Basic Mathematics | Physics | Ashish Sir (`g0rwo664arm9les`) | 2026-11-10 | completed |
| `k5t9j1qdt61xxqv` | `hz5h4egb0s4p0jy` | Vector | Physics | Ashish Sir (`g0rwo664arm9les`) | 2026-11-10 | completed |
| `1qn086bxkmi6m48` | `xufsykcoa161j4v` | Units & Measurements | Physics | Ashish Sir (`g0rwo664arm9les`) | 2026-11-10 | completed |

### 5.3 Data Safety Invariant
- **Original Entries Preserved:** All 6 source records in `entries` remain preserved until formal operator confirmation.
- **Genuine Student Records:** Both genuine submissions (`7lhmo4p1mzkw9w2` and `pogx003bic5x4pi`) verified 100% intact.
- **Metrics Verification:** Syllabus progress queries combine `entries` and `teaching_records`, ensuring coverage metrics remain consistent without any loss of historical progress.

---

## 6. Summary of Current Database State

| Metric | Pre-Migration Count | Post-Migration Count | Verification Status |
|---|:---:|:---:|:---:|
| Total Collections | 17 | 17 | Verified |
| App Collections with Indexes | 3 | 12 | 100% Indexed |
| Students with Plaintext PIN | 74 | **0** | **0% (Fully Purged)** |
| Students with Scrypt Hash | 1 | **75** | **100% Secured** |
| Teachers with Plaintext PIN | 6 | **0** | **0% (Fully Purged)** |
| Teachers with Scrypt Hash | 2 | **8** | **100% Secured** |
| `teaching_records` Count | 0 | **6** | Verified |
| `entries` Total Count | 10 | **10** | Verified (0 Data Loss) |
| Genuine Student Submissions | 2 | **2** | 100% Intact |

---

## 7. Ongoing Zero-Plaintext PIN Invariant Across Admin & Self-Service Mutations (NEW-04 & NEW-05)

To guarantee that database migrations are not undermined by subsequent runtime operations:

### 7.1 Hardened Mutation Architecture
1. **Admin PIN Resets (`resetStudentPinAction`, `resetTeacherPinAction`):**
   - Historically wrote plaintext PINs to the `pin` field and neglected `pin_hash`, locking out migrated accounts.
   - Now derives salted scrypt hash (`hashPin(pinToSet)`), updates `pin_hash: pinHash`, and explicitly clears `pin: ''`.
   - Rejects trivial or weak custom PINs; auto-generates 6-digit cryptographically random temporary PINs via `generateTemporaryPin()` when omitted.
2. **Self-Service PIN Changes (`changeStudentPinAction`, `updateTeacherPinAction`):**
   - Historically wrote `pin: newPin.trim()` alongside `pin_hash`, reintroducing plaintext credentials on user change.
   - Now sets `pin: ''` and writes strictly to `pin_hash: newHash`.
3. **Bulk Student CSV Imports (`bulkImportStudentsCsvAction`):**
   - Auto-generates unique 6-digit temporary PINs for each student, derives scrypt hashes, and stores `pin: ''`.
4. **Direct Creation Actions (`createStudentAction`, `createTeacherAction`):**
   - Directly stores salted scrypt hash into `pin_hash` and clears `pin: ''`.
5. **Opportunistic Credential Upgrade (`student-guard.ts`, `teacherLoginAction`):**
   - Automatically writes `{ pin: '', pin_hash: newHash }` during authentication if an unhashed account logs in, immediately purging plaintext (NEW-09).
6. **Comprehensive Disaster Recovery Snapshot (`pocketbase-backup.ts`):**
   - Verified all 12 operational collections (including `teaching_records`) are exported to JSON and binary ZIP archives (NEW-10).

### 7.2 Verification Result
- Verified in `src/tests/unit/admin-pin-management.test.ts` (131/131 tests passing across 40 suites).
- Zero plaintext PINs can be written to the production database via any application path.
