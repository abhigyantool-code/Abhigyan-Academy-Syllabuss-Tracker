# Abhigyan Academy — Syllabus & Class Tracker

**Syllabus Tracker** is an enterprise-grade full-stack web application purpose-built for **Abhigyan Academy**, premier coaching academy for defence examinations (**NDA, CDS, SSB Interview, SSC**). It allows students to record topics covered in daily classes, verifies entries against planned curriculum target dates in IST (`Asia/Kolkata`), enforces anti-misuse controls, and gives faculty and leadership real-time visibility into syllabus progress, pacing variance, and teacher scorecards.

---

## 1. System Architecture & Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + Executive Obsidian SaaS Theme + Glassmorphism
- **Database:** PostgreSQL on Supabase (configured strictly through server actions and route handlers; Row-Level Security blocks direct client access)
- **Timezone:** `Asia/Kolkata` (IST) strictly enforced on server-side date resolution and validity windows
- **Validation:** Zod schemas shared across client and server
- **Visualizations:** Recharts for cumulative planned vs actual trajectory curves
- **Testing:** Node.js native test runner (`node:test`) + Tsx for unit tests; Playwright for End-to-End browser workflows

---

## 2. Zero-Rewrite Authentication Architecture (Phase 1)

This phase operates without user logins, accounts, or passwords, yet is built for seamless authentication in future phases:
- **Central Guard:** Every `/admin`, `/dashboard`, and `/api/admin/*` handler passes through `requireAccess(area)` (`src/lib/auth-guard.ts`).
- **Student Verification Hook:** All student identity checks run through `verifyStudent()` (`src/lib/student-guard.ts`), which verifies active status and course enrollment.
- **PIN Preparedness:** `students.pin_hash` exists in the database schema (nullable and unused in Phase 1).
- **Notice Banner:** A persistent badge informs users that authentication is currently open for development review.

---

## 3. Core Portals

### 🎓 1. Student Submission Portal (`/submit`)
- **Mobile-first UI:** Optimized for phone screens (360px–430px) used by 150+ students in classrooms.
- **Dynamic Course Tabs:** Loaded directly from active database records.
- **Cascading Dropdowns (Strict Order):**
  1. **Teacher:** Filtered to faculty assigned to subjects in the course.
  2. **Subject:** Filtered to chosen teacher's subjects in this course.
  3. **Topic:** Ordered by sequence number, displaying `#{seq_no} • {topic_name}`.
  4. **Student Searchable Combobox:** Search by Roll Number or Name; no free-text entry allowed.
  5. **Class Code:** Displayed only when `require_class_code` is enabled; auto-capitalizes input.
  6. **Status:** `Covered`, `Partially Covered`, or `Revision Only`.
  7. **Remarks:** Optional notes.
- **Server-Side Anti-Misuse:**
  - Date set strictly on the server to today (IST).
  - Class code validated against $[valid\_from, valid\_until]$ window.
  - Duplicate prevention: `UNIQUE (student_id, topic_id, class_date)`.
  - Daily submission cap (default 6 entries per student per day).
  - Suspicious entries flagged (`FLAG_SEQUENCE_JUMP`, `FLAG_BURST_RATE`, `FLAG_MULTI_STUDENT_DEVICE`) and queued for review.
  - Honeypot bot protection.

---

### 📊 2. Faculty Sheet Dashboard (`/dashboard`)
- **Workbook Sheet Tabs:** Instant switching between NDA, CDS, SSB Interview, and SSC.
- **Executive Sheet KPI Ribbon:**
  - **Coverage %:** Live verified syllabus completion percentage.
  - **Planned Target %:** Expected completion according to target dates.
  - **Schedule Variance:** Immediate indication of whether the academy is **Ahead** (`+XX%`) or **Behind** (`-XX%`).
  - **Overdue Topics:** Count of topics whose target dates have passed without coverage.
  - **Flagged in Review:** Real-time badge of suspicious entries pending admin action.
- **Subject Completion Ledger:** Dual-colored progress bars with target markers and percentage variance.
- **Planned vs Actual Trajectory:** Interactive Recharts timeline comparing syllabus curves against verified student confirmations.
- **Faculty Pacing Scorecard:** Evaluates each teacher's pace, average lag in days, and classes logged this month.
- **Curriculum Topic Sheet:** Spreadsheet table with live search, subject filters, and status chips:
  - 🟢 `Covered` (confirmations $\ge$ threshold or admin-approved)
  - 🟡 `Unverified` (confirmations $> 0$ but below threshold)
  - 🔵 `In Progress` (partially covered)
  - 🔴 `Overdue` (target date passed without coverage)
  - ⚪ `Not Started`
- **CSV Data Export:** One-click downloads for **Progress CSV** and **Entries CSV**.

---

### 🛡️ 3. Admin Center (`/admin`)
- **Curriculum Builder:** Add/edit subjects and topics, Move Up/Down sequence ordering, CSV bulk import, and clone syllabus between courses.
- **Courses & Governance:** Course lifecycle, confirmation thresholds, daily entry caps, code TTLs, and class-code requirement flags.
- **Faculty Allocations:** Faculty roster and interactive subject allocation matrix.
- **Student Roster:** Student profiles, course enrollments, and CSV bulk student batch importer.
- **Class Codes & Board Mode:**
  - Generate codes for today or custom dates with configurable TTL.
  - **📺 Classroom Board Presentation Mode:** Fullscreen, high-contrast projector display showing large 96px bold code and countdown timer for classroom boards.
- **Review Queue:** Approve or reject flagged student entries.
- **System Audit Trail:** Chronological log of all administrative actions with JSON before/after state diff inspector.

---

## 4. Local Setup & Execution Guide

### Prerequisites
- Node.js v20+ (tested on Node v24)
- Docker (for local PostgreSQL container)

### Step 1: Clone & Configure Environment
```bash
cd syllabus-tracker
cp .env.example .env.local
```

### Step 2: Start PostgreSQL Database Container
```bash
docker run -d --name syllabus-tracker-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=syllabus_tracker \
  -p 5432:5432 postgres:16-alpine
```

### Step 3: Run Database Migrations & Seed Data
```bash
npm run db:setup
```
*This executes `schema.sql`, `views.sql`, `rls.sql`, and `seed.ts`—inserting NDA, CDS, SSB, and SSC curricula, 10 enrolled students, 3 teachers, and active class codes for today.*

### Step 4: Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 5. Automated Test Suites

```bash
# Run unit test suite (16 tests covering Zod schemas, threshold formulas, and IST date bounds)
npm run test:unit

# Run automated API validation suite (tests class code checks, duplicate rejection, and honeypots)
npm run test:api

# Run Playwright end-to-end browser tests
npm run test:e2e
```

---

## 6. Project Structure

```
syllabus-tracker/
├── database/
│   ├── schema.sql              # Core DDL tables & indexes
│   ├── views.sql               # Derived PostgreSQL views (topic_progress, subject_progress, scorecard)
│   ├── rls.sql                 # Row Level Security policies
│   └── seed.sql                # SQL dump of seed data
├── src/
│   ├── app/
│   │   ├── admin/page.tsx      # Admin Panel Center
│   │   ├── dashboard/page.tsx  # Faculty Sheet Dashboard
│   │   ├── submit/page.tsx     # Student Mobile Submission Portal
│   │   ├── api/submit/route.ts # Anti-Misuse Server Submission API
│   │   ├── api/export/route.ts # CSV Data Export API
│   │   └── actions/admin-actions.ts # Admin server actions with audit logging
│   ├── components/
│   │   ├── admin/              # Curriculum, courses, faculty, students, codes & review queue
│   │   ├── dashboard/          # Trajectory chart & interactive topic sheet table
│   │   ├── submit/             # Cascading student submission form
│   │   └── auth-disabled-banner.tsx
│   ├── lib/
│   │   ├── db.ts               # PostgreSQL connection pool
│   │   ├── date-utils.ts       # IST (Asia/Kolkata) date helpers
│   │   ├── auth-guard.ts       # Central requireAccess() hook
│   │   ├── student-guard.ts    # verifyStudent() hook
│   │   ├── submission-validation.ts # Zod schema & anti-misuse detection
│   │   ├── dashboard-data.ts   # Faculty dashboard data queries
│   │   ├── admin-data.ts       # Admin panel data queries
│   │   ├── submit-data.ts      # Cascading form data queries
│   │   └── audit.ts            # Audit logging utility
│   ├── scripts/
│   │   ├── migrate.ts          # Migration executor
│   │   ├── seed.ts             # Comprehensive database seeder
│   │   └── test-api.ts         # Automated API test suite
│   └── tests/
│       ├── unit/               # Validation, threshold, and date unit tests
│       └── e2e/                # Playwright end-to-end workflow specs
```

---

## 7. Derived Views & Threshold Formula

A topic is dynamically confirmed as `covered` when distinct valid student confirmations meet the course threshold:
$$\min(\text{threshold}, \max(1, \text{round}(0.20 \times \text{enrolled})))$$
or upon explicit administrative approval in the Admin Review Queue.
- `unverified`: Confirmations $> 0$ but below the threshold.
- `in_progress`: Received partial status entries.
- `overdue`: Topic target date is earlier than today in IST and remains uncovered.
- `not_started`: No student class entries recorded.
