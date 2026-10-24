import { test, expect } from '@playwright/test';
import { query } from '../../lib/db';
import { getTodayIST } from '../../lib/date-utils';

test.describe('Abhigyan Academy Student Submission Portal', () => {
  test.beforeEach(async () => {
    // Clean any prior submissions from test student ABG-2026-007 for today to ensure test idempotency
    const today = getTodayIST();
    await query(
      `DELETE FROM entries 
       WHERE student_id IN (SELECT id FROM students WHERE roll_no = 'ABG-2026-007') 
         AND class_date = $1`,
      [today]
    );
  });

  test('should render the student submit form with active course tabs', async ({ page }) => {
    await page.goto('/submit');
    await expect(page.locator('text=ABHIGYAN ACADEMY').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'NDA' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CDS' })).toBeVisible();
  });

  test('should reject submission when class code is incorrect', async ({ page }) => {
    await page.goto('/submit');

    // Select Teacher
    const teacherSelect = page.locator('select').nth(0);
    await teacherSelect.selectOption({ index: 1 });

    // Select Subject
    const subjectSelect = page.locator('select').nth(1);
    await subjectSelect.selectOption({ index: 1 });

    // Select Topic
    const topicSelect = page.locator('select').nth(2);
    await topicSelect.selectOption({ index: 1 });

    // Search and select student
    const studentInput = page.locator('input[placeholder*="Type roll number"]');
    await studentInput.fill('ABG-2026-002');
    await page.locator('button:has-text("ABG-2026-002")').click();

    // Fill wrong class code
    const classCodeInput = page.locator('input[placeholder="e.g. NDA-942"]');
    if (await classCodeInput.isVisible()) {
      await classCodeInput.fill('WRONG-999');
    }

    // Submit
    await page.getByRole('button', { name: /Confirm Topic Covered/i }).click();

    // Verify error banner
    await expect(page.locator('text=Invalid or expired class code')).toBeVisible();
  });

  test('should successfully submit valid class entry and then reject duplicate on same date', async ({ page }) => {
    await page.goto('/submit');

    // Select CDS course tab
    await page.getByRole('button', { name: 'CDS' }).click();

    // Select Teacher
    const teacherSelect = page.locator('select').nth(0);
    await teacherSelect.selectOption({ index: 1 });

    // Select Subject
    const subjectSelect = page.locator('select').nth(1);
    await subjectSelect.selectOption({ index: 1 });

    // Select Topic
    const topicSelect = page.locator('select').nth(2);
    await topicSelect.selectOption({ index: 1 });

    // Search and select student ABG-2026-007
    const studentInput = page.locator('input[placeholder*="Type roll number"]');
    await studentInput.fill('ABG-2026-007');
    await page.locator('button:has-text("ABG-2026-007")').click();

    // Fill valid CDS class code
    const classCodeInput = page.locator('input[placeholder*="NDA-942"]');
    if (await classCodeInput.isVisible()) {
      await classCodeInput.fill('CDS-318');
    }

    // Submit
    await page.getByRole('button', { name: /Confirm Topic Covered/i }).click();

    // Verify success ticket
    await expect(page.locator('text=Class Logged Successfully')).toBeVisible();
    await expect(page.locator('text=Reference ID')).toBeVisible();
    await expect(page.getByRole('button', { name: /Log Another Class/i })).toBeVisible();

    // Now test duplicate rejection: Click "Log Another Class"
    await page.getByRole('button', { name: /Log Another Class/i }).click();

    // Try to re-submit the same topic with same student
    await topicSelect.selectOption({ index: 1 });
    if (await classCodeInput.isVisible()) {
      await classCodeInput.fill('CDS-318');
    }
    await page.getByRole('button', { name: /Confirm Topic Covered/i }).click();

    // Verify duplicate rejection error
    await expect(page.locator('text=already logged this topic for today’s class')).toBeVisible();
  });

  test('should verify access banner and layout on /dashboard and /admin', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Authentication is disabled')).toBeVisible();
    await expect(page.locator('text=Schedule Variance')).toBeVisible();
    await expect(page.locator('text=Cumulative Planned vs Actual Trajectory')).toBeVisible();

    await page.goto('/admin');
    await expect(page.locator('text=Authentication is disabled')).toBeVisible();
    await expect(page.locator('text=Curriculum Builder')).toBeVisible();
    await expect(page.locator('text=Class Codes & Board')).toBeVisible();
  });
});
