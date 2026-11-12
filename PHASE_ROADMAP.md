# Syllabus Tracker — Multi-Phase Architecture & Remediation Roadmap

**Document Status:** OFFICIAL ROADMAP SPECIFICATION  
**Last Updated:** 2026-11-11  
**Project:** Abhigyan Academy Syllabus Tracker  
**Source of Truth:** [`BUGS_AND_ISSUES_REGISTER.md`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md)  
**Execution Guard:** **STRICT READ-ONLY MODE. PHASE 1 EXECUTION PENDING PRECONDITION APPROVAL.**

---

## 1. Roadmap Architecture & Phased Overview

The long-term development and hardening of the Abhigyan Academy Syllabus Tracker is organized into four sequential, dependency-ordered phases. Each phase addresses a specific domain of reliability, security, and functionality:

```
+--------------------------------------------------------------------------+
| Phase 1: Security Lockdown, Schema Isolation, Indexing & Data Protection |
|  - Eliminate public REST access on all 11 collections                     |
|  - Create `teaching_records` and stop student entry fabrication          |
|  - Apply database unique and performance indexes                          |
|  - Migrate 6 fabricated entries and safeguard 2 genuine submissions      |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| Phase 2: Authentication Hardening, Session Security & PII Protection     |
|  - Hash student and faculty PINs using salted algorithms (scrypt/bcrypt) |
|  - Remove hardcoded secrets from source code                             |
|  - Enforce Secure cookie flags and constant-time HMAC token verification  |
|  - Eliminate public student roster directory leakage on `/submit`        |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| Phase 3: Functional Workflows, Student Dashboard & Admin Reliability      |
|  - Build dedicated `/student` personal tracking dashboard                |
|  - Refactor sequence-jump detection to respect endorsed teaching records |
|  - Implement atomic admin mutations (compensating transactions / batches) |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| Phase 4: Performance Optimization, RFC 4180 CSV & Tech Debt Cleanup      |
|  - Robust CSV import parser supporting quotes, commas, and row reports   |
|  - Archive obsolete PostgreSQL migration scripts and dead dependencies   |
|  - Clean up package.json test scripts and optimize build pipelines       |
+--------------------------------------------------------------------------+
```

---

## 2. Phase 1 — Security Lockdown, Schema Isolation & Database Indexing

**Current Status:** **PLANNED & AUDITED (NO-GO — Preconditions Pending)**  
**Target Completion:** Immediate Next Execution Cycle  
**Prerequisites:** VPS Hypervisor Snapshot, Superuser Authentication, Script Files Written to Disk.

### Primary Objectives
1. Eliminate the critical vulnerability where all 11 PocketBase collections permit unrestricted unauthenticated public reading, modification, and deletion.
2. Halt student submission fabrication by creating `teaching_records` and refactoring `teacherEndorseTopicAction()`.
3. Apply unique and performance indexes across all collections after confirming 0 duplicate conflicts exist.
4. Establish zero-data-loss migration for 6 fabricated records while preserving 2 genuine student entries.

### Associated Bug Register IDs (20 Issues)
- [`BUG-001`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-001-unrestricted-pocketbase-collection-api-rules-): Unrestricted PocketBase Collection API Rules (`""`)
- [`BUG-002`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-002-public-exposure-of-student-pii--pins-via-rest-api): Public Exposure of Student PII & PINs via REST API
- [`BUG-009`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-009-teacher-endorsement-fabricates-student-entries): Teacher Endorsement Fabricates Student Entries
- [`BUG-010`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-010-six-fabricated-entries-in-production-attributed-to-ashish-sir): Six Fabricated Entries in Production Attributed to Ashish Sir
- [`BUG-011`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-011-preservation-of-two-genuine-student-submissions): Preservation of Two Genuine Student Submissions
- [`BUG-012`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-012-missing-teaching_records-collection-for-faculty-worklogs): Missing `teaching_records` Collection for Faculty Worklogs
- [`BUG-013`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-013-missing-database-indexes-across-all-11-collections): Missing Database Indexes Across All 11 Collections
- [`BUG-019`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-019-production-deployment-verification-of-commit-bcdddf5): Production Deployment Verification of Commit `bcdddf5` *(Verified)*
- [`BUG-020`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-020-collection-inventory-reconciliation-phantom-system_config): Collection Inventory Reconciliation *(Verified)*
- [`BUG-021`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-021-unverified-backup-creation--silent-error-suppression): Unverified Backup Creation & Silent Error Suppression
- [`BUG-022`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-022-unsafe-security-rollback-fallback-to-empty-string-): Unsafe Security Rollback Fallback to Empty String `""`
- [`BUG-023`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-023-security-verification-false-positives-on-http-404): Security Verification False Positives on HTTP 404
- [`BUG-024`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-024-verification-fixtures-contaminating-real-academy-records): Verification Fixtures Contaminating Real Academy Records
- [`BUG-029`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-029-field-naming-discrepancy-duration-vs-duration_minutes): Field Naming Discrepancy (`duration` vs `duration_minutes`)
- [`BUG-030`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-030-missing-unique-index-on-course_settingscourse): Missing Unique Index on `course_settings.course`
- [`BUG-031`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-031-director-master-password-leaked-in-public-client-component-placeholder): Director Master Password Leaked in Public Client Placeholder *(Hotfix)*
- [`BUG-033`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-033-existing-server-backup-predates-genuine-student-entry-2-fatal-data-loss-gap): Existing Server Backup Predates Genuine Student Entry #2 *(Fatal Data-Loss Gap)*
- [`BUG-034`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-034-compilation--runtime-crash-in-security-verification-script): Compilation & Runtime Crash in Security Verification Script
- [`BUG-035`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-035-type-error--auth-bypass-in-proposed-voidteachingrecordaction): Type Error & Auth Bypass in Proposed `voidTeachingRecordAction`
- [`BUG-036`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-036-dashboard-syllabus-metrics-coupled-exclusively-to-entries): Dashboard Syllabus Metrics Coupled Exclusively to `entries`

### Implementation Milestones & Work Packages
- **WP 1.1:** Save and type-check the 13 Phase 1 scripts into `src/scripts/`, fix `export const PB_URL` in `src/lib/pb.ts`, and fix `voidTeachingRecordAction`.
- **WP 1.2:** Capture out-of-band VPS snapshot and fresh Tier 1 backup post-dating `pogx003bic5x4pi`.
- **WP 1.3:** Hotfix `/login` client placeholder to remove leaked master password (`BUG-031`).
- **WP 1.4:** Execute Operation A (Pre-flight backup -> Rule lockdown to `null` -> Immediate verification -> 55-endpoint security test).
- **WP 1.5:** Execute Operation B (Schema backup -> Create `teaching_records` collection -> Soft-void probe test).
- **WP 1.6:** Execute Operation C (Duplicate preflight scan -> Index backup -> Apply SQLite unique/query indexes -> Constraint enforcement test).
- **WP 1.7:** Data migration: Map 6 fabricated entries to `teaching_records` sessions; update `dashboard-data.ts` to query `teaching_records`; verify integrity; execute surgical removal of only the 6 IDs from `entries`. Confirm 2 genuine records are unchanged.

### Exit & Verification Criteria
- All 55 endpoints across 11 collections return HTTP 403 Forbidden to unauthenticated requests.
- `teaching_records` collection exists with locked rules (`null`) and 20 validated fields.
- 100% of planned indexes applied in PocketBase; duplicate preflight reports 0 errors.
- Records `7lhmo4p1mzkw9w2` and `pogx003bic5x4pi` remain intact in `entries`.
- 6 fabricated records successfully migrated to `teaching_records`.
- Public login placeholder cleaned of password.

---

## 3. Phase 2 — Authentication Hardening, Session Security & PII Protection

**Current Status:** **SCHEDULED**  
**Target Completion:** Follows Phase 1 Verification  
**Prerequisites:** Phase 1 complete; Director approval for secret rotation.

### Primary Objectives
1. Eliminate plaintext credential storage for students and instructors by implementing salted hashing.
2. Remove hardcoded fallback secrets from source code to ensure system fails closed if environment variables are missing.
3. Harden HTTP session cookies with `Secure`, `HttpOnly`, `SameSite=Lax`, and constant-time HMAC verification.
4. Prevent public student directory harvesting on `/submit`.
5. Secure student PIN change action against unauthenticated hijacking.

### Associated Bug Register IDs (11 Issues)
- [`BUG-003`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-003-public-student-roster-directory-harvest-on-submit): Public Student Roster Directory Harvest on `/submit`
- [`BUG-004`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-004-plaintext-student-pin-storage--direct-comparison): Plaintext Student PIN Storage & Direct Comparison
- [`BUG-005`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-005-plaintext-faculty-pin-storage--direct-comparison): Plaintext Faculty PIN Storage & Direct Comparison
- [`BUG-006`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-006-insecure-session-cookie-configuration-secure-false): Insecure Session Cookie Configuration (`secure: false`)
- [`BUG-007`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-007-hardcoded-fallback-session-hmac-secret-in-source): Hardcoded Fallback Session HMAC Secret in Source
- [`BUG-008`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-008-hardcoded-pocketbase-superuser-credentials-in-source): Hardcoded PocketBase Superuser Credentials in Source
- [`BUG-018`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-018-login-error-handling-server-exception-masking): Login Error Handling Server Exception Masking (Sanitize catch blocks)
- [`BUG-025`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-025-hardcoded-director-master-password-fallback-in-code): Hardcoded Director Master Password Fallback in Code
- [`BUG-026`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-026-non-constant-time-session-hmac-verification-): Non-Constant-Time Session HMAC Verification (`!==`)
- [`BUG-027`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-027-missing-expiration-timestamp-validation-in-session-tokens): Missing Expiration Timestamp Validation in Session Tokens
- [`BUG-032`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-032-unauthenticated--un-rate-limited-student-pin-reset-action): Unauthenticated & Un-rate-limited Student PIN Reset Action

### Implementation Milestones & Work Packages
- **WP 2.1 (PIN Hashing Migration):** Add `pin_hash` field to `students` and `teachers`. Author migration script to hash existing PINs using Node `crypto.scrypt` with random salt. Update `verifyStudent()` and `teacherLoginAction()`. Drop plaintext `pin` columns.
- **WP 2.2 (Secret Sanitation & Fail-Closed Guards):** Remove default fallbacks in `src/lib/session.ts`, `src/lib/pb.ts`, and `src/app/actions/auth-actions.ts`. Add runtime assertion crashing on boot if secrets are missing or under minimum entropy. Rotate PocketBase superuser password in production.
- **WP 2.3 (Session Hardening):** Set `secure: process.env.NODE_ENV === 'production'`. Replace `!==` in `verifyPayload()` with `crypto.timingSafeEqual()`. Enforce `Date.now() - payload.createdAt < MAX_AGE`.
- **WP 2.4 (`/submit` Privacy Refactor):** Remove global student roster download from `getSubmitFormData()`. Refactor form to require student Roll Number entry, validating against server action before rendering subject/topic choices.

### Exit & Verification Criteria
- Database contains 0 plaintext PINs.
- Server refuses to boot when `SESSION_SECRET` or `ADMIN_MASTER_PASSWORD` is omitted.
- Session cookie has `Secure`, `HttpOnly`, `SameSite=Lax` flags in browser headers.
- `/submit` page HTML and RSC payload contain 0 student names or roll numbers.

---

## 4. Phase 3 — Functional Workflows, Student Dashboard & Admin Reliability

**Current Status:** **SCHEDULED**  
**Target Completion:** Follows Phase 2  
**Prerequisites:** Phase 2 complete.

### Primary Objectives
1. Provide enrolled students with a dedicated `/student` dashboard to view class logs, syllabus completion percentage, and faculty remarks.
2. Correct sequence-jump analysis in `analyzeMisuseFlags()` to compare submissions against verified `teaching_records`.
3. Eliminate race conditions and orphaned records by implementing atomic admin mutations.

### Associated Bug Register IDs (3 Issues)
- [`BUG-014`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-014-erroneous-sequence-jump-flags-in-anti-misuse-engine): Erroneous Sequence Jump Flags in Anti-Misuse Engine
- [`BUG-015`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-015-non-atomic-multi-collection-admin-mutations): Non-Atomic Multi-Collection Admin Mutations
- [`BUG-017`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-017-missing-dedicated-student-dashboard-ui): Missing Dedicated Student Dashboard UI

### Implementation Milestones & Work Packages
- **WP 3.1 (Student Dashboard):** Create `src/app/student/page.tsx` with student session guard (`requireAccess('student')`). Render personal attendance history, topic approval status, and teacher remarks.
- **WP 3.2 (Anti-Misuse Engine Calibration):** Update `analyzeMisuseFlags()` to query `teaching_records` for the active subject/batch. Only flag sequence jumps if submitted topic exceeds highest taught session by > 3.
- **WP 3.3 (Atomic Admin Mutations):** Wrap multi-record operations in `src/app/actions/admin-actions.ts` (`createCourseAction`, `allocateTeacherAction`) using PocketBase batch transactional API (`pb.createBatch()`) or compensating try/catch rollbacks.

### Exit & Verification Criteria
- Students can log in with Roll No + PIN and view personal dashboard.
- Submitting topics within taught range produces 0 false `FLAG_SEQUENCE_JUMP` flags.
- Simulating network drop during course creation leaves 0 orphaned records in `courses`.

---

## 5. Phase 4 — Performance, RFC 4180 CSV Ingestion & Tech Debt Cleanup

**Current Status:** **SCHEDULED**  
**Target Completion:** Final Hardening Milestone  
**Prerequisites:** Phase 3 complete.

### Primary Objectives
1. Replace naive string splitting in CSV imports with an RFC 4180 compliant parser.
2. Remove legacy PostgreSQL scripts from `src/scripts/` to eliminate developer confusion and broken package commands.
3. Optimize database query batching and production caching headers.

### Associated Bug Register IDs (2 Issues)
- [`BUG-016`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-016-naive-csv-import-parser-splits-on-raw-commas--newlines): Naive CSV Import Parser Splits on Raw Commas & Newlines
- [`BUG-028`](file:///home/ayush/.gemini/antigravity/scratch/syllabus-tracker/BUGS_AND_ISSUES_REGISTER.md#bug-028-legacy-postgresql-scripts-left-in-srcscripts): Legacy PostgreSQL Scripts Left in `src/scripts/`

### Implementation Milestones & Work Packages
- **WP 4.1 (RFC 4180 CSV Parser):** Integrate streaming CSV parser (`papaparse` or native tokenizer) into `bulkImportTopicsCsvAction` and `bulkImportStudentsCsvAction`. Support commas inside quotes, multi-line fields, and generate detailed line-by-line validation reports.
- **WP 4.2 (Legacy Tech Debt Archive):** Move obsolete PostgreSQL scripts (`cleanup-mock-and-ingest-real.ts`, `migrate.ts`, `seed.ts`, etc.) to `database/legacy_archive/` or delete them. Update `package.json` scripts (`db:migrate`, `test:api`) to target PocketBase exclusively.
- **WP 4.3 (Performance Tuning):** Add Redis/in-memory cache for static curriculum lookups and configure stale-while-revalidate caching headers.

### Exit & Verification Criteria
- CSV with quoted commas imports with 100% column fidelity.
- Zero references to `pg` or `../lib/db` remain in active `src/scripts/`.
- All `package.json` scripts execute cleanly and pass automated CI testing.

---

## 6. Comprehensive Phase Summary Matrix

| Phase | Focus Area | Bug IDs Addressed | Total Issues | Critical / High | Target Collections / Components | Exit Gate |
|---|---|---|---|---|---|---|
| **Phase 1** | Security Lockdown, Schema Isolation, Indexing & Data Integrity | BUG-001, BUG-002, BUG-009, BUG-010, BUG-011, BUG-012, BUG-013, BUG-019, BUG-020, BUG-021, BUG-022, BUG-023, BUG-024, BUG-029, BUG-030 | 15 | 11 | All 11 PB collections, `teaching_records`, `entries` | 55/55 endpoints blocked (403); 6 fabricated entries migrated; 2 genuine entries intact; indexes active |
| **Phase 2** | Authentication Hardening, Session Security & PII Protection | BUG-003, BUG-004, BUG-005, BUG-006, BUG-007, BUG-008, BUG-018, BUG-025, BUG-026, BUG-027 | 10 | 7 | `students`, `teachers`, `session.ts`, `auth-actions.ts`, `/submit` | 0 plaintext PINs; fail-closed secrets; `Secure` cookies; 0 PII leak on `/submit` |
| **Phase 3** | Functional Workflows, Student UI & Admin Reliability | BUG-014, BUG-015, BUG-017 | 3 | 1 | `/student` UI, `analyzeMisuseFlags()`, `admin-actions.ts` | Working student dashboard; accurate sequence flags; atomic mutations |
| **Phase 4** | Performance, RFC 4180 CSV & Tech Debt | BUG-016, BUG-028 | 2 | 0 | `src/scripts/`, CSV actions, `package.json` | RFC 4180 parsing; 0 legacy postgres scripts; clean package scripts |
| **TOTALS** | **Complete Project Roadmap** | **BUG-001 through BUG-030** | **30** | **19** | **Full System Architecture** | **Production Grade Resilience** |
