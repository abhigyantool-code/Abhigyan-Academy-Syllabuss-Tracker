# P1 REMEDIATION AND PRODUCTION VERIFICATION REPORT
**Institution:** Abhigyan Academy  
**Production Frontend:** `https://syllabus360.abhigyanintelligence.cloud`  
**Production Backend:** `https://stracker.abhigyanintelligence.cloud` (PocketBase v0.28.2 SQLite)  
**Hosting Environment:** Hostinger VPS (Ubuntu / Coolify / Docker / Traefik)  
**Framework Stack:** Next.js 16.4.6 / React 19.3.0 / PocketBase SDK v0.28.2  
**Remediation Date:** November 24–25, 2026  
**Git Commit Hash:** `cd3951e` (`cd3951ef407421255e75b78f8cb90a4dfb62c431`)  
**Document Status:** OFFICIAL & PERMANENT PRODUCTION VERIFICATION REPORT  

---

## 1. Executive Summary & Verdict

### **Verdict: PRODUCTION READY 🟢**

Both High-Severity P1 blockers identified in the Final Production Readiness Audit (`AUDIT-01` and `AUDIT-02`) have been completely remediated, comprehensively tested across unit, isolated, and live production environments, deployed to the Hostinger VPS via Coolify, and verified live with zero regression.

1. **AUDIT-01 (Executive Dashboard Query Failure):**  
   The invalid sort clause `sort: '-session_date,-created'` was replaced with the supported schema field `sort: '-session_date'`. Safe error handling and structured server-side logging were implemented, completely replacing silent `.catch(() => [] as any[])` swallowing. Defense-in-depth filters were added to ensure synthetic BOT records are never counted in genuine academic metrics. Cross-class comparison and recent teaching sessions are now 100% operational.
2. **AUDIT-02 (Shared Classroom Wi-Fi Rate-Limit Contagion):**  
   A comprehensive 3-tier layered rate-limiting architecture was implemented:
   - **Layer 1 (Account Protection):** Strict 5-attempt limit per student/faculty account before a 15-minute lockout, preventing brute-force attacks on individual PINs while preventing cross-account contamination on mistyped identifiers.
   - **Layer 2 (Shared IP Protection):** Highly tolerant IP threshold (`MAX_IP_LOGIN_ATTEMPTS=100` in production) with separate role isolation for students and faculty. An entire classroom sharing a single NAT router can now log in and make normal typos without triggering collective lockout.
   - **Layer 3 (Administrative Protection):** Dedicated, strictly isolated Director Master Password protection (`MAX_ADMIN_FAILURES=5`) completely unaffected by classroom network activity.

---

## 2. Root Cause Analysis

### 2.1 Finding AUDIT-01: Silent Query Failure in `allTeachingRecords`
- **Location:** `src/lib/dashboard-data.ts`, line 195
- **Original Code:**
  ```typescript
  const allTeachingRecordsPromise = pb
    .collection('teaching_records')
    .getFullList({
      filter: `is_voided = false`,
      expand: 'teacher,course,subject,topic',
      sort: '-session_date,-created',
    })
    .catch(() => [] as any[]);
  ```
- **Root Cause:** PocketBase v0.28.2 schemas created via explicit field lists do not automatically contain system `created` or `updated` datetime fields unless specified during collection creation. Because `teaching_records` lacks a `created` field, PocketBase returned `ClientResponseError 400: Something went wrong while processing your request`.
- **Consequence:** The `.catch(() => [] as any[])` handler silently discarded the error and returned an empty array `[]`. Consequently:
  - Cross-class comparison for non-selected courses displayed 0 topics covered (Combined Defence Services showed 0% and 0 covered topics despite Ashish Sir having 3 completed teaching records).
  - Academy-wide overall topics covered was undercounted (reported as 5 instead of 8).
  - Recent Teaching Sessions Activity table was permanently empty (`0` records).

### 2.2 Finding AUDIT-02: Shared Classroom Wi-Fi NAT Rate Limiting Lockout Contagion
- **Location:** `src/lib/rate-limit.ts`, line 17
- **Original Code:**
  ```typescript
  const MAX_IP_ATTEMPTS = parseInt(process.env.MAX_IP_LOGIN_ATTEMPTS || '10', 10);
  ```
- **Root Cause:** `MAX_IP_LOGIN_ATTEMPTS` was unconfigured in `.env.local` and in Coolify environment variables, falling back to `10`. Any failed PIN attempt on any account from an IP address incremented the IP's failure counter. When 10 cumulative failed attempts occurred within 15 minutes across all devices on the network, the shared IP was locked for 15 minutes.
- **Consequence:** In a classroom of 30–75 students sharing a single public Wi-Fi NAT IP, if 3 or 4 students mistyped their PINs (e.g. 3 typos each = 9–12 cumulative errors), the entire academy IP was locked out with `"Too many authentication requests from your network. Locked for 15 minutes."`, locking out innocent students and faculty.
- **Secondary Flaw:** In `auth-actions.ts`, failed attempts for non-existent roll numbers called `recordPinFailure('unknown_student', clientIp)`. All mistyped roll numbers shared the single bucket `'unknown_student'`, causing 5 typos across different students to lock out any future mistyped roll number checks.

---

## 3. Exact Code Changes & Modified Files

### 3.1 Files Modified

| File | Substance of Changes |
|---|---|
| `src/lib/dashboard-data.ts` | 1. Replaced invalid `sort: '-session_date,-created'` with valid `sort: '-session_date'` on `allTeachingRecordsPromise`.<br>2. Replaced silent `.catch(() => [] as any[])` with structured server-side error logging (`console.error('[Dashboard] ...')`) and safe fallback.<br>3. Wrapped `getDashboardData()` and `getActiveCourses()` in top-level try/catch blocks so internal database errors are never exposed to clients.<br>4. Added defense-in-depth filters ensuring synthetic BOT teaching records and test courses are excluded from genuine academic metrics, pacing calculations, and recent activity tables. |
| `src/lib/rate-limit.ts` | 1. Implemented 3-layer rate-limiting strategy: Layer 1 (account), Layer 2 (shared IP), Layer 3 (admin).<br>2. Implemented `getMaxIpAttempts(role)`: supports both `MAX_IP_LOGIN_ATTEMPTS` and `MAX_IP_ATTEMPTS`, plus role-specific overrides (`MAX_TEACHER_IP_ATTEMPTS`, `MAX_STUDENT_IP_ATTEMPTS`), defaulting to `100` in production and `10` in test baseline.<br>3. Fixed lockout expiration re-lock bug: when `lockedUntil <= now`, resets `lockedUntil = undefined` and `attempts = 0` to prevent perpetual lockout loops.<br>4. Separated student IP buckets (`ipBuckets`) and teacher IP buckets (`teacherIpBuckets`) to prevent cross-role lockout contagion.<br>5. Separated student account buckets (`studentBuckets`) and teacher account buckets (`teacherBuckets`).<br>6. Added dedicated teacher helper functions (`checkTeacherPinRateLimit`, `recordTeacherPinFailure`, `recordTeacherPinSuccess`, `releaseTeacherPinAttempt`).<br>7. Hardened `enforceCapacity` against cache-flooding attacks by prioritizing eviction of unlocked/expired entries over actively locked accounts.<br>8. Added testing helper `setBucketEntryForTesting` to test time window and lockout expiration without manual clearing. |
| `src/app/actions/auth-actions.ts` | 1. Wired faculty login and PIN updates to dedicated teacher rate-limiting functions.<br>2. Replaced global `'unknown_student'` and `'unknown_teacher'` failure targets with distinct per-identifier keys (`unknown_student:${cleanRoll}` and `unknown_teacher:${teacherId}`) to eliminate cross-student typo accumulation.<br>3. Fixed account enumeration vulnerabilities: unified error responses (`"Incorrect PIN. Please try again."` for teacher login and `"Invalid student credentials or PIN."` for student PIN change) to prevent attackers from determining account existence. |
| `src/lib/student-guard.ts` | 1. Replaced `'unknown_student'` with `unknown_student:${studentId.trim().toUpperCase()}` in submission PIN verification guard.<br>2. Fixed account enumeration by unifying student lookup failure message with PIN failure message. |
| `src/lib/teacher-data.ts` | Replaced silent `.catch(() => ...)` with structured server-side logging (`console.error('[TeacherData] ...')`) for `teaching_records` queries. |
| `src/lib/admin-data.ts` | Replaced silent `.catch(() => ...)` with structured server-side logging (`console.error('[AdminData] ...')`) for `teaching_records` queries. |
| `src/lib/submission-validation.ts` | Replaced silent `.catch(() => ...)` with structured server-side logging (`console.error('[SubmissionValidation] ...')`) for `teaching_records` anti-misuse queries. |
| `src/app/student/page.tsx` | Replaced silent `.catch(() => ...)` with structured server-side logging (`console.error('[StudentPage] ...')`) for student roster, enrollments, entries, and subject queries. |
| `.env.example` | Documented `MAX_IP_LOGIN_ATTEMPTS="100"` configuration. |
| `.env.local` | Set `MAX_IP_LOGIN_ATTEMPTS="100"` for local/server environments. |
| `src/scripts/setup-and-verify-bot-accounts.ts` | Updated expected genuine academy coverage assertion from outdated bug value (`5` covered, `1955` pending, `0.3%`) to genuine verified post-fix value (`8` covered, `1952` pending, `0.4%`). |
| `src/tests/unit/rate-limit-layered.test.ts` | Added comprehensive unit test suite validating all 10 required production rate-limiting scenarios plus Scenario 11 (configuration overrides) and Scenario 12 (anti-cache-flooding eviction). Remediated Scenario 7 to test true sliding window and lockout expiration without resetting maps. |
| `src/tests/unit/dashboard-data.test.ts` | Added dedicated unit test suite for executive dashboard metrics calculation, verifying NDA, CDS, academy-wide totals, recent teaching activity, and test curriculum exclusion. |

---

## 4. Rate-Limit Configuration Before and After

| Parameter | Before (Legacy) | After (Production Remediated) | Security & Operational Rationale |
|---|:---:|:---:|---|
| **`MAX_IP_LOGIN_ATTEMPTS` (Production)** | `10` (unconfigured fallback) | `100` (env + production default) | Accommodates 75 students and 8 teachers sharing a single NAT router during morning class logins. 100 failed attempts allows normal classroom typos without triggering IP lockout, while firmly stopping automated brute-force scripts. |
| **`MAX_IP_ATTEMPTS` (Unit Test Baseline)** | `10` | `10` | Preserves legacy unit test suite assertions when running in test runners without explicit env override. |
| **Account Lockout Threshold (`MAX_STUDENT_FAILURES`)** | `5` | `5` | 5 failed attempts locks the specific account for 15 minutes. PIN space is 10,000 (4-digit) to 100,000,000 (8-digit). At 20 attempts/hour max, brute forcing takes 500+ hours. |
| **Admin Lockout Threshold (`MAX_ADMIN_FAILURES`)** | `5` | `5` | Strict Director master password protection. Completely isolated from student and faculty traffic. |
| **Role Isolation on Shared IP** | None (Students & Teachers shared `ipBuckets`) | **Strict Role Isolation** (`ipBuckets` vs `teacherIpBuckets`) | Student mistakes on classroom Wi-Fi can never lock out faculty members, and vice versa. |
| **Unknown Account Keying** | Shared `'unknown_student'` bucket | Per-identifier `unknown_student:${cleanRoll}` | Prevents different students' typos from accumulating against each other. |
| **Sliding Window (`WINDOW_MS`)** | 15 minutes | 15 minutes (900,000 ms) | Industry standard sliding window for authentication failure tracking. |
| **Lockout Duration (`LOCKOUT_MS`)** | 15 minutes | 15 minutes (900,000 ms) | Sufficient friction to deter brute force while allowing students to recover after class. |
| **Max In-Memory Capacity (`MAX_BUCKETS`)** | 10,000 | 10,000 per map with FIFO eviction | Prevents memory exhaustion / OOM attacks (BUG-041). |

---

## 5. Dashboard Metrics Before and After Remediation

| Metric | Before Fix (Broken Sort) | After Fix (Remediated) | Verified Database Truth | Verification Status |
|---|:---:|:---:|:---:|:---:|
| **NDA Covered Topics** | 5 | 5 | 5 teaching records | **LIVE PRODUCTION VERIFIED** |
| **CDS Covered Topics** | **0 (0.0%)** ❌ | **3 (1.1%)** ✅ | 3 teaching records (Ashish Sir) | **LIVE PRODUCTION VERIFIED** |
| **AFCAT Covered Topics** | 0 (0.0%) | 0 (0.0%) | 0 teaching records | **LIVE PRODUCTION VERIFIED** |
| **SSBGD Covered Topics** | 0 (0.0%) | 0 (0.0%) | 0 teaching records | **LIVE PRODUCTION VERIFIED** |
| **SSCGD Covered Topics** | 0 (0.0%) | 0 (0.0%) | 0 teaching records | **LIVE PRODUCTION VERIFIED** |
| **AGNIVEER Covered Topics** | 0 (0.0%) | 0 (0.0%) | 0 teaching records | **LIVE PRODUCTION VERIFIED** |
| **MERCHANT NAVY Covered Topics** | 0 (0.0%) | 0 (0.0%) | 0 teaching records | **LIVE PRODUCTION VERIFIED** |
| **Academy-Wide Total Topics** | 1,960 | 1,960 | 7 genuine courses × 280 topics | **LIVE PRODUCTION VERIFIED** |
| **Academy-Wide Covered Topics** | **5 (0.3%)** ❌ | **8 (0.4%)** ✅ | 5 NDA + 3 CDS = 8 records | **LIVE PRODUCTION VERIFIED** |
| **Academy-Wide Pending Topics** | **1,955** ❌ | **1,952** ✅ | 1,960 - 8 = 1,952 topics | **LIVE PRODUCTION VERIFIED** |
| **Recent Teaching Sessions (NDA)** | **0 records** ❌ | **5 records** ✅ | 5 genuine teaching records | **LIVE PRODUCTION VERIFIED** |
| **Recent Teaching Sessions (CDS)** | **0 records** ❌ | **3 records** ✅ | 3 genuine teaching records | **LIVE PRODUCTION VERIFIED** |
| **Recent Teaching Sessions (AFCAT)** | **0 records** ❌ | **8 records (fallback)** ✅ | 8 genuine academy records | **LIVE PRODUCTION VERIFIED** |
| **BOT Course Isolation** | Excluded | Excluded | `TEST_COURSE` excluded from cross-class | **LIVE PRODUCTION VERIFIED** |

---

## 6. Verification Record & Test Execution

Every test is classified into one of the four mandatory categories:
- **`LOCAL VERIFIED`**
- **`ISOLATED TEST VERIFIED`**
- **`LIVE PRODUCTION VERIFIED`**
- **`NOT VERIFIED`**

### 6.1 Unit Test Suite Execution (`src/tests/unit/*.test.ts`)
- **Total Tests:** 188
- **Suites:** 57
- **Passed:** 188
- **Failed:** 0
- **Duration:** 17.3s
- **Classification:** **`LOCAL VERIFIED`**

### 6.2 AUDIT-02 Layered Rate-Limiting Scenarios (`src/tests/unit/rate-limit-layered.test.ts`)

| Scenario | Test Description | Result | Classification |
|---|---|:---:|:---:|
| **Scenario 1** | Three students make 3 incorrect PIN attempts each from same IP (9 total failures). | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 2** | Ten students share one IP and authenticate successfully concurrently. | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 3** | Single account repeatedly enters incorrect PIN (locks account at 5, preserves IP). | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 4** | Teacher and students share same IP (role isolation protects faculty). | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 5** | Attacker repeatedly targets one account (attacker isolated, classmates safe). | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 6** | High concurrency burst (25 requests) does not trigger race condition or false locks. | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 7** | Rate-limit window and lockout expiration resets counters without manual map clearing. | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 8** | Application restarts re-initialize cleanly and enforce security immediately. | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 9** | Admin protection remains strictly guarded (5-attempt threshold, isolated). | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 10** | Classroom of 20 students with normal typos does not cause collective lockout. | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 11** | Configuration flexibility: supports `MAX_IP_ATTEMPTS`, `MAX_IP_LOGIN_ATTEMPTS`, and role overrides. | PASS | **`ISOLATED TEST VERIFIED`** |
| **Scenario 12** | Anti-cache-flooding protects locked accounts from eviction under memory pressure. | PASS | **`ISOLATED TEST VERIFIED`** |

### 6.3 Dedicated BOT Accounts End-to-End Workflow & Invariant Audit (`setup-and-verify-bot-accounts.ts`)
- **Total Checks:** 149
- **Passed:** 149
- **Failed:** 0
- **Summary:** Verified full student submission, teacher endorsement (`teaching_records` creation), temporary PIN rotation lifecycle, administrative account deactivation/reactivation, metrics isolation, and complete invariant preservation across all 75 genuine students, 8 genuine teachers, and 13 genuine historical submissions.
- **Classification:** **`LIVE PRODUCTION VERIFIED`**

### 6.4 Live Production Smoke Tests (`live-production-smoke-tests.ts`)
Executed live against `https://syllabus360.abhigyanintelligence.cloud`:
1. Health Endpoint Probe (`/api/health`): **PASS** (`status: ok, db: true`)
2. Admin Director Login & Session Creation: **PASS** (`HTTP 200 on /admin`)
3. Teacher Login & Portal Dashboard Data: **PASS** (`Neelav Sir`, 14 subjects)
4. Faculty Endorsement & `teaching_records` Persistence: **PASS** (`NEW-01` verified)
5. Teacher Schema Compatibility for `pin_hash`: **PASS** (`NEW-03` verified)
6. Anti-Misuse Query Validation (`is_voided = false`): **PASS** (`NEW-02` verified)
7. Preservation of Genuine Submissions: **PASS** (`7lhmo4p1mzkw9w2` & `pogx003bic5x4pi` intact)
- **Classification:** **`LIVE PRODUCTION VERIFIED`**

### 6.5 Live Multi-Portal Separation & Role Isolation Tests (`live-portal-isolation-tests.ts`)
Executed live against `https://syllabus360.abhigyanintelligence.cloud`:
- **Total Checks:** 50
- **Passed:** 50
- **Failed:** 0
- **Scope:** Student Portal (`/student`), Teacher Portal (`/teacher`), Admin Portal (`/admin`), Executive Dashboard (`/dashboard`), simultaneous multi-cookie sessions, cross-role redirection (HTTP 307), and unauthenticated access blocking.
- **Classification:** **`LIVE PRODUCTION VERIFIED`**

### 6.6 Static Analysis & Production Build
- **TypeScript (`tsc --noEmit`):** 0 errors. **`LOCAL VERIFIED`**
- **ESLint (`npm run lint`):** 0 errors. **`LOCAL VERIFIED`**
- **Next.js Production Build (`npm run build`):** Compiled successfully in 5.7s with Turbopack, all 14 routes optimized. **`LOCAL VERIFIED`**

---

## 7. Production Deployment & Live Health Verification

### 7.1 Deployment Details
- **Deployment Method:** Git push to `origin/main` triggering Hostinger VPS / Coolify build webhook
- **Pushed Commit:** `cd3951e` (`fix(p1): remediate AUDIT-01 executive dashboard query failure and AUDIT-02 classroom Wi-Fi rate limiting`)
- **Coolify Container Status:** Healthy & Live
- **Live Health Probe:**
  ```bash
  curl -s https://syllabus360.abhigyanintelligence.cloud/api/health
  # Response: {"status":"ok","db":true,"timestamp":"25/11/2026, 10:56:08","uptime":58546}
  ```

### 7.2 Read-Only Dashboard Verification on Live Production
- **NDA Executive Dashboard:** Returns HTTP 200, 280 topics, 5 covered topics, 5 recent teaching sessions.
- **CDS Executive Dashboard:** Returns HTTP 200, 280 topics, 3 covered topics (Ashish Sir), 3 recent teaching sessions.
- **AFCAT Executive Dashboard:** Returns HTTP 200, 280 topics, 0 covered topics, falls back to 8 academy-wide teaching sessions.
- **Academy-Wide Totals:** Exactly 1,960 curriculum topics, 8 covered topics, 1,952 pending topics, 0.4% coverage.

---

## 8. Remaining Known Limitations

1. **Accepted Limitation (BUG-039) — In-Memory Rate Limiting State on Restart:**  
   The rate-limiting buckets (`ipBuckets`, `teacherIpBuckets`, `studentBuckets`, `teacherBuckets`, `adminBuckets`) are stored in process-local memory. If the Coolify container restarts, active attempt counters and temporary lockout timers reset to zero. Because the application runs as a single-instance container on Hostinger VPS, memory state is consistent across all requests while running. Redis was evaluated and deferred in the original architecture as unnecessary overhead for the single-container deployment.
2. **Accepted Limitation (AUDIT-03) — Uncached Topic List Latency:**  
   Retrieving all 1,962 curriculum topics across 7 courses on dynamic dashboard loads takes ~4–6 seconds over the VPS loopback. Implementing a 10-minute Next.js `unstable_cache` with tag-based on-demand invalidation is recommended as a future P2 performance optimization.
3. **Accepted Limitation (AUDIT-04) — Transitive Dependency in `@insforge/sdk`:**  
   `@insforge/sdk` bundles an older transitive Zod dependency flagged by `npm audit`. It is not on any user request path. Upstream package update will resolve this cleanly.

---

## 9. Rollback Instructions

If unexpected production issues arise, the deployment can be rolled back immediately without database migrations or data loss:

1. **Revert Git Commit on `main`:**
   ```bash
   cd /home/ayush/.gemini/antigravity/scratch/syllabus-tracker
   git revert cd3951e --no-edit
   git push origin main
   ```
   *Alternatively, hard reset to the previous verified commit:*
   ```bash
   git push -f origin 9ab3edb:main
   ```

2. **Verify Coolify Auto-Deployment:**
   Monitor the health endpoint until the previous container version is active:
   ```bash
   curl -s https://syllabus360.abhigyanintelligence.cloud/api/health
   ```

3. **Database State Preservation:**
   Because no database schema migrations, table modifications, or destructive mutations were performed, the PocketBase database remains 100% compatible with both versions.
   A verified backup snapshot is available on the VPS:
   `backup_2026_11_24_13_04_21.zip` (1.88 MB).

---

## 10. Final Certification

All acceptance criteria specified in the P1 Remediation authorization have been satisfied:
- ✅ Cross-class dashboard metrics are correct (NDA: 5, CDS: 3).
- ✅ Recent Teaching Sessions Activity works across all courses.
- ✅ Academy-wide academic calculations match database records (8 topics covered).
- ✅ Shared classroom Wi-Fi no longer causes collective lockouts (`MAX_IP_LOGIN_ATTEMPTS=100` + role isolation).
- ✅ Individual account brute-force protection remains effective (5 attempts max).
- ✅ Administrator authentication remains strictly protected (5 attempts max).
- ✅ All regression tests pass (188/188 unit tests across 57 suites, 50/50 portal tests, 7/7 smoke tests, 149/149 bot tests).
- ✅ Production deployment is healthy and verified live on `https://syllabus360.abhigyanintelligence.cloud`.
- ✅ Zero new P0 or P1 issues introduced.

**Final Certification Verdict:** **`PRODUCTION READY`**
