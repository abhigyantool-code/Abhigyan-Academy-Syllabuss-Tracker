import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

try {
  process.loadEnvFile('.env.local');
} catch {}

// Helper to create an authenticated session token for tests
function createAuthCookie() {
  const secret = process.env.SESSION_SECRET || 'dev-only-insecure-secret-key-32-chars-min';
  const payload = {
    userId: 'e2e-auditor',
    role: 'admin',
    name: 'Auditor Admin',
    createdAt: Date.now(),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
  const token = `${data}.${signature}`;

  return {
    name: 'abg_admin_session',
    value: token,
    url: 'http://localhost:3005',
    httpOnly: true,
  };
}

test.describe.serial('Syllabus 360 Dashboard Redesign — Milestone 1', () => {
  test('R1, R2 & Preview: Complete desktop layout, preview screenshot, responsive scaling, and theme engine', async ({
    page,
    context,
  }) => {
    // Inject authenticated session cookie
    await context.addCookies([createAuthCookie()]);

    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    // 1. Initial 1440px Desktop Viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Confirm authenticated access to /dashboard without redirection
    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Visual Component Assertions:
    // A. Brand Header
    await expect(page.locator('h1')).toContainText('Syllabus 360');
    await expect(page.locator('header')).toBeVisible();

    // B. AI Study Assistant Ask Bar (26px radius)
    const askBar = page.locator('input[placeholder*="Ask anything about your syllabus"]');
    await expect(askBar).toBeVisible();

    // C. Study Plan Today (5 Pills, 24px radius)
    await expect(page.locator('text=Your study plan today')).toBeVisible();
    const pills = page.locator('section[aria-labelledby="study-plan-title"] [role="article"]');
    await expect(pills).toHaveCount(5);

    // D. Recommended Activities (3 Photo Cards)
    await expect(page.locator('text=Recommended activities')).toBeVisible();
    const activityCards = page.locator('section[aria-labelledby="recommended-activities-title"] [role="article"]');
    await expect(activityCards).toHaveCount(3);
    await expect(page.locator('text=Best before')).toHaveCount(3);

    // E. Today's Progress Hero Metric
    await expect(page.locator('text=Today\'s Progress')).toBeVisible();
    await expect(page.locator('text=On track').or(page.locator('text=Attention'))).toBeVisible();

    // F. Animated Flip Clock
    await expect(page.locator('section[aria-label="Current IST Academy Clock"]')).toBeVisible();

    // G. 2x2 Key Metrics Grid
    await expect(page.locator('text=Topics Done')).toBeVisible();
    await expect(page.locator('text=Topics Left')).toBeVisible();
    await expect(page.locator('text=Days Left')).toBeVisible();
    await expect(page.locator('text=Schedule Pace')).toBeVisible();

    // 3. User-Requested Desktop Preview Screenshot (1440px)
    const resultsDir = path.resolve(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const screenshotPath = path.join(resultsDir, 'dashboard-desktop-1440.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);

    // 4. Zero horizontal overflow at 1440px
    const overflow1440 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow1440, '1440px desktop has horizontal overflow').toBe(false);

    // 5. Multi-viewport Responsive Scaling (1024px, 768px, 390px)
    const responsiveViewports = [
      { name: '1024px Small Desktop', width: 1024, height: 768 },
      { name: '768px Tablet', width: 768, height: 1024 },
      { name: '390px Mobile', width: 390, height: 844 },
    ];

    for (const vp of responsiveViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(150);

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(
        hasOverflow,
        `Viewport ${vp.name} (${vp.width}x${vp.height}) has horizontal overflow!`
      ).toBe(false);

      // Verify essential components remain accessible
      await expect(page.locator('h1')).toContainText('Syllabus 360');
      await expect(page.locator('text=Today\'s Progress')).toBeVisible();
      await expect(page.locator('section[aria-label="Current IST Academy Clock"]')).toBeVisible();
    }

    // Capture mobile screenshot
    const mobileScreenshotPath = path.join(resultsDir, 'dashboard-mobile-390.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    expect(fs.existsSync(mobileScreenshotPath)).toBe(true);

    // Reset viewport back to desktop for theme & drawer tests
    await page.setViewportSize({ width: 1440, height: 900 });

    // 6. Dual Theme System: Light & Dark Mode Tokens
    const toggleBtn = page.locator('button[aria-label*="Switch to"]');
    await expect(toggleBtn).toBeVisible();

    // Toggle theme to dark
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    });

    const darkShellBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--surface-shell').trim();
    });
    expect(darkShellBg.toLowerCase()).toBe('#1a1d21');

    const darkCardBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--surface-card').trim();
    });
    expect(darkCardBg.toLowerCase()).toBe('#22262b');

    const darkTextPrimary = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    });
    expect(darkTextPrimary.toLowerCase()).toBe('#eceff3');

    // Click toggle button to switch back to Light Mode
    await toggleBtn.click();
    const lightTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(lightTheme).toBe('light');

    const lightShellBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--surface-shell').trim();
    });
    expect(['#ffffff', '#fff', 'rgb(255, 255, 255)']).toContain(lightShellBg.toLowerCase());

    // 7. R3 Non-Regression: Collapsible Curriculum Details Drawer & CSV Export
    const progressExport = page.locator('a[href*="/api/export?type=progress"]');
    const entriesExport = page.locator('a[href*="/api/export?type=entries"]');
    await expect(progressExport).toBeVisible();
    await expect(entriesExport).toBeVisible();

    const drawerToggle = page.locator('button:has-text("Expand Details")');
    await expect(drawerToggle).toBeVisible();
    await drawerToggle.click();

    // Verify topic sheet table is visible inside drawer
    await expect(page.locator('text=Curriculum Topic Sheet')).toBeVisible();
    await expect(page.locator('input[placeholder*="Filter topics"]')).toBeVisible();

    // Switch to Faculty Scorecard tab
    const facultyTab = page.locator('button:has-text("Faculty Scorecard")');
    await facultyTab.click();
    await expect(page.locator('th:has-text("Faculty Member")')).toBeVisible();

    // Switch to Cross-Class Batches tab
    const batchesTab = page.locator('button:has-text("Cross-Class Batches")');
    await batchesTab.click();
    await expect(page.locator('text=Cross-Class Batch Matrix')).toBeVisible();

    // 8. Zero unhandled console errors or React hydration warnings
    const hydrationErrors = consoleErrors.filter((e) =>
      /hydration|did not match|react-dom.*warning/i.test(e)
    );
    expect(hydrationErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
