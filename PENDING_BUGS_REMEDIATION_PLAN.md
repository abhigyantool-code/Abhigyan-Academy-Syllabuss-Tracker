# Syllabus Tracker — Pending Bugs & Post-Showcase Remediation Plan

**Document Status:** PERMANENT PROJECT-ROOT SPECIFICATION & EXECUTION ROADMAP  
**Author:** Senior Software Architect, Database Security Engineer & Lead QA Auditor  
**Date of Creation:** 2026-11-12  
**Target Environment:** Production VPS (Hostinger Coolify)  
**Production PocketBase Instance:** `https://stracker.abhigyanintelligence.cloud` (PocketBase v0.28.2)  
**Production Next.js Application:** `https://syllabus360.abhigyanintelligence.cloud` (Next.js 16.4.3 / React 19.3, Commit `286926e`)  
**Companion Documents:** [`BUGS_AND_ISSUES_REGISTER.md`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md), [`PHASE1_EXECUTION_PLAN.md`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/PHASE1_EXECUTION_PLAN.md)

---

## 1. Executive Summary & Context

Following the successful execution and empirical verification of **Step 1 (Tier 1 Production Server Backup `backup_security_1794464541002.zip`)**, **Step 2 (PocketBase API Security Lockdown across all 11 collections)**, and the **Production Deployment of Release Commit `286926e`** on Hostinger Coolify (with all 15 post-deployment smoke tests passing), the Syllabus Tracker application is fully operational and secured for today's showcase.

However, strict engineering discipline requires that **no unresolved defect, pending infrastructure task, or deferred database migration be dismissed or forgotten simply because the frontend is currently functioning**.

This document serves as our **exhaustive post-showcase technical roadmap**. It inventories all **38 issues** from `BUGS_AND_ISSUES_REGISTER.md` that are not yet sealed as `Verified in Production`, classifies them into clear operational boundaries, details their technical root causes, step-by-step remediation procedures, testing suites, rollback mechanisms, and schedules them in a risk-minimized execution order.

### Global Safety Invariants
1. **Zero Silent Data Loss:** Genuine student submissions (`7lhmo4p1mzkw9w2` by Mafruza Rahman and `pogx003bic5x4pi` by Sangey Lhamunamsa) must remain permanently untouched and verified across all operations.
2. **Explicit Operator Authorization:** No production database mutation, schema change, index addition, or record migration shall execute without individual operator review and formal approval.
3. **Dual-Gate Verification:** A passing unit test in memory does not equal production resolution. Every issue transitions to `Verified in Production` only after live verification against the production VPS.

---

## 2. Register Cross-Reference & Inventory Breakdown

Across the 45 total issues tracked in [`BUGS_AND_ISSUES_REGISTER.md`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md):
- **Verified in Production (7 Issues):** `BUG-001` (Collection API Rules), `BUG-002` (Public Student PII Exposure via REST), `BUG-019` (Deployment Verification of `bcdddf5`), `BUG-020` (Collection Inventory Reconciliation), `BUG-033` (Fresh Backup Creation), `BUG-034` (Security Verification Script Crash), `BUG-044` (PocketBase REST Plaintext PIN Lockdown).
- **Unresolved / Pending Issues (38 Issues):** Divided into 3 strict operational categories detailed below.

### Summary Metrics of Pending Work

| Category | Count | Priority Distribution | Operator Approval Required? |
| :--- | :---: | :---: | :---: |
| **Group A: Deferred Database Operations** | **5** | 2 Critical, 3 High | **YES (Mandatory Pre-Execution Sign-Off)** |
| **Group B: Pending Infrastructure & Rotation** | **2** | 1 High, 1 Medium | **YES (VPS Shell / Panel Intervention)** |
| **Group C: Deployed Codebase Fixes (Field Sign-Off)** | **31** | 6 Critical, 14 High, 9 Medium, 2 Low | NO (Already Deployed in `286926e`; Awaiting Field Observation) |
| **Total Pending Tracking** | **38** | **8 Critical, 18 High, 10 Medium, 2 Low** | — |

---

## 3. Group A: Deferred Production Database Operations

These 5 operations modify the live SQLite database in PocketBase. **None may be executed without explicit operator sign-off.**

```mermaid
flowchart TD
    subgraph PreReq["Pre-Flight Safety"]
        BKP["1. Take Tier 1 VPS Snapshot + Offsite Download"]
        PRE["2. Run 0-Duplicate & Integrity Preflight Assertions"]
    end

    subgraph Phase1["Execution Order"]
        OP_B["Operation B: Create teaching_records (BUG-012)"]
        OP_C["Operation C: Apply SQLite Indexes (BUG-013)"]
        MIG_FAB["Migrate 6 Fabricated Entries to teaching_records (BUG-010)"]
        MIG_PIN["Execute PIN Scrypt Hashing Migration (BUG-004, BUG-005)"]
    end

    subgraph Invariant["Continuous Guardrail"]
        GEN["Assert Genuine Submissions Intact (BUG-011)"]
    end

    BKP --> PRE
    PRE --> OP_B
    OP_B --> OP_C
    OP_C --> MIG_FAB
    MIG_FAB --> MIG_PIN
    MIG_PIN --> GEN
```

---

### BUG-012 (Operation B): Missing `teaching_records` Collection for Faculty Worklogs

- **Severity:** High
- **Category:** Database Architecture
- **Root Cause:** PocketBase schema was designed solely around student confirmations (`entries`). When faculty members wanted to log lessons or endorse topics where students had not yet submitted, the application had no storage table for teacher sessions, directly forcing synthetic student entry creation (`BUG-009`).
- **Affected Collections:** PocketBase Collections (new collection `teaching_records`).
- **Current Status:** Awaiting Production Approval (Scripts `src/scripts/phase1b-*` validated locally).
- **Why It Remains Pending:** Creating database collections requires downtime considerations, verification of relation fields against live IDs, and operator authorization.
- **Recommended Technical Solution:** Run `src/scripts/phase1b-schema-create.ts` to provision `teaching_records` with:
  - Relations: `teacher` -> `teachers`, `course` -> `courses`, `subject` -> `subjects`, `topic` -> `topics`.
  - Fields: `class_date` (text), `session_type` (select: `lecture`, `revision`, `doubt_clearing`, `test_discussion`), `status` (select: `completed`, `partially_covered`, `cancelled`), `duration_minutes` (number, min 15, max 480), `notes` (text, max 1000 chars), `voided` (bool, default false), `void_reason` (text), `voided_by` (text), `voided_at` (text).
  - API Rules: All 5 rules set strictly to `null` (superuser access only via Next.js server actions).
- **Implementation Steps:**
  1. Capture fresh server backup: `npx tsx --env-file=.env.local src/scripts/phase1a-security-backup.ts`.
  2. Execute `npx tsx --env-file=.env.local src/scripts/phase1b-schema-create.ts`.
  3. Execute `npx tsx --env-file=.env.local src/scripts/phase1b-schema-verify.ts`.
- **Testing & Verification Procedure:** `phase1b-schema-verify.ts` creates an isolated test course (`PROBE_COURSE_...`), performs CRUD operations across all relations, tests duration range constraints, tests invalid enum rejections, and cleans up completely in `try ... finally`.
- **Production Risks:** Low schema collision risk; zero impact on existing collections.
- **Backup & Rollback Requirements:** Rollback script `src/scripts/phase1b-schema-rollback.ts` deletes the collection if verification fails.
- **Dependencies & Priority:** Priority 1 in Database Operations. Prerequisite for `BUG-010` and full decoupling of `BUG-009`.

---

### BUG-013 (Operation C): Missing Database Indexes Across All 11 Collections

- **Severity:** High
- **Category:** Database Integrity & Performance
- **Root Cause:** SQLite database was initially provisioned without composite unique constraints or foreign key performance indexes. Only 3 single-column indexes exist (`idx_courses_code`, `idx_teachers_name`, `idx_students_roll_no`). 8 collections have 0 indexes.
- **Affected Collections:** `entries`, `topics`, `subjects`, `teacher_subjects`, `enrollments`, `course_settings`, `class_codes`, `audit_log`, `teachers`, `courses`, `students`.
- **Current Status:** Awaiting Production Approval (Preflight duplicate scan passed with 0 conflicts).
- **Why It Remains Pending:** Applying unique indexes on tables with live data will abort with fatal errors if duplicate combinations exist. Operator approval required to execute after preflight verification.
- **Recommended Technical Solution:** Run `src/scripts/phase1c-indexes-create.ts` to create the following indexes:
  - `teacher_subjects`: `CREATE UNIQUE INDEX idx_teacher_subjects_pair ON teacher_subjects (teacher, subject)`
  - `enrollments`: `CREATE UNIQUE INDEX idx_enrollments_pair ON enrollments (student, course)`
  - `topics`: `CREATE UNIQUE INDEX idx_topics_subject_seq ON topics (subject, seq_no)`
  - `entries`: `CREATE UNIQUE INDEX idx_entries_dedup ON entries (student, topic, class_date)`
  - `course_settings`: `CREATE UNIQUE INDEX idx_course_settings_course ON course_settings (course)`
  - Performance FK indexes on `entries(topic)`, `entries(student)`, `topics(subject)`, `subjects(course)`.
- **Implementation Steps:**
  1. Execute preflight duplicate scan: `npx tsx --env-file=.env.local src/scripts/phase1c-indexes-preflight.ts`.
  2. Verify 0 duplicate conflicts reported.
  3. Execute `npx tsx --env-file=.env.local src/scripts/phase1c-indexes-create.ts`.
  4. Execute `npx tsx --env-file=.env.local src/scripts/phase1c-indexes-verify.ts`.
- **Testing & Verification Procedure:** `phase1c-indexes-verify.ts` attempts duplicate insertions using isolated probe fixtures and confirms SQLite rejects duplicates with code `400 / SQLITE_CONSTRAINT_UNIQUE`.
- **Production Risks:** If concurrent duplicate insertions occur during index creation, creation fails. Mitigated by read-only preflight scan.
- **Backup & Rollback Requirements:** `src/scripts/phase1c-indexes-rollback.ts` drops created indexes using SQLite DDL.
- **Dependencies & Priority:** Priority 2 in Database Operations. Must execute after Operation B (`teaching_records` also receives composite indexes).

---

### BUG-010: Six Fabricated Entries in Production Attributed to Ashish Sir

- **Severity:** High
- **Category:** Academic Data Integrity
- **Root Cause:** `BUG-009` in `teacherEndorseTopicAction` synthesized fake student entries under Mafruza Rahman (3 entries) and Lashram Sadhana Devi (3 entries) with `device_id: "teacher-portal-endorse"`.
- **Affected Collections:** `entries` (Record IDs: `yxq3qzpacrzedmk`, `vn937ngjpc6id94`, `tdh8gj19b3pa2se`, `rftu50ztslozcpa`, `k5t9j1qdt61xxqv`, `1qn086bxkmi6m48`).
- **Current Status:** Awaiting Production Approval (Records isolated, queried, and verified).
- **Why It Remains Pending:** Deleting or moving production records requires explicit human consent to prevent accidental loss of Ashish Sir's actual teaching logs.
- **Recommended Technical Solution:**
  1. For each of the 6 records, read the topic, course, and date.
  2. Insert an equivalent record into `teaching_records` (`teacher = Ashish Sir`, `session_type = 'lecture'`, `status = 'completed'`, `notes = 'Migrated from teacher-portal-endorse'`).
  3. Assert that exactly 6 records were inserted into `teaching_records`.
  4. Assert that genuine entries `7lhmo4p1mzkw9w2` and `pogx003bic5x4pi` remain untouched in `entries`.
  5. Delete ONLY the exact 6 IDs from `entries`.
- **Implementation Steps:**
  1. Ensure Operation B (`teaching_records`) has been executed.
  2. Run migration script: `npx tsx --env-file=.env.local src/scripts/phase1d-migrate-fabricated-entries.ts`.
  3. Run post-migration validation: verify `entries` count decreases from 8 to 2.
- **Testing & Verification Procedure:** Direct SQLite check: assert 2 records remain in `entries`, assert IDs match Mafruza Rahman and Sangey Lhamunamsa, assert 6 records exist in `teaching_records`.
- **Production Risks:** Accidental broad `DELETE` query. Mitigated by hardcoding the exact 6 IDs in an immutable array with length assertions.
- **Backup & Rollback Requirements:** Verified backup `backup_security_1794464541002.zip` contains all 6 original records for restoration if needed.
- **Dependencies & Priority:** Priority 3. Depends on BUG-012 and BUG-036 (`dashboard-data.ts` query support).

---

### BUG-004 & BUG-005: Production PIN Scrypt Migration (Students & Faculty)

- **Severity:** High
- **Category:** Credential Security
- **Root Cause:** PocketBase schema stores student and teacher PINs as plaintext strings in `pin` column. direct comparisons were performed against plaintext strings.
- **Affected Collections:** PocketBase `students` (75 records) and `teachers` (8 records).
- **Current Status:** Fixed in Codebase / Awaiting Production Approval (Scrypt dual-read engine live in release `286926e`; production database columns remain plaintext).
- **Why It Remains Pending:** Batch database updates across all 75 students and 8 teachers must be executed with a dual-verification safety net to avoid locking out legitimate users.
- **Recommended Technical Solution:** Run `src/scripts/migrate-pins-to-hashes.ts`:
  1. Add `pin_hash` field to `students` and `teachers` schemas if not present.
  2. For every student and teacher, read plaintext `pin`, compute `scrypt` hash with cryptographically secure 16-byte random salt, and write to `pin_hash`.
  3. Leave `pin` intact during grace period (Dual-verification engine in `src/lib/pin-hash.ts` checks `pin_hash` first, then falls back to `pin`).
  4. After 14 days of successful live logins, execute stage 2: nullify the plaintext `pin` column.
- **Implementation Steps:**
  1. Execute dry-run: `npx tsx --env-file=.env.local src/scripts/migrate-pins-to-hashes.ts --dry-run`.
  2. Review pre-migration snapshot generated in `database/backups/pins/`.
  3. Execute migration: `npx tsx --env-file=.env.local src/scripts/migrate-pins-to-hashes.ts --execute`.
  4. Test live login for Ashish Sir (`1234`) and Mafruza Rahman (`1234`).
- **Testing & Verification Procedure:** Verified by `src/tests/unit/pin-migration.test.ts` (3 automated tests passing). Live login tested post-migration.
- **Production Risks:** Credential corruption locking out users. Mitigated by dual-verification engine and automated snapshotting.
- **Backup & Rollback Requirements:** Rollback script `src/scripts/rollback-pin-migration.ts --snapshot <path>` restores plaintext PINs if hashing fails.
- **Dependencies & Priority:** Priority 4 in Database Operations. Must be scheduled during a maintenance window.

---

### BUG-011: Preservation of Two Genuine Student Submissions

- **Severity:** Critical
- **Category:** Academic Data Integrity
- **Root Cause:** Historical risk: any automated cleanup script or naive database wipe intended to clear "test data" or "fabricated entries" would permanently destroy the academy's only 2 authentic student submissions.
- **Affected Records:**
  - `7lhmo4p1mzkw9w2`: Mafruza Rahman (NDA / Physics / Introduction), `status: covered`, `review_status: auto`.
  - `pogx003bic5x4pi`: Sangey Lhamunamsa (NDA / English / Verb), `status: partial`, `review_status: pending`, remarks: `"need explaination on x topic again"`.
- **Current Status:** Verified Intact (Preserved invariant across all steps).
- **Why It Remains Pending:** This is a permanent guardrail that must remain open as an invariant assertion on every single future migration script.
- **Recommended Technical Solution:** Enforce invariant preflight and postflight checks in all scripts:
  ```typescript
  const GENUINE_IDS = ['7lhmo4p1mzkw9w2', 'pogx003bic5x4pi'];
  for (const id of GENUINE_IDS) {
    const rec = await pb.collection('entries').getOne(id);
    if (!rec) throw new Error(`FATAL: Genuine record ${id} missing!`);
  }
  ```
- **Testing & Verification Procedure:** Automated check in `phase1a-security-verify.ts` and `phase1d-migrate-fabricated-entries.ts`.
- **Production Risks:** High risk of human error during manual database maintenance.
- **Backup & Rollback Requirements:** Fresh verified offsite backup `backup_security_1794464541002.zip` contains SQLite database with both entries intact.
- **Dependencies & Priority:** Highest priority invariant.

---

## 4. Group B: Pending Architectural & Security Infrastructure Issues

These 2 issues require infrastructure-level updates on the Hostinger Coolify VPS and Git repository.

```mermaid
flowchart LR
    subgraph BUG042["BUG-042 Remediation"]
        ROT["1. Rotate Secrets in Coolify Panel"] --> SCRUB["2. Scrub Git History (git-filter-repo)"]
        SCRUB --> FORCE["3. Force Push Cleaned main Branch"]
    end

    subgraph BUG039["BUG-039 Remediation"]
        REDIS["1. Spin up Redis Container on VPS"] --> TOKEN["2. Implement Redis Token Bucket in rate-limit.ts"]
        TOKEN --> CLUSTER["3. Multi-Instance Cluster Safe"]
    end
```

---

### BUG-042: Git History Scrubbing & VPS Environment Credential Rotation

- **Severity:** High
- **Category:** Credential Security & Git Governance
- **Root Cause:** During earlier initial development, the old director master password and PocketBase superuser credentials were committed in plaintext in historic commits (`e6422a0`, `b081d27`, `e2799cc`, `a185b0e`).
- **Affected Assets:** Git Commit History (`origin/main`), Coolify Production Environment Variables.
- **Current Status:** Pending (Codebase files sanitized in release `286926e`; old secrets remain in historic Git tree).
- **Why It Remains Pending:** Rewriting Git commit history requires coordinated developer freeze and a force push (`git push --force-with-lease`). VPS credentials must be rotated simultaneously in the Coolify UI panel.
- **Recommended Technical Solution:**
  1. **Phase 1 (Credential Rotation on VPS):**
     - Generate a new cryptographically secure 32-character string for `ADMIN_MASTER_PASSWORD`.
     - Generate a new 64-character hex string for `SESSION_SECRET`.
     - Update PocketBase superuser password in `https://stracker.abhigyanintelligence.cloud/_/` admin panel.
     - Inject these new values into Coolify Application Environment settings for Syllabus Tracker.
  2. **Phase 2 (Git History Purge):**
     - Install `git-filter-repo`: `pip install git-filter-repo`.
     - Execute replacement expressions to redact compromised strings across all historical commits:
       ```bash
       git filter-repo --replace-text <(cat <<EOF
       [COMPROMISED_OLD_PASSWORD]==>[REDACTED_HISTORIC_SECRET]
       EOF
       )
       ```
     - Re-link origin: `git remote add origin https://github.com/.../syllabus-tracker.git`.
     - Push sanitized history: `git push origin --force-with-lease --all`.
- **Implementation Steps:** Schedule during an off-peak maintenance window. Notify all repository collaborators to re-clone the repository post-scrub.
- **Testing & Verification Procedure:**
  - Run `git log -S "[COMPROMISED_OLD_PASSWORD]" --all` and assert 0 results returned.
  - Run `git fsck --full` to verify Git object database health.
  - Test director login on live domain with rotated password.
- **Production Risks:** Collaborators attempting to pull dirty branches can re-introduce rewritten commits. Mitigated by strict team notification.
- **Backup & Rollback Requirements:** Take a full bare mirror backup of the repository before running `git-filter-repo`: `git clone --mirror ... repo-pre-scrub.bundle`.
- **Dependencies & Priority:** High Priority. Should be executed within 48 hours of today's showcase.

---

### BUG-039: Persistent Shared Rate Limiting Architecture (Distributed Token Bucket)

- **Severity:** Medium
- **Category:** System Resilience & Horizontal Scalability
- **Root Cause:** Rate-limit buckets (`ipBuckets`, `studentBuckets`, `adminBuckets`) are currently stored in Node.js module memory (`Map` objects). In release `286926e`, memory bounds were enforced (`MAX_IP_BUCKETS = 10,000` with FIFO eviction to prevent OOM). However, if the Next.js container restarts on Coolify, all in-memory rate-limit buckets are reset to 0. Furthermore, if the application scales horizontally to multiple containers, rate limits are isolated per instance.
- **Affected Files:** [`src/lib/rate-limit.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/rate-limit.ts), [`src/app/api/submit/route.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/api/submit/route.ts).
- **Current Status:** Open / Investigated (Sufficient for current single-container Coolify deployment; architectural plan prepared for clustering).
- **Why It Remains Pending:** Current single-container deployment does not experience multi-instance desynchronization. Adding Redis introduces an external infrastructure dependency requiring setup in Coolify.
- **Recommended Technical Solution:**
  1. Provision a lightweight Redis / Valkey container inside Coolify attached to the internal Docker network.
  2. Implement an atomic sliding-window log / token bucket in `src/lib/rate-limit.ts` using `ioredis`:
     ```typescript
     // Multi-instance atomic rate-limit evaluation via Redis Lua script
     const luaScript = `
       local key = KEYS[1]
       local now = tonumber(ARGV[1])
       local window = tonumber(ARGV[2])
       local limit = tonumber(ARGV[3])
       redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
       local current = redis.call('ZCARD', key)
       if current < limit then
         redis.call('ZADD', key, now, now)
         redis.call('EXPIRE', key, math.ceil(window / 1000))
         return 1
       else
         return 0
       end
     `;
     ```
  3. Provide a fallback to local in-memory LRU if `REDIS_URL` is undefined, guaranteeing zero downtime if Redis is unreachable.
- **Implementation Steps:**
  1. Deploy Redis service on Coolify VPS.
  2. Add `REDIS_URL=redis://...` to Coolify environment variables.
  3. Update `src/lib/rate-limit.ts` to connect to Redis with graceful offline degradation.
- **Testing & Verification Procedure:** Simulate container restarts and assert that a locked student account remains locked across container boots.
- **Production Risks:** If Redis crashes and fallback is missing, all authentication requests could fail. Mitigated by `try/catch` fallback to in-memory maps.
- **Backup & Rollback Requirements:** Rollback requires unsetting `REDIS_URL` to revert to local in-memory rate limiting.
- **Dependencies & Priority:** Medium Priority. Required prior to scaling Next.js past a single container.

---

## 5. Group C: Codebase Fixes Deployed in Release `286926e` (Awaiting Formal Field Sign-Off)

These 31 issues have their architectural code fixes fully implemented, unit-tested (85/85 tests passing), and deployed to live production at `https://syllabus360.abhigyanintelligence.cloud` in commit `286926e`. They remain classified as `Fixed in Codebase / Deployed` until post-showcase formal observation is concluded.

```mermaid
classDiagram
    class DeployedCodebaseSecurity {
        BUG_003: Public Student Directory Harvest Eliminated
        BUG_006: Insecure Session Cookie Config Hardened
        BUG_007: Fallback Session Secret Purged
        BUG_008: Hardcoded PB Credentials Purged
        BUG_025: Hardcoded Director Password Purged
        BUG_026: Constant-Time HMAC Signature Compare
        BUG_027: Session Token Expiration Validation
        BUG_031: Leaked Master Password in Placeholder Purged
        BUG_032: Student PIN Reset Authenticated & Rate-Limited
        BUG_037: X-Forwarded-For IP Spoofing Blocked
        BUG_038: Atomic In-Flight Lockout Reservation
        BUG_040: Undefined Session StudentId Check Enforced
        BUG_041: 10k Bucket Memory Bounds & FIFO Eviction
        BUG_043: SHA-256 Digest Constant-Time Equality
        BUG_045: Submission PIN Brute-Force Lockout
    }

    class DeployedCodebaseFeaturesAndReliability {
        BUG_009: Endorsement Student Fabrication Eliminated
        BUG_014: Sequence Jump Anti-Misuse Auto-Approval Fixed
        BUG_015: Atomic Reconciliation & Compensating Rollback
        BUG_016: RFC 4180 Quoted CSV Parser Deployed
        BUG_017: Dedicated Student Portal /student Built
        BUG_018: Exception Masking Sanitized
        BUG_021: Backup Verification Gate Enforced
        BUG_022: Rollback Rejection of Empty String
        BUG_023: Security 404 False-Positive Fixed
        BUG_024: Verification Fixture Isolation
        BUG_028: Obsolete Postgres Scripts Archived
        BUG_029: duration_minutes Field Standardized
        BUG_030: course_settings Index Spec Added
        BUG_035: Role-Array Auth Guard Fixed
        BUG_036: Dual-Collection Dashboard Progress Queries
    }
```

---

### Detailed Dossiers for Group C Issues

#### BUG-003: Public Student Roster Directory Harvest on `/submit`
- **Severity:** High | **Category:** Security / Student Privacy
- **Root Cause:** `getSubmitFormData()` previously serialized all 75 students with names and roll numbers into the public RSC flight payload.
- **Affected Files:** [`src/lib/submit-data.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/submit-data.ts#L104-L125), [`src/components/submit/student-submit-form.tsx`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/components/submit/student-submit-form.tsx).
- **Deployed Solution in `286926e`:** `getSubmitFormData()` returns `students: []`. Combobox dropdown replaced with on-demand Roll Number input; student identity verified via server action without exposing roster.
- **Testing & Verification:** Verified in `student-portal.test.ts`. Live `/submit` HTML inspected; 0 student names found.

#### BUG-006: Insecure Session Cookie Configuration (`secure: false`)
- **Severity:** High | **Category:** Session Security
- **Root Cause:** Hardcoded `secure: false` in `createSession()` left cookies vulnerable to transmission over plain HTTP.
- **Affected Files:** [`src/lib/session.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/session.ts#L59).
- **Deployed Solution in `286926e`:** Dynamically checks `process.env.NODE_ENV === 'production'` while permitting reverse-proxy TLS offloading.
- **Testing & Verification:** Unit test `session.test.ts` verified; production headers checked on live `/teacher` login.

#### BUG-007: Hardcoded Fallback Session HMAC Secret in Source
- **Severity:** Critical | **Category:** Cryptographic Security
- **Root Cause:** Defaulted to static string in source if `SESSION_SECRET` was missing.
- **Affected Files:** [`src/lib/session.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/session.ts#L5).
- **Deployed Solution in `286926e`:** Throws fatal error on startup in production if `SESSION_SECRET` is missing or < 32 chars.
- **Testing & Verification:** Verified in `pin-auth.test.ts` (throws fatal error on weak secret).

#### BUG-008: Hardcoded PocketBase Superuser Credentials in Source
- **Severity:** Critical | **Category:** Credential Security
- **Root Cause:** Defaulted to static admin email and password in `src/lib/pb.ts`.
- **Affected Files:** [`src/lib/pb.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/pb.ts#L5-L6), `docker-compose.yaml`.
- **Deployed Solution in `286926e`:** Hardcoded fallbacks purged; environment variables strictly mapped via Docker Compose.
- **Testing & Verification:** Build check and live PocketBase query verified.

#### BUG-009: Teacher Endorsement Fabricates Student Entries
- **Severity:** Critical | **Category:** Academic Data Integrity
- **Root Cause:** `teacherEndorseTopicAction` synthesized fake entries under real students when endorsing unsubmitted topics.
- **Affected Files:** [`src/app/actions/auth-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/auth-actions.ts#L133-L154).
- **Deployed Solution in `286926e`:** Code path refactored to write exclusively to `teaching_records`. Zero student entries are created.
- **Testing & Verification:** Live smoke test verified; `entries` count remained constant at 8.

#### BUG-014: Erroneous Sequence Jump Flags in Anti-Misuse Engine
- **Severity:** Medium | **Category:** Functional Accuracy
- **Root Cause:** Flagged valid student submissions with `FLAG_SEQUENCE_JUMP` if prior topics lacked manual admin approval.
- **Affected Files:** [`src/lib/submission-validation.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/submission-validation.ts#L57-L70).
- **Deployed Solution in `286926e`:** Expanded check to include auto-approved entries (`review_status = 'auto'`) and teaching records.
- **Testing & Verification:** Unit test `submission-validation.test.ts` passing.

#### BUG-015: Non-Atomic Multi-Collection Admin Mutations
- **Severity:** High | **Category:** Reliability & Consistency
- **Root Cause:** Separate HTTP calls left orphaned rows on partial failure during course, student, and allocation creation.
- **Affected Files:** [`src/app/actions/admin-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/admin-actions.ts).
- **Deployed Solution in `286926e`:** Added creation-first diffing, atomic reconciliation, and compensating rollbacks in `try ... catch` blocks.
- **Testing & Verification:** Admin action unit tests passing.

#### BUG-016: Naive CSV Import Parser Splits on Raw Commas & Newlines
- **Severity:** Medium | **Category:** Ingestion Reliability
- **Root Cause:** `split('\n')` and `split(',')` corrupted CSVs containing commas in quotes or multiline strings.
- **Affected Files:** [`src/lib/csv-parser.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/csv-parser.ts), [`src/app/actions/admin-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/admin-actions.ts).
- **Deployed Solution in `286926e`:** Deployed RFC 4180 parser with quote tracking and preserved leading/trailing whitespace.
- **Testing & Verification:** 7 unit tests in `src/tests/unit/csv-parser.test.ts` passing.

#### BUG-017: Missing Dedicated Student Dashboard UI
- **Severity:** Medium | **Category:** Feature Completeness
- **Root Cause:** System lacked a `/student` dashboard for candidates to review their syllabus progress and feedback.
- **Affected Files:** [`src/app/student/page.tsx`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/student/page.tsx), [`src/components/auth/teacher-login-form.tsx`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/components/auth/teacher-login-form.tsx).
- **Deployed Solution in `286926e`:** Created `/student` route with metrics cards, submission history table, and Student Login tab.
- **Testing & Verification:** Live smoke test passed (authenticated Mafruza Rahman `NDA-01` -> rendered dashboard).

#### BUG-018: Login Error Handling Server Exception Masking
- **Severity:** Medium | **Category:** Authentication UX & Security
- **Root Cause:** Server errors were either masked by generic React digests or leaked raw database exception text.
- **Affected Files:** [`src/app/actions/auth-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/auth-actions.ts).
- **Deployed Solution in `286926e`:** Standardized return `{ success: false, error: '...' }` with sanitized error messages.
- **Testing & Verification:** Verified invalid credential error banners in live browser smoke tests.

#### BUG-021: Unverified Backup Creation & Silent Error Suppression
- **Severity:** High | **Category:** Backup Reliability
- **Root Cause:** Backup script caught errors and logged warnings without halting execution or verifying file existence.
- **Affected Files:** [`src/scripts/pocketbase-backup.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/scripts/pocketbase-backup.ts).
- **Deployed Solution in `286926e`:** Enforced mandatory `pb.backups.getFullList()` verification and non-zero size checks.
- **Testing & Verification:** Verified in Step 1 backup execution.

#### BUG-022: Unsafe Security Rollback Fallback to Empty String `""`
- **Severity:** Critical | **Category:** Disaster Recovery Safety
- **Root Cause:** Prior rollback script defaulted missing rule fields to `""` (publicly open).
- **Affected Files:** `src/scripts/phase1a-security-rollback.ts`.
- **Deployed Solution in `286926e`:** Strictly requires a validated snapshot and preserves `null` values faithfully without coercion.
- **Testing & Verification:** Script inspected and validated against `rules_snapshot_1794464541002.json`.

#### BUG-023: Security Verification False Positives on HTTP 404
- **Severity:** High | **Category:** QA Safety
- **Root Cause:** Verification script treated 404 as "Blocked", masking open collections with missing IDs.
- **Affected Files:** `src/scripts/phase1a-security-verify.ts`.
- **Deployed Solution in `286926e`:** Treats HTTP 404 as an explicit security failure; strictly requires HTTP 403/401.
- **Testing & Verification:** Verified in Step 2 security audit (55/55 endpoints verified).

#### BUG-024: Verification Fixtures Contaminating Real Academy Records
- **Severity:** Medium | **Category:** Data Integrity
- **Root Cause:** Test scripts attached probe fixtures to real production courses (`courses[0]`).
- **Affected Files:** `src/scripts/phase1b-schema-verify.ts`, `src/scripts/phase1c-indexes-verify.ts`.
- **Deployed Solution in `286926e`:** Rewritten to create dedicated isolated test courses and clean up in `finally` blocks.
- **Testing & Verification:** Script code inspected and verified.

#### BUG-025: Hardcoded Director Master Password Fallback in Code
- **Severity:** Critical | **Category:** Credential Security
- **Root Cause:** Static password fallback in `adminLoginAction`.
- **Affected Files:** [`src/app/actions/auth-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/auth-actions.ts#L60).
- **Deployed Solution in `286926e`:** Removed static fallback; fails closed if `ADMIN_MASTER_PASSWORD` is absent.
- **Testing & Verification:** Unit test confirms system fails closed.

#### BUG-026: Non-Constant-Time Session HMAC Verification (`!==`)
- **Severity:** Medium | **Category:** Side-Channel Resistance
- **Root Cause:** JavaScript standard string equality leaked signature timing.
- **Affected Files:** [`src/lib/session.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/session.ts#L39).
- **Deployed Solution in `286926e`:** Integrated `safeCompare` using constant-time evaluation.
- **Testing & Verification:** Verified in `pin-auth.test.ts`.

#### BUG-027: Missing Expiration Timestamp Validation in Session Tokens
- **Severity:** Medium | **Category:** Session Lifecycle
- **Root Cause:** Tokens had no server-side expiration validation and relied entirely on browser cookie lifetime.
- **Affected Files:** [`src/lib/session.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/session.ts#L41-L45).
- **Deployed Solution in `286926e`:** Enforced 30-day maximum age check; rejects tokens from the future.
- **Testing & Verification:** 4 unit tests in `session.test.ts` passing.

#### BUG-028: Legacy PostgreSQL Scripts Left in `src/scripts/`
- **Severity:** Medium | **Category:** Technical Debt
- **Root Cause:** 9 obsolete Postgres migration scripts remained in source tree after PocketBase adoption.
- **Affected Files:** `src/scripts/legacy_postgres/`, `package.json`.
- **Deployed Solution in `286926e`:** Archived all 9 scripts into `src/scripts/legacy_postgres/`; sanitized `package.json`.
- **Testing & Verification:** TypeScript build check passed cleanly.

#### BUG-029: Field Naming Discrepancy (`duration` vs `duration_minutes`)
- **Severity:** Low | **Category:** Schema Alignment
- **Root Cause:** Spec called for `duration`, scripts implemented `duration_minutes`.
- **Affected Files:** `phase1b-schema-create.ts`, `src/lib/types.ts`.
- **Deployed Solution in `286926e`:** Standardized on `duration_minutes` across all schemas, types, and forms.
- **Testing & Verification:** Codebase grep confirms consistent naming.

#### BUG-030: Missing Unique Index on `course_settings.course`
- **Severity:** Medium | **Category:** Database Integrity
- **Root Cause:** `INDEX_PLANS` omitted `course_settings`.
- **Affected Files:** `src/scripts/phase1c-indexes-create.ts`.
- **Deployed Solution in `286926e`:** Added `idx_course_settings_course` definition to index plans.
- **Testing & Verification:** Verified in `phase1c-indexes-preflight.ts`.

#### BUG-031: Director Master Password Leaked in Public Client Placeholder
- **Severity:** Critical | **Category:** Active Exposure
- **Root Cause:** Master password hardcoded into HTML placeholder attribute of login form.
- **Affected Files:** [`src/components/auth/teacher-login-form.tsx`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/components/auth/teacher-login-form.tsx#L230).
- **Deployed Solution in `286926e`:** Placeholder purged; generic text restored; bundles verified clean.
- **Testing & Verification:** Grep on `.next/` bundle confirmed 0 occurrences. Live `/login` page inspected.

#### BUG-032: Unauthenticated & Un-rate-limited Student PIN Reset Action
- **Severity:** Critical | **Category:** Account Takeover Vulnerability
- **Root Cause:** `changeStudentPinAction` allowed arbitrary unauthenticated PIN resets.
- **Affected Files:** [`src/app/actions/auth-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/auth-actions.ts#L168-L205).
- **Deployed Solution in `286926e`:** Enforced session authentication, student identity match, sliding-window rate limiting, and PIN strength validation.
- **Testing & Verification:** 47 automated unit tests passing in `pin-auth.test.ts`.

#### BUG-035: Type Error & Auth Bypass in Proposed `voidTeachingRecordAction`
- **Severity:** High | **Category:** Authorization Guard
- **Root Cause:** Passing role array to `requireAccess` fell through to public mode.
- **Affected Files:** [`src/lib/auth-guard.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/auth-guard.ts), [`src/app/actions/admin-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/admin-actions.ts).
- **Deployed Solution in `286926e`:** Updated `requireAccess` to accept `AccessArea | AccessArea[]` with strict role enforcement.
- **Testing & Verification:** TypeScript build check passed; unit tests passing.

#### BUG-036: Dashboard Syllabus Metrics Coupled Exclusively to `entries`
- **Severity:** High | **Category:** Metric Integrity
- **Root Cause:** Metrics queried only `entries`, risking a drop to 0% progress when entries migrate.
- **Affected Files:** [`src/lib/dashboard-data.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/dashboard-data.ts).
- **Deployed Solution in `286926e`:** Updated `getDashboardData()` to query both `entries` and `teaching_records`.
- **Testing & Verification:** Verified on live dashboard smoke test.

#### BUG-037: In-Memory Rate Limiter Bypass via `X-Forwarded-For` Spoofing
- **Severity:** High | **Category:** Rate-Limiter Bypass
- **Root Cause:** Taking index 0 of `X-Forwarded-For` extracted untrusted client-supplied header.
- **Affected Files:** [`src/lib/rate-limit.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/rate-limit.ts).
- **Deployed Solution in `286926e`:** Implemented `getClientIp()` extracting rightmost proxy-verified IP address.
- **Testing & Verification:** Unit test in `pin-auth.test.ts` passing.

#### BUG-038: Concurrent Request Race Condition in Student PIN Lockout Check
- **Severity:** High | **Category:** Concurrency / Lockout Bypass
- **Root Cause:** Asynchronous delay between attempt check and failure recording allowed concurrent requests to bypass lockout.
- **Affected Files:** [`src/lib/rate-limit.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/rate-limit.ts).
- **Deployed Solution in `286926e`:** Implemented atomic in-flight attempt reservation in `try ... finally` blocks.
- **Testing & Verification:** Concurrency race condition test in `pin-auth.test.ts` passing.

#### BUG-040: Session Auth Bypass on Student PIN Change When `studentId` Undefined
- **Severity:** High | **Category:** Authorization Bypass
- **Root Cause:** `if (session.studentId && session.studentId !== student.id)` failed open when `session.studentId` was undefined.
- **Affected Files:** [`src/app/actions/auth-actions.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/actions/auth-actions.ts#L248).
- **Deployed Solution in `286926e`:** Changed to strict `if (!session.studentId || session.studentId !== student.id)`.
- **Testing & Verification:** Unit test in `pin-auth.test.ts` passing.

#### BUG-041: Unbounded Memory Allocation & OOM Risk in Rate Limiting Cleanup
- **Severity:** Medium | **Category:** Denial of Service
- **Root Cause:** In-memory maps had no size cap, allowing memory exhaustion attacks via spoofed IPs.
- **Affected Files:** [`src/lib/rate-limit.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/rate-limit.ts), [`src/app/api/submit/route.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/api/submit/route.ts).
- **Deployed Solution in `286926e`:** Added hard cap (`MAX_IP_BUCKETS = 10,000`) and FIFO eviction algorithm.
- **Testing & Verification:** Memory capacity test in `pin-auth.test.ts` passing.

#### BUG-043: Timing Information Side-Channel in `safeCompare` Length Mismatch
- **Severity:** Low | **Category:** Cryptographic Resistance
- **Root Cause:** String length inequality triggered variable-length timing.
- **Affected Files:** [`src/lib/rate-limit.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/rate-limit.ts).
- **Deployed Solution in `286926e`:** Pre-hashes both inputs with SHA-256 before `timingSafeEqual`.
- **Testing & Verification:** 5 unit tests in `pin-auth.test.ts` passing.

#### BUG-045: Unprotected Student PIN Brute-Force Path in `/api/submit`
- **Severity:** High | **Category:** Brute-Force Vulnerability
- **Root Cause:** `/api/submit` verified student PIN without updating student lockout counters.
- **Affected Files:** [`src/app/api/submit/route.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/app/api/submit/route.ts), [`src/lib/student-guard.ts`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/src/lib/student-guard.ts).
- **Deployed Solution in `286926e`:** Integrated student rate limiting and lockout counters into submission path.
- **Testing & Verification:** Unit test in `pin-auth.test.ts` passing.

---

## 6. Recommended Execution Order (Post-Showcase)

To preserve system stability and guarantee zero data loss, future execution should follow this sequence:

```mermaid
timeline
    title Post-Showcase Remediation Roadmap
    section Stage 1 : Infrastructure & Rotation
        BUG-042 : Rotate Secrets in Coolify Panel
        BUG-042 : Scrub Git Commit History
    section Stage 2 : Database Provisioning
        Operation B : Create teaching_records collection
        Operation C : Apply composite SQLite indexes
    section Stage 3 : Data Migration
        BUG-010 : Migrate 6 fabricated entries to teaching_records
        BUG-011 : Verify genuine student entries intact
    section Stage 4 : Credential Protection
        BUG-004 & BUG-005 : Execute PIN Scrypt Hashing Migration
    section Stage 5 : Distributed Scalability
        BUG-039 : Deploy Redis & shared token bucket
```

### Detailed Sequence Stages:

1. **Stage 1: Credential Rotation & Git History Scrubbing (BUG-042)**
   - *Timing:* Within 48 hours post-showcase.
   - *Actions:* Rotate `ADMIN_MASTER_PASSWORD`, `PB_ADMIN_PASSWORD`, and `SESSION_SECRET` in Coolify VPS panel. Run `git-filter-repo` on local mirror and force-push sanitized history to GitHub.
   - *Operator Approval Required:* **YES**.

2. **Stage 2: Database Schema & Index Provisioning (Operation B & Operation C / BUG-012, BUG-013)**
   - *Timing:* Next scheduled maintenance window.
   - *Actions:* Create Tier 1 backup. Execute `phase1b-schema-create.ts` (`teaching_records`), followed by `phase1c-indexes-create.ts` (SQLite indexes).
   - *Operator Approval Required:* **YES**.

3. **Stage 3: Fabricated Entry Migration & Data Integrity Assertion (BUG-010, BUG-011)**
   - *Timing:* Immediately following Stage 2.
   - *Actions:* Migrate the 6 teacher-endorsed entries from `entries` to `teaching_records`. Assert that `7lhmo4p1mzkw9w2` and `pogx003bic5x4pi` remain untouched in `entries`.
   - *Operator Approval Required:* **YES**.

4. **Stage 4: PIN Scrypt Hashing Migration (BUG-004, BUG-005)**
   - *Timing:* Following Stage 3.
   - *Actions:* Run `migrate-pins-to-hashes.ts --execute` to populate `pin_hash` for all students and teachers with dual-verification fallback. Nullify plaintext PINs after 14 days.
   - *Operator Approval Required:* **YES**.

5. **Stage 5: Distributed Rate Limiting (BUG-039)**
   - *Timing:* Prior to horizontal clustering or scaling Next.js past single-container deployment.
   - *Actions:* Deploy Redis on Coolify; configure `REDIS_URL`.
   - *Operator Approval Required:* **NO** (Standard application configuration).

---

## 7. Approval Gates & Sign-Off Matrix

The following table explicitly delineates the boundary between operations requiring operator authorization and autonomous code maintenance:

| Operation / Task | Target Scope | Risk Level | Explicit Approval Required? | Rollback Tooling Available |
| :--- | :--- | :---: | :---: | :--- |
| **Operation B: Create `teaching_records`** | Production PocketBase Schema | Low | **YES** | `src/scripts/phase1b-schema-rollback.ts` |
| **Operation C: Create Database Indexes** | Production SQLite Indexes | Medium | **YES** | `src/scripts/phase1c-indexes-rollback.ts` |
| **BUG-010: Migrate 6 Fabricated Entries** | Production `entries` Records | Medium | **YES** | `backup_security_1794464541002.zip` |
| **BUG-004/005: PIN Scrypt Migration** | Production Student & Teacher PINs | High | **YES** | `src/scripts/rollback-pin-migration.ts` |
| **BUG-042: Git History Scrubbing & Force Push** | GitHub Repository Commit Tree | High | **YES** | Pre-scrub bare git mirror bundle |
| **BUG-042: Coolify Secret Rotation** | Production Host Environment | High | **YES** | Coolify Environment Variable Snapshot |
| **BUG-039: Redis Rate Limiting** | Next.js Rate Limiter Transport | Low | **NO** | Automatic fallback to in-memory maps |

---

*End of Permanent Pending Bugs Remediation Plan. Preserved in repository root for post-showcase operational execution.*
