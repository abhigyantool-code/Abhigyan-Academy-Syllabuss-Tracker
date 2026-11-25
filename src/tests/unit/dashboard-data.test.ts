import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDashboardData, isTestCourse, isTestAccount } from '../../lib/dashboard-data';

describe('Executive Dashboard Data Verification (AUDIT-01)', () => {
  it('identifies test courses and accounts accurately', () => {
    assert.strictEqual(isTestCourse({ name: 'BOT / Testing Sandbox', code: 'TEST_COURSE' }), true);
    assert.strictEqual(isTestCourse({ name: 'National Defence Academy', code: 'NDA' }), false);
    assert.strictEqual(isTestCourse({ name: 'Combined Defence Services', code: 'CDS' }), false);

    assert.strictEqual(isTestAccount('ZZ_TEST_TEACHER', 'BOT-TEA-001'), true);
    assert.strictEqual(isTestAccount('ZZ_TEST_STUDENT', 'BOT-STU-001'), true);
    assert.strictEqual(isTestAccount("Epsha Ma'am", '9876543210'), false);
    assert.strictEqual(isTestAccount('Ashish Sir', '9876543211'), false);
  });

  it('calculates genuine production metrics accurately from live database', async () => {
    // 1. Fetch default dashboard (NDA)
    const ndaData = await getDashboardData();
    assert.ok(ndaData, 'Dashboard data must load successfully');
    assert.strictEqual(ndaData.selectedCourse.code, 'NDA');

    // 2. NDA metrics: exactly 5 covered topics
    assert.strictEqual(ndaData.overviewMetrics.coveredTopics, 5, 'NDA must show exactly 5 covered topics');
    assert.strictEqual(ndaData.overviewMetrics.totalTopics, 280, 'NDA total topics should be 280');
    assert.strictEqual(ndaData.teachingSessions.length, 5, 'NDA teaching sessions should display 5 records');

    // 3. Academy-wide metrics: exactly 8 covered topics across 1960 total topics (0.4%)
    assert.strictEqual(ndaData.academyCoverage.totalTopics, 1960, 'Academy total topics should be 1960 across 7 courses');
    assert.strictEqual(ndaData.academyCoverage.coveredTopics, 8, 'Academy total covered topics must be 8 (5 NDA + 3 CDS)');
    assert.strictEqual(ndaData.academyCoverage.pendingTopics, 1952, 'Academy pending topics must be 1952');
    assert.strictEqual(ndaData.academyCoverage.overallCoveragePct, 0.4, 'Academy coverage percentage should be 0.4%');

    // 4. Cross-Class comparison: exactly 7 genuine courses, TEST_COURSE excluded
    assert.strictEqual(ndaData.crossClassComparison.length, 7, 'Must contain exactly 7 genuine courses');
    const courseCodes = ndaData.crossClassComparison.map((c) => c.courseCode);
    assert.ok(courseCodes.includes('NDA'), 'Includes NDA');
    assert.ok(courseCodes.includes('CDS'), 'Includes CDS');
    assert.ok(!courseCodes.includes('TEST_COURSE'), 'Excludes TEST_COURSE');

    const ndaComparison = ndaData.crossClassComparison.find((c) => c.courseCode === 'NDA');
    assert.strictEqual(ndaComparison?.coveredTopics, 5);

    const cdsComparison = ndaData.crossClassComparison.find((c) => c.courseCode === 'CDS');
    assert.strictEqual(cdsComparison?.coveredTopics, 3);

    // 5. CDS Course Dashboard: exactly 3 covered topics
    const cdsCourse = ndaData.courses.find((c) => c.code === 'CDS');
    assert.ok(cdsCourse, 'CDS course must exist in courses list');

    const cdsData = await getDashboardData(cdsCourse!.id);
    assert.ok(cdsData, 'CDS dashboard data must load successfully');
    assert.strictEqual(cdsData.selectedCourse.code, 'CDS');
    assert.strictEqual(cdsData.overviewMetrics.coveredTopics, 3, 'CDS must show exactly 3 covered topics');
    assert.strictEqual(cdsData.teachingSessions.length, 3, 'CDS teaching sessions should display 3 records');

    // 6. Teaching sessions metadata integrity (AUDIT-01 sort fix verification)
    const firstSession = ndaData.teachingSessions[0];
    assert.ok(firstSession.id, 'Session has ID');
    assert.ok(firstSession.session_date, 'Session has session_date');
    assert.ok(firstSession.teacher_name, 'Session has teacher_name');
    assert.ok(firstSession.subject_name, 'Session has subject_name');
    assert.ok(firstSession.topic_name, 'Session has topic_name');
    assert.strictEqual(firstSession.status, 'completed');
  });

  it('handles non-existent or invalid course ID gracefully by defaulting to first active course', async () => {
    const fallbackData = await getDashboardData('non-existent-course-id-999');
    assert.ok(fallbackData, 'Fallback data must be returned');
    assert.strictEqual(fallbackData.selectedCourse.code, 'NDA', 'Defaults to first active course');
  });
});
