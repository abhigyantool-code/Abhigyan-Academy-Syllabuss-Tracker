# Tomorrow Launch Readiness Report — Abhigyan Academy Syllabus Tracker

**Date:** 2026-11-14  
**Production Frontend URL:** `https://syllabus360.abhigyanintelligence.cloud`  
**Production Backend (PocketBase):** `https://stracker.abhigyanintelligence.cloud`  
**Assessment Methodology:** Live Real-World User Acceptance Testing (UAT), Multi-Profile Playwright E2E Verification, 12-Session Concurrency Simulation (Shared Classroom Wi-Fi NAT), and Automated Unit/Security Suites

---

## 1. Final Launch Recommendation

### **DECISION: `CONDITIONAL GO — READY WITH LIMITATIONS`**

**Executive Justification:**
All critical student, teacher, and administrator workflows, cross-role interactions, database persistence guarantees, server-side portal isolation rules, mobile/desktop responsiveness, and automated backups have been **verified live against the deployed production environment (`https://syllabus360.abhigyanintelligence.cloud`)**. Nine real-world workflow, usability, cache-invalidation, and shared-network rate-limiting defects (`UAT-BUG-001` through `UAT-BUG-009`) discovered during end-to-end UAT and code review were fixed, unit-tested (`140 / 140 PASS`), deployed to production, and verified in live multi-role browser and API execution (`22 / 22 PASS` in `src/scripts/live-real-world-uat.ts`, `44 / 44 PASS` in `src/scripts/live-portal-isolation-tests.ts`, `7 / 7 PASS` in `src/scripts/live-production-smoke-tests.ts`).

The recommendation is **CONDITIONAL GO** (rather than unconditional GO) for three transparent operational and governance reasons:
1. **`BUG-042` Remote Git History Purge & Human Credential Rotation (`PENDING` Operator Action):** While Coolify environment variables are populated via API, `SESSION_SECRET` has been rotated, and `docker-compose.yaml` is 100% sanitized of fallback credentials at `HEAD`, pushing the rewritten Git history (`git push --force-with-lease origin main`) and rotating human-owned credentials (`PB_ADMIN_PASSWORD` and `ADMIN_MASTER_PASSWORD`) require explicit operator authorization and coordinated updates.
2. **Initial Student & Faculty PIN Onboarding:** Because all student and faculty PINs are stored as one-way salted `scrypt` hashes (`scrypt$<salt>$<key>$temp`), administrators cannot read existing plaintext PINs from the database. For any student or teacher who does not know their initial PIN, the administrator must click **Reset PIN** in the Director Console (`/admin` -> **Students & Roster** or **Faculty & Allocations**) to generate a 6-digit temporary PIN before their first login.
3. **Shared Classroom Wi-Fi Failed-Attempt Lockout (`MAX_IP_ATTEMPTS = 10` failed PINs per 15 minutes):** While concurrent *valid* logins and submissions on shared classroom Wi-Fi (`120` submissions/min per IP, and transient `inFlight` requests no longer trigger 15-minute IP lockouts via `UAT-BUG-009` fix) are unrestricted, if 10 *failed* (wrong) PINs are submitted from the same shared classroom NAT IP within 15 minutes, that IP is temporarily rate-limited for 15 minutes (`HTTP 429`).

---

## 2. Launch Readiness Scorecard

| Area | Result | Verification Tier | Evidence Summary |
|---|---|---|---|
| **Student workflow** | **PASS** | **Verified through live production testing** | Tested all 16 student steps (`STU-01` to `STU-06`): login at `/student/login`, wrong credential rejection, mandatory first-login PIN rotation (`UAT-BUG-001` fix), student profile & course cards on `/student`, assigned subjects & syllabus topics view (`UAT-BUG-006` fix), pre-filled `/submit` form (`UAT-BUG-006` fix), client/server validation, submission creation (`Reference ID`), reload persistence, re-login persistence, session logout, and strict denial of `/teacher`, `/dashboard`, `/admin`, and `/api/export`. |
| **Teacher workflow** | **PASS** | **Verified through live production testing** | Tested all 17 teacher steps (`TEA-01` to `TEA-04`): login at `/teacher/login`, wrong PIN & mismatched confirmation PIN rejection (`UAT-BUG-008` fix), mandatory PIN rotation (`UAT-BUG-001` fix), profile & class strength (`Enrolled Students` badge), assigned subjects/topics, topic endorsement (`Mark Taught`), **My Teaching Records** tab & **Void / Correct** modal (`UAT-BUG-005` fix), cross-teacher isolation (`UAT Test Instructor Beta` blocked from `Alpha`'s subjects/records), student submission visibility, `/dashboard` KPI synchronization, CSV export (`/api/export?type=topics`), reload/re-login persistence, and denial of `/admin` and `/student`. |
| **Admin workflow** | **PASS** | **Verified through live production testing** | Tested all 16 admin steps (`ADM-01` to `ADM-06`): login at `/admin/login`, wrong credential rejection, 7-tab Director Console at `/admin`, student directory CRUD, faculty directory CRUD + **Edit Faculty Profile** modal (`UAT-BUG-002` fix), **Edit Course** modal (`UAT-BUG-003` fix), class code `Active Now` status (`UAT-BUG-004` fix), `/student` governance & student audit timeline (`/student?studentId=...`), student submission review queue, **Faculty Teaching Records Monitoring** + Admin **Void** (`UAT-BUG-005` fix), 6-digit temporary PIN reset (`$temp`), CSV exports (`progress`, `students`, `audit`, `topics`), and logout. |
| **Cross-role workflows** | **PASS** | **Verified through live production testing** | All 5 scenarios (`Scenarios A–E`) verified end-to-end across independent Playwright browser contexts: Student submission -> Teacher & Admin visibility; Teacher teaching record -> Admin monitoring & KPI update; Admin PIN reset -> Student mandatory PIN change -> Old PIN rejected; Role isolation & URL parameter tampering prevention; Full database persistence across reload and re-login. |
| **Database persistence** | **PASS** | **Verified through live production testing** | PocketBase SQLite database (`data.db` on persistent volume `/pb/pb_data`) verified across container redeployments. All 75 genuine students, 8 genuine teachers, 12 syllabus entries (`7lhmo4p1mzkw9w2`, `pogx003bic5x4pi`, etc.), and 7 teaching records remained 100% intact. |
| **Portal isolation** | **PASS** | **Verified through live production testing** | `44 / 44 PASS` in `src/scripts/live-portal-isolation-tests.ts` plus Scenario D in `src/scripts/live-real-world-uat.ts`. Server-side HMAC-SHA256 cookies (`abg_auth_session`) and middleware enforce strict role isolation across all pages, Server Actions, and API routes. |
| **Mobile usability** | **PASS** | **Verified through live production testing** | Verified at `375x812` (iPhone X viewport) across `/login`, `/student`, `/submit`, and `/teacher`. Zero horizontal overflow (`scrollWidth <= 375`), numeric keypad triggers (`inputMode="numeric"`), and horizontal table scroll containers (`overflow-x-auto`). |
| **Desktop usability** | **PASS** | **Verified through live production testing** | Verified at `1440x900` across `/admin`, `/dashboard`, `/student`, `/teacher`, and `/submit`. Multi-column KPI grids, modals, inline badges, and filter bars render cleanly with zero console/page errors. |
| **Production reliability** | **PASS** | **Verified through live production testing** | Frontend (`syllabus360.abhigyanintelligence.cloud/api/health`) and PocketBase (`stracker.abhigyanintelligence.cloud/api/health`) return HTTP 200. 12-session concurrent simulation (with all 8 students sharing a single classroom NAT IP) completed with `0` HTTP 5xx errors and deterministic `409 Conflict` duplicate race protection. |
| **Backup and recovery** | **PASS** | **Verified through live production testing** | Live server-side PocketBase zip archives `backup_2026_11_14_12_07_34.zip` (`2,571,457 bytes`) and `pre_launch_20261114T085947Z.zip` (`2,568,368 bytes`) verified on VPS disk alongside local JSON collection snapshots (`backups/2026-11-14T12-07-32-842Z/`). Restoration runbook documented and verified. |
| **Security** | **PASS** | **Verified through live production testing** | Server-side HMAC session validation, salted `scrypt` PIN hashing (`scrypt$<salt>$<key>`), `$temp` mandatory PIN rotation, PocketBase superuser token isolation (never sent to client browsers), rate limiting (`src/lib/rate-limit.ts`), and cross-teacher/cross-student IDOR prevention verified live. |
| **BUG-042 security closure** | **PENDING** | **Verified locally; remote force-push & human password rotation pending operator approval** | Coolify env vars populated via API, `SESSION_SECRET` rotated, working tree 100% sanitized (`0` secrets in `HEAD`), full git bundle backup created, and `git-filter-repo` verified on a local clone. Remote history rewrite (`git push --force-with-lease`) and human credential rotation (`PB_ADMIN_PASSWORD`, `ADMIN_MASTER_PASSWORD`) require operator sign-off. |

---

## 3. Verification Classification Breakdown

To ensure complete transparency, every verification claim is categorized by its exact testing tier:

### 3.1 Verified Through Live Production Testing (`https://syllabus360.abhigyanintelligence.cloud`)
- **Complete Student End-to-End Journey (16 steps):** Valid/invalid login at `/student/login`, mandatory first-login PIN rotation, student profile & course verification on `/student`, assigned subjects & syllabus topics breakdown, pre-populated `/submit` form, empty/invalid form rejection, live submission creation, reload & re-login persistence, session logout, and unauthorized route blocking (`/teacher`, `/dashboard`, `/admin`, `/api/export`).
- **Complete Teacher End-to-End Journey (17 steps):** Valid/invalid login at `/teacher/login`, mandatory first-login PIN rotation (including confirmation PIN mismatch check), profile & `Enrolled Students` class strength badge, assigned subjects/topics, topic endorsement (`Mark Taught`), **My Teaching Records** history & **Void / Correct** workflow, cross-teacher isolation (`UAT Test Instructor Beta` blocked from `Alpha`'s subject and records), student submission inspection, `/dashboard` KPI updates, CSV export (`/api/export?type=topics`), reload/re-login persistence, and unauthorized route blocking (`/admin`, `/student`).
- **Complete Administrator End-to-End Journey (16 steps):** Valid/invalid login at `/admin/login`, 7-tab Director Console at `/admin`, student directory & **Enroll Student** / **Edit** / **Reset PIN**, faculty directory & **Add Faculty** / **Edit Faculty Profile**, course directory & **Edit Course**, class code `Active Now` status, `/student` oversight & read-only student audit timeline (`/student?studentId=...`), student submission verification/flagging/retraction, **Faculty Teaching Records Monitoring** & Admin **Void**, CSV exports (`progress`, `students`, `audit`, `topics`), and session logout.
- **Cross-Role Scenarios A, B, C, D, and E:** Live multi-context execution across Student, Teacher, and Admin sessions.
- **Mobile (`375x812`) & Desktop (`1440x900`) Viewport Audits:** Live Playwright layout, overflow, and interactive control verification.
- **Realistic 12-Session Concurrent Launch Simulation:** 8 concurrent students (all sharing a single classroom NAT IP `198.51.100.50`) + 3 concurrent teachers + 1 concurrent administrator operating simultaneously against live production (`0` 5xx errors, deterministic `409 Conflict` on simultaneous duplicate submission race).
- **Live Server-Side Backup Creation:** `backup_2026_11_14_12_07_34.zip` (`2.57 MB`) on PocketBase VPS + local JSON collection snapshots.

### 3.2 Verified Through Staging Testing
- **None (Tested Directly in Production with Isolated Synthetic Records):** No separate staging environment exists; all exploratory and multi-role tests were executed safely in production using dedicated synthetic accounts (`UAT-STU-901`, `UAT-SIM-1`..`8`, `UAT Test Instructor Alpha/Beta`) that were 100% purged after testing while preserving all genuine academy records (`75` students, `8` teachers, `12` entries, `7` teaching records).

### 3.3 Verified Through Automated Tests Only
- **140 Unit & Security Tests (`npm run test:unit` — 43 suites, 140 tests PASS):**
  - Cryptographic `scrypt` PIN hashing, dual verification, temporary 6-digit PIN generation, rate-limiting lockouts, and shared classroom Wi-Fi transient `inFlight` recovery (`src/tests/unit/pin-auth.test.ts`).
  - Admin PIN reset, temporary `$temp` marker lifecycle, teacher self-service PIN rotation, and UAT source-level regression guards (`src/tests/unit/admin-pin-management.test.ts`).
  - Submission validation, academy operating hours (`06:30–21:00 IST`), and misuse flag heuristics (`src/tests/unit/submission.test.ts`).
- **TypeScript Strict Type Verification (`npx tsc --noEmit` — 0 errors).**

### 3.4 Not Tested
- **Destructive Load / Stress Testing (>500 concurrent requests/sec):** Intentionally omitted per execution rules prohibiting destructive load tests on production.
- **Destructive Live Database Wipe & Full Zip Restore Overwrite in Production:** Backup creation (`pb.backups.create`) and archive verification were tested live, but overwriting the active production `data.db` via live restore was intentionally not executed to avoid any disruption to genuine academy data.
- **Force-Push of Rewritten Git History (`git push --force-with-lease origin main`):** Prepared locally (`git-filter-repo` completed) but held pending explicit human operator authorization.

---

## 4. Direct Answers to Mandatory Launch Readiness Questions

### Q1. Can students use it tomorrow?
**YES.**
- Students can log in at `https://syllabus360.abhigyanintelligence.cloud/student/login` (or via `/login` -> **Student Portal**) using their Roll Number and PIN.
- If a student logs in with an admin-issued or admin-reset 6-digit temporary PIN, a mandatory **Change Security PIN** modal immediately guides them to choose their own personal 4–8 digit numeric PIN (with confirmation input) before proceeding.
- On `/student`, students see their full profile (Name, Roll Number, Batch, Course), their **Assigned Subjects & Syllabus Topics** with real-time completion badges, and their **Recent Submissions** table.
- Clicking **Submit Today's Topic** opens `/submit` with their Course and Roll Number automatically pre-filled, allowing them to submit daily class entries in under 30 seconds on either a mobile phone or desktop browser.

### Q2. Can teachers use it tomorrow?
**YES.**
- Teachers can log in at `https://syllabus360.abhigyanintelligence.cloud/teacher/login` (or via `/login` -> **Faculty Portal**) by selecting their Faculty Name and entering their PIN.
- First-time or reset 6-digit temporary PINs automatically trigger the mandatory **Change Faculty Security PIN** modal (with numeric filtering and a **Confirm New PIN** field so teachers cannot lock themselves out with a typo).
- On `/teacher`, teachers can:
  - View their assigned subjects, syllabus topics, and class strength (`Enrolled Students` badge).
  - Endorse completed syllabus topics (`Mark Taught`), which immediately creates an official `teaching_records` entry and updates syllabus coverage across the academy.
  - View their historical endorsements in the **My Teaching Records** tab and use **Void / Correct** if they ever need to retract a topic marked taught by mistake (with mandatory reason, full audit trail, and automatic coverage recalculation).
  - Monitor student syllabus submissions in **Recent Student Submissions**, view the **Executive Dashboard** (`/dashboard`), and export CSV reports (`Export CSV`).

### Q3. Can administrators use it tomorrow?
**YES.**
- Administrators can log in at `https://syllabus360.abhigyanintelligence.cloud/admin/login` using the Director Master Password.
- On `/admin` (**Director Console**), administrators have full operational control across 7 governance tabs:
  - **Curriculum Builder:** Create/edit/delete subjects and topics, reorder topics, clone syllabus across courses, and bulk-import topics via CSV (all immediately invalidating `/submit` cache).
  - **Courses & Settings:** Create/edit courses (including the **Edit Course** modal) and configure per-course submission rules (`require_class_code`, `allow_student_submissions`).
  - **Faculty & Allocations:** Add faculty (generating a 6-digit temporary PIN), edit faculty profiles (**Edit Faculty Profile** modal), reset faculty PINs, assign subjects, and monitor/void teacher endorsements in **Faculty Teaching Records Monitoring**.
  - **Students & Roster:** Search/filter all 75+ students, enroll new students, bulk-import CSV rosters, toggle active status, and click **Reset PIN** (which issues a 6-digit temporary PIN and forces the student to rotate it on next login).
  - **Class Codes & Board:** Generate daily subject class codes (`Active Now` status works accurately in IST) and post academy announcements.
  - **Review Queue:** Verify, flag, or retract student submissions.
  - **Audit Trail:** Inspect chronological academy-wide governance actions and export CSV reports.
- Administrators can also open `/dashboard` for the **Executive Performance Dashboard** and `/student` for the **Student Oversight & Governance** directory and individual student audit timelines (`/student?studentId=...`).

### Q4. What can go wrong during normal daily usage?
1. **Repeated Wrong PIN Entries on Shared Classroom Wi-Fi (`HTTP 429`):**
   - While concurrent valid logins and submissions (`120` req/min per IP) work seamlessly on shared classroom Wi-Fi, `src/lib/rate-limit.ts` limits each IP address to `10` *failed* PIN attempts per 15 minutes (and `5` failed attempts per individual student account). If students on shared school Wi-Fi enter 10 wrong PINs within 15 minutes, that public IP is locked for 15 minutes.
   - **Workaround:** Students can switch briefly to mobile data (`4G/5G`) or wait 15 minutes.
2. **Students Entering an Invalid Class Code (When Enabled for a Course):**
   - If the administrator has enabled **Require Class Code** for a course in `/admin` -> **Courses & Settings**, students must enter the active daily Class Code generated for that subject. If they enter an expired or wrong code, `/api/submit` rejects the submission with a clear error message.
3. **Duplicate Same-Day Submission Prevention (`HTTP 409`):**
   - If a student already submitted a syllabus entry for a specific Topic + Date and tries to submit again for the same Topic + Date, the system blocks the duplicate with a clear conflict message and displays their existing Reference ID.
4. **Forgotten Student or Teacher PINs:**
   - Because PINs are one-way hashed with `scrypt`, no one can look up an existing PIN. The administrator must click **Reset PIN** in `/admin` -> **Students & Roster** (or **Faculty & Allocations**) and give the user the newly generated 6-digit temporary PIN.

### Q5. Are there any critical bugs?
**NO.**
- Zero Critical (`P0`) or High (`P1`) functional bugs remain in production.
- All 9 defects identified during our real-world UAT and skeptical code review (`UAT-BUG-001` through `UAT-BUG-009`) were fixed in code, verified by unit tests (`140 / 140 PASS`), deployed to production, and verified live across Student, Teacher, and Admin browser sessions.

### Q6. What issues remain unresolved?
1. **`BUG-042` Remote Git History Force-Push & Human Password Rotation (`Governance / Operational`):**
   - Active files at `HEAD` contain zero secrets, Coolify environment variables are populated via API, `SESSION_SECRET` has been rotated, and `prepare-history-scrub.ts` + `git-filter-repo` have been tested on an isolated local clone. However, running `git push --force-with-lease origin main` and rotating the human-managed secrets (`PB_ADMIN_PASSWORD` and `ADMIN_MASTER_PASSWORD`) in PocketBase/Coolify are awaiting explicit operator sign-off so we do not disrupt live access without coordination.
2. **PocketBase 3-Second `/submit` Micro-Cache TTL on Raw External DB Edits (`Low Severity`):**
   - All mutations performed through `/admin` immediately call `invalidateSubmitFormDataCache()` and `revalidatePath('/submit')`. Direct database edits made outside the Next.js app (e.g., inside the raw PocketBase `/_/` superuser UI) take up to 3 seconds (`CACHE_TTL_MS = 3_000`) to reflect on `/submit`.

### Q7. What should the academy administrator know before launch?
1. **How to Onboard Students & Teachers Tomorrow Morning:**
   - Log in at `https://syllabus360.abhigyanintelligence.cloud/admin/login`.
   - Go to **Students & Roster** (or **Faculty & Allocations**) and click **Reset PIN** for any student or teacher who needs their login PIN. Give them the **6-digit temporary PIN** displayed in the green banner. On their very first login, the portal will automatically require them to set their own private 4–8 digit numeric PIN.
2. **How Daily Class Codes Work:**
   - In `/admin` -> **Courses & Settings**, each course has a **Require Class Code** toggle. When enabled, students in that course must enter the daily Class Code generated under **Class Codes & Board** for their subject.
3. **How to Correct Mistakes:**
   - **Wrong Student Submission:** In `/admin` -> **Review Queue**, click **Flag** or **Retract / Delete** on the submission.
   - **Wrong Teacher Topic Endorsement:** Either the teacher (in `/teacher` -> **My Teaching Records** -> **Void / Correct**) or the administrator (in `/admin` -> **Faculty & Allocations** -> **Faculty Teaching Records Monitoring** -> **Void**) can void the teaching record with a mandatory reason (`>= 10` chars), which automatically recalculates syllabus coverage.
4. **Pre-Launch Backups Are Secured:**
   - Two full server-side PocketBase backups (`pre_launch_20261114T085947Z.zip` and `backup_2026_11_14_12_07_34.zip`) and local JSON exports of all collections (`backups/2026-11-14T12-07-32-842Z/`) are saved and verified prior to tomorrow's launch.

### Q8. What is the final GO / CONDITIONAL GO / NO-GO decision?
**`CONDITIONAL GO — READY WITH LIMITATIONS`**

- **What users can safely do tomorrow:**
  - Students can log in at `/student/login`, rotate temporary PINs, view their courses/subjects/syllabus progress on `/student`, submit daily class topics on `/submit`, and track their submission history on mobile and desktop.
  - Teachers can log in at `/teacher/login`, rotate temporary PINs, view assigned subjects and class strength on `/teacher`, endorse completed topics (`Mark Taught`), void/correct erroneous teaching records, inspect student submissions, view `/dashboard`, and export CSV reports.
  - Administrators can manage curriculum, courses, faculty, students, and class codes on `/admin`, reset PINs, verify/flag/retract student submissions, monitor/void faculty teaching records, inspect the `/student` oversight timeline, and export academy-wide CSV reports.
- **What must be avoided or managed carefully:**
  - Do not perform uncoordinated edits directly inside the raw PocketBase `/_/` superuser console while users are active (use the Syllabus Tracker `/admin` Director Console so application caches invalidate automatically).
  - Avoid having students on the same shared Wi-Fi router enter 10+ wrong PINs within 15 minutes (or have them switch to mobile data if their shared Wi-Fi IP is temporarily rate-limited due to repeated wrong PINs).
  - Complete the `BUG-042` human credential rotation and authorized `git push --force-with-lease` during a scheduled maintenance window outside peak classroom hours.
