import React from 'react';
import { requireAccess } from '@/lib/auth-guard';
import { getDashboardData } from '@/lib/dashboard-data';
import { NeumorphicShell } from '@/components/dashboard/neumorphic-shell';
import { BrandHeader } from '@/components/dashboard/brand-header';
import { StudyAssistantBar } from '@/components/dashboard/study-assistant-bar';
import { StudyPlanPills } from '@/components/dashboard/study-plan-pills';
import { RecommendedActivities } from '@/components/dashboard/recommended-activities';
import { TodayProgressHero } from '@/components/dashboard/today-progress-hero';
import { FlipClock } from '@/components/dashboard/flip-clock';
import { CourseContextBar } from '@/components/dashboard/course-context-bar';
import { MetricsGrid } from '@/components/dashboard/metrics-grid';
import { CurriculumDrawer } from '@/components/dashboard/curriculum-drawer';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ course?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // Enforce session access: requires Faculty or Administrator
  const access = await requireAccess('dashboard');

  const resolvedParams = await searchParams;
  const courseId = resolvedParams.course;

  const data = await getDashboardData(courseId);

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg-page-from)] text-[var(--text-primary)] flex items-center justify-center font-sans">
        <p className="text-sm text-[var(--text-muted)]">
          No active course records found in academy curriculum.
        </p>
      </div>
    );
  }

  const {
    courses,
    selectedCourse,
    overviewMetrics,
    pacingMetrics,
    topicProgress,
    today,
  } = data;

  // Calculate target days remaining
  const maxTargetDate = topicProgress
    .map((t) => t.target_date)
    .filter(Boolean)
    .sort()
    .pop();

  const daysLeft = maxTargetDate
    ? Math.max(0, Math.ceil((new Date(maxTargetDate).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24)))
    : 45;

  return (
    <NeumorphicShell>
      {/* Brand Header & Quick Actions */}
      <BrandHeader
        courseName={selectedCourse.name}
        batchCode={selectedCourse.code}
        userRole={access.user?.role}
        userName={access.user?.label}
      />

      {/* Main 2-Column Asymmetric Grid: 1.46fr : 1fr on desktop, 1-col on tablet/mobile */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.46fr_1fr] gap-8 lg:gap-10 items-start w-full min-w-0">
        {/* Left Column (~59.3% width) */}
        <div className="space-y-8 min-w-0 w-full">
          {/* 1. AI Study Assistant Ask Bar (26px radius) */}
          <StudyAssistantBar topics={topicProgress} />

          {/* 2. "Your study plan today" (Header + 5 Pill Columns) */}
          <StudyPlanPills topics={topicProgress} today={today} />

          {/* 3. "Recommended activities" (3 Photo Cards) */}
          <RecommendedActivities
            overdueCount={overviewMetrics.overdueCount}
            totalTopics={overviewMetrics.totalTopics}
            coveredTopics={overviewMetrics.coveredTopics}
          />
        </div>

        {/* Right Column (~40.7% width) */}
        <div className="space-y-6 min-w-0 w-full">
          {/* 1. "Today's Progress" Hero Metric with "On track" indicator */}
          <TodayProgressHero
            coveragePct={overviewMetrics.coveragePct}
            variancePct={overviewMetrics.variancePct}
            totalTopics={overviewMetrics.totalTopics}
            coveredTopics={overviewMetrics.coveredTopics}
          />

          {/* 2. Animated Flip Clock / Countdown Display (HH:MM) */}
          <FlipClock />

          {/* 3. Current Context & Course Switcher */}
          <CourseContextBar
            courses={courses}
            selectedCourse={selectedCourse}
            today={today}
          />

          {/* 4. 2x2 Key Metrics Grid */}
          <MetricsGrid
            coveredTopics={overviewMetrics.coveredTopics}
            totalTopics={overviewMetrics.totalTopics}
            pendingTopics={pacingMetrics.pendingTopicsCount}
            variancePct={overviewMetrics.variancePct}
            daysLeft={daysLeft}
          />
        </div>
      </div>

      {/* Bottom Collapsible Power-User Curriculum Drawer (Non-Regression R3) */}
      <CurriculumDrawer data={data} />
    </NeumorphicShell>
  );
}
