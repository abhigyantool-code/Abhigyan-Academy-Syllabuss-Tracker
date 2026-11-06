import { test, expect } from '@playwright/test';

test.describe('Teacher Portal & Isolated Sessions', () => {
  test('should redirect unauthenticated users from /teacher to /login', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('text=Faculty Portal')).toBeVisible();
  });

  test('should reject incorrect PIN with user-friendly error', async ({ page }) => {
    await page.goto('/login');
    // Select Dipyaman Sir if not already selected
    await page.selectOption('select', { label: /Dipyaman Sir/ });
    await page.fill('input[type="password"]', '9999');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Incorrect PIN')).toBeVisible();
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should log in successfully with PIN 1234 and isolate to teacher subjects', async ({ page }) => {
    await page.goto('/login');
    await page.selectOption('select', { label: /Dipyaman Sir/ });
    await page.fill('input[type="password"]', '1234');
    await page.click('button[type="submit"]');

    // Should redirect to /teacher
    await expect(page).toHaveURL(/.*\/teacher/);
    await expect(page.locator('text=Welcome, Dipyaman Sir')).toBeVisible();
    await expect(page.locator('text=Mathematics')).toBeVisible();

    // Verify Dipyaman Sir cannot see other teachers' subjects (e.g. Chemistry, Biology)
    await expect(page.locator('button:has-text("Chemistry")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Biology")')).toHaveCount(0);
  });

  test('should log in as Pallabi Bhuyan Ma\'am and show only Biology', async ({ page }) => {
    await page.goto('/login');
    await page.selectOption('select', { label: /Pallabi Bhuyan Ma'am/ });
    await page.fill('input[type="password"]', '1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/teacher/);
    await expect(page.locator('text=Welcome, Pallabi Bhuyan Ma\'am')).toBeVisible();
    await expect(page.locator('text=Biology')).toBeVisible();

    // Verify Maths is not shown in her subjects
    await expect(page.locator('button:has-text("Mathematics")')).toHaveCount(0);
  });
});
