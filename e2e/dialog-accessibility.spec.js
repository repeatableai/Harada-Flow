import { test, expect } from '@playwright/test';

test.describe('Dialog Accessibility', () => {
  test('should not show DialogContent accessibility warnings in console', async ({ page }) => {
    const consoleMessages = [];
    const consoleErrors = [];

    // Collect all console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });

      // Track warnings and errors specifically
      if (msg.type() === 'warning' || msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Navigate to the app (will show auth dialog)
    await page.goto('/');

    // Wait for the page to load and potential dialogs to render
    await page.waitForTimeout(3000);

    // Check for specific dialog accessibility warnings
    const dialogTitleWarning = consoleErrors.find(msg =>
      msg.includes('DialogContent') && msg.includes('DialogTitle')
    );
    const dialogDescriptionWarning = consoleErrors.find(msg =>
      msg.includes('Missing Description') || msg.includes('aria-describedby')
    );

    // Log all warnings for debugging
    console.log('Console warnings/errors found:');
    consoleErrors.forEach(err => console.log('  -', err));

    // Assert no dialog accessibility warnings
    expect(dialogTitleWarning).toBeUndefined();
    expect(dialogDescriptionWarning).toBeUndefined();
  });

  test('auth dialog should be accessible', async ({ page }) => {
    // Navigate to app in mock mode to trigger auth dialog
    await page.goto('/?mock=true');

    // Wait for dialog to appear
    await page.waitForTimeout(2000);

    // Check that the dialog is present
    const dialog = page.locator('[role="dialog"]');

    // If dialog is visible, check for accessibility attributes
    if (await dialog.isVisible()) {
      // Check for aria-labelledby (set by DialogTitle)
      const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
      const ariaDescribedBy = await dialog.getAttribute('aria-describedby');

      console.log('Dialog aria-labelledby:', ariaLabelledBy);
      console.log('Dialog aria-describedby:', ariaDescribedBy);

      // Either aria-labelledby should be set, or there should be an aria-label
      const ariaLabel = await dialog.getAttribute('aria-label');
      expect(ariaLabelledBy || ariaLabel).toBeTruthy();
    }
  });

  test('app loads without React errors', async ({ page }) => {
    const reactErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      // Look for React-specific errors
      if (text.includes('React') && (msg.type() === 'error' || msg.type() === 'warning')) {
        // Ignore expected 401 errors
        if (!text.includes('401') && !text.includes('Unauthorized')) {
          reactErrors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Filter out known acceptable warnings
    const significantErrors = reactErrors.filter(err =>
      !err.includes('message channel closed') && // Browser extension noise
      !err.includes('DevTools') // DevTools related
    );

    console.log('React errors/warnings:');
    significantErrors.forEach(err => console.log('  -', err));

    // Check for critical React errors (like missing keys, invalid hooks, etc.)
    const criticalErrors = significantErrors.filter(err =>
      err.includes('Invalid hook call') ||
      err.includes('Each child in a list should have a unique') ||
      err.includes('Cannot update a component') ||
      err.includes('DialogContent requires a DialogTitle') ||
      err.includes('Missing Description')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('mock mode auth flow works without console errors', async ({ page }) => {
    const accessibilityWarnings = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'warning' || msg.type() === 'error') {
        if (text.includes('DialogContent') ||
            text.includes('DialogTitle') ||
            text.includes('aria-describedby') ||
            text.includes('Missing Description')) {
          accessibilityWarnings.push(text);
        }
      }
    });

    // Go to mock mode
    await page.goto('/?mock=true');
    await page.waitForTimeout(2000);

    // Try to interact with auth selector if visible
    const authSelector = page.locator('text=Select Login Type').first();
    if (await authSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click on User Login option if available
      const userLoginBtn = page.locator('text=User Login').first();
      if (await userLoginBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await userLoginBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Report any accessibility warnings found
    console.log('Accessibility warnings during auth flow:');
    accessibilityWarnings.forEach(w => console.log('  -', w));

    expect(accessibilityWarnings).toHaveLength(0);
  });
});

test.describe('Admin Dashboard Dialogs', () => {
  test.skip('admin dashboard dialogs have proper accessibility', async ({ page }) => {
    // This test requires authentication - skip for now
    // Would need to set up proper auth mocking

    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Check that page loaded (may redirect if not authenticated)
    const url = page.url();
    console.log('Current URL:', url);
  });
});
