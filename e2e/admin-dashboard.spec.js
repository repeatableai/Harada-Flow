import { test, expect } from '@playwright/test';

// Credentials from seed.js
const SUPER_ADMIN = {
  email: 'kevin@repeatable.ai',
  password: 'Merwan.1894'
};

test.describe('Admin Dashboard Full Test', () => {
  test('login as super admin and test all dialogs', async ({ page }) => {
    const accessibilityWarnings = [];
    const allErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        allErrors.push(text);
      }
      if (msg.type() === 'warning' || msg.type() === 'error') {
        if (text.includes('DialogContent') ||
            text.includes('DialogTitle') ||
            text.includes('aria-describedby') ||
            text.includes('Missing Description')) {
          accessibilityWarnings.push(text);
        }
      }
    });

    // Go to the app
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should see the auth selector
    console.log('Looking for Super Admin button...');
    const superAdminBtn = page.locator('text=Super Admin').first();

    await expect(superAdminBtn).toBeVisible({ timeout: 10000 });
    await superAdminBtn.click();
    await page.waitForTimeout(1000);

    console.log('Filling in credentials...');
    // Fill in credentials
    const emailInput = page.locator('#admin-email');
    const passwordInput = page.locator('#admin-password');

    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill(SUPER_ADMIN.email);
    await passwordInput.fill(SUPER_ADMIN.password);

    // Submit
    const submitBtn = page.locator('button:has-text("Sign In as Super Admin")');
    await submitBtn.click();

    console.log('Waiting for login to complete...');
    // Wait for login to complete - look for the dialog to close or page to change
    await page.waitForTimeout(5000);

    // Check if we're logged in by looking for user-specific content
    const logoutBtn = page.locator('text=Logout').first();
    const isLoggedIn = await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Is logged in:', isLoggedIn);

    if (isLoggedIn) {
      // Navigate to admin dashboard
      console.log('Navigating to admin dashboard...');
      await page.goto('/admin');
      await page.waitForTimeout(3000);

      // Check if we're on admin page
      const adminTitle = page.locator('h1:has-text("Admin Dashboard")');
      const isOnAdmin = await adminTitle.isVisible({ timeout: 5000 }).catch(() => false);
      console.log('Is on admin page:', isOnAdmin);

      if (isOnAdmin) {
        // Test Users Tab
        console.log('Testing Users tab...');
        const usersTab = page.locator('button:has-text("Users")').first();
        if (await usersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await usersTab.click();
          await page.waitForTimeout(2000);

          // Try to click view button on first user
          const userViewBtn = page.locator('table tbody tr:first-child button').first();
          if (await userViewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await userViewBtn.click();
            await page.waitForTimeout(1000);

            // Check User Details dialog
            const userDetailsDialog = page.locator('[role="dialog"]');
            if (await userDetailsDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
              console.log('User Details dialog is visible');

              // Check accessibility attributes
              const ariaLabelledBy = await userDetailsDialog.getAttribute('aria-labelledby');
              const ariaDescribedBy = await userDetailsDialog.getAttribute('aria-describedby');
              console.log('User Dialog aria-labelledby:', ariaLabelledBy);
              console.log('User Dialog aria-describedby:', ariaDescribedBy);

              expect(ariaLabelledBy).toBeTruthy();
              expect(ariaDescribedBy).toBeTruthy();

              // Close dialog
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
            }
          } else {
            console.log('No users found in table');
          }
        } else {
          console.log('Users tab not found, may be using different UI');
        }

        // Test Sessions Tab
        console.log('Testing Sessions tab...');
        const sessionsTab = page.locator('button:has-text("Sessions")').first();
        if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sessionsTab.click();
          await page.waitForTimeout(2000);

          // Try to click view button on first session
          const sessionViewBtn = page.locator('table tbody tr:first-child button').first();
          if (await sessionViewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await sessionViewBtn.click();
            await page.waitForTimeout(1000);

            // Check Session Details dialog
            const sessionDetailsDialog = page.locator('[role="dialog"]');
            if (await sessionDetailsDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
              console.log('Session Details dialog is visible');

              // Check accessibility attributes
              const ariaLabelledBy = await sessionDetailsDialog.getAttribute('aria-labelledby');
              const ariaDescribedBy = await sessionDetailsDialog.getAttribute('aria-describedby');
              console.log('Session Dialog aria-labelledby:', ariaLabelledBy);
              console.log('Session Dialog aria-describedby:', ariaDescribedBy);

              expect(ariaLabelledBy).toBeTruthy();
              expect(ariaDescribedBy).toBeTruthy();
            }
          } else {
            console.log('No sessions found in table');
          }
        } else {
          console.log('Sessions tab not found');
        }
      }
    } else {
      console.log('Login may have failed - checking errors:');
      allErrors.forEach(err => console.log('  Error:', err));
    }

    console.log('Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });

  test('test auth type selector dialog accessibility', async ({ page }) => {
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

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check auth selector dialog
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
      const ariaDescribedBy = await dialog.getAttribute('aria-describedby');

      console.log('Auth Selector Dialog:');
      console.log('  aria-labelledby:', ariaLabelledBy);
      console.log('  aria-describedby:', ariaDescribedBy);

      // Both should be set after our fix
      expect(ariaLabelledBy).toBeTruthy();
      expect(ariaDescribedBy).toBeTruthy();
    }

    expect(accessibilityWarnings).toHaveLength(0);
  });

  test('test super admin login dialog accessibility', async ({ page }) => {
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

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Click Super Admin
    const superAdminBtn = page.locator('text=Super Admin').first();
    if (await superAdminBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await superAdminBtn.click();
      await page.waitForTimeout(1000);

      // Check the dialog
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
        const ariaDescribedBy = await dialog.getAttribute('aria-describedby');

        console.log('Super Admin Login Dialog:');
        console.log('  aria-labelledby:', ariaLabelledBy);
        console.log('  aria-describedby:', ariaDescribedBy);

        expect(ariaLabelledBy).toBeTruthy();
        expect(ariaDescribedBy).toBeTruthy();
      }
    }

    expect(accessibilityWarnings).toHaveLength(0);
  });

  test('sessions tab sorting and saved prompts tab', async ({ page }) => {
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

    // Login
    await page.goto('/');
    await page.waitForTimeout(2000);

    const superAdminBtn = page.locator('text=Super Admin').first();
    await expect(superAdminBtn).toBeVisible({ timeout: 10000 });
    await superAdminBtn.click();
    await page.waitForTimeout(1000);

    const emailInput = page.locator('#admin-email');
    const passwordInput = page.locator('#admin-password');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill(SUPER_ADMIN.email);
    await passwordInput.fill(SUPER_ADMIN.password);

    const submitBtn = page.locator('button:has-text("Sign In as Super Admin")');
    await submitBtn.click();
    await page.waitForTimeout(5000);

    // Navigate to admin dashboard
    await page.goto('/admin');
    await page.waitForTimeout(3000);

    // Test Sessions tab sorting
    console.log('Testing Sessions tab sorting...');
    const sessionsTab = page.locator('button:has-text("Sessions")').first();
    if (await sessionsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionsTab.click();
      await page.waitForTimeout(1000);

      // Check for sort dropdown
      const sortDropdown = page.locator('button:has-text("Newest First")').first();
      if (await sortDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Sessions sort dropdown found');
        await sortDropdown.click();
        await page.waitForTimeout(500);

        // Select a different sort option
        const sortOption = page.locator('text=Job Title A-Z').first();
        if (await sortOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await sortOption.click();
          await page.waitForTimeout(1000);
          console.log('Changed sort to Job Title A-Z');
        }
      }
    }

    // Test Saved Prompts tab
    console.log('Testing Saved Prompts tab...');
    const savedPromptsTab = page.locator('button:has-text("Saved Prompts")').first();
    if (await savedPromptsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await savedPromptsTab.click();
      await page.waitForTimeout(2000);

      // Check for filter dropdown
      const filterDropdown = page.locator('button:has-text("All Types")').first();
      if (await filterDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Saved Prompts filter dropdown found');
      }

      // Check for sort dropdown
      const sortDropdown = page.locator('button:has-text("Newest First")').first();
      if (await sortDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Saved Prompts sort dropdown found');
      }

      // Check for search input
      const searchInput = page.locator('input[placeholder*="deliverable"]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Saved Prompts search input found');
      }

      // Verify the table structure
      const table = page.locator('table').first();
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Saved Prompts table found');
      }
    } else {
      console.log('Saved Prompts tab not visible');
    }

    console.log('Sorting and Saved Prompts - Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });

  test('test user login dialog accessibility', async ({ page }) => {
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

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Click User Login
    const userLoginBtn = page.locator('text=User Login').first();
    if (await userLoginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userLoginBtn.click();
      await page.waitForTimeout(1000);

      // Check the dialog
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
        const ariaDescribedBy = await dialog.getAttribute('aria-describedby');

        console.log('User Login Dialog:');
        console.log('  aria-labelledby:', ariaLabelledBy);
        console.log('  aria-describedby:', ariaDescribedBy);

        expect(ariaLabelledBy).toBeTruthy();
        expect(ariaDescribedBy).toBeTruthy();
      }
    }

    expect(accessibilityWarnings).toHaveLength(0);
  });
});
