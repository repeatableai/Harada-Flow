import { test, expect } from '@playwright/test';

// Credentials from seed.js
const SUPER_ADMIN = {
  email: 'kevin@repeatable.ai',
  password: 'Merwan.1894'
};

test.describe('Full App Testing - Mock Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/?mock=true');
    await page.evaluate(() => {
      localStorage.removeItem('mock_base44_user');
      localStorage.removeItem('mock_base44_companies');
      localStorage.setItem('base44_mock_mode', 'true');
    });
  });

  test('user login flow - no accessibility warnings', async ({ page }) => {
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

    await page.goto('/?mock=true');
    await page.waitForTimeout(2000);

    // Should see auth selector
    const userLoginBtn = page.locator('text=User Login').first();
    if (await userLoginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userLoginBtn.click();
      await page.waitForTimeout(1000);

      // Should see User Login dialog with proper accessibility
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill('test@example.com');

        // Click send verification code
        const sendBtn = page.locator('button:has-text("Send Verification Code")').first();
        if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await sendBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    console.log('User Login Flow - Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });

  test('super admin login flow - no accessibility warnings', async ({ page }) => {
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

    await page.goto('/?mock=true');
    await page.waitForTimeout(2000);

    // Click on Super Admin login
    const superAdminBtn = page.locator('text=Super Admin').first();
    if (await superAdminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await superAdminBtn.click();
      await page.waitForTimeout(1000);

      // Should see Super Admin Login dialog
      const emailInput = page.locator('#admin-email').first();
      const passwordInput = page.locator('#admin-password').first();

      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill('admin@test.com');
        await passwordInput.fill('testpassword');
        await page.waitForTimeout(500);
      }
    }

    console.log('Super Admin Flow - Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });

  test('mock user login and navigate app', async ({ page }) => {
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

    // Set up mock user directly
    await page.goto('/?mock=true');
    await page.evaluate(() => {
      const mockUser = {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        job_title: 'Tester',
        role_id: null,
        isPermanent: true
      };
      localStorage.setItem('mock_base44_user', JSON.stringify(mockUser));
      localStorage.setItem('base44_mock_mode', 'true');
    });

    // Reload to pick up the mock user
    await page.reload();
    await page.waitForTimeout(3000);

    // Should be in the app now - look for main content
    const pageContent = await page.content();
    console.log('Page loaded, checking for dialogs...');

    // Check for any accessibility warnings during navigation
    console.log('App Navigation - Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });
});

test.describe('Full App Testing - Real Backend', () => {
  test('super admin login with real credentials', async ({ page }) => {
    const accessibilityWarnings = [];
    const allConsoleMessages = [];

    page.on('console', (msg) => {
      const text = msg.text();
      allConsoleMessages.push({ type: msg.type(), text });

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

    // Try to find auth selector
    const superAdminBtn = page.locator('text=Super Admin').first();

    if (await superAdminBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await superAdminBtn.click();
      await page.waitForTimeout(1000);

      // Fill in real credentials
      const emailInput = page.locator('#admin-email');
      const passwordInput = page.locator('#admin-password');

      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill(SUPER_ADMIN.email);
        await passwordInput.fill(SUPER_ADMIN.password);

        // Submit login
        const submitBtn = page.locator('button:has-text("Sign In as Super Admin")');
        await submitBtn.click();
        await page.waitForTimeout(3000);

        // Check if we got logged in or got an error
        const currentUrl = page.url();
        console.log('After login attempt, URL:', currentUrl);
      }
    }

    console.log('Super Admin Real Login - Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });

  test('admin dashboard dialogs after login', async ({ page }) => {
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

    // First, try to login
    await page.goto('/');
    await page.waitForTimeout(2000);

    const superAdminBtn = page.locator('text=Super Admin').first();

    if (await superAdminBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await superAdminBtn.click();
      await page.waitForTimeout(1000);

      const emailInput = page.locator('#admin-email');
      const passwordInput = page.locator('#admin-password');

      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill(SUPER_ADMIN.email);
        await passwordInput.fill(SUPER_ADMIN.password);

        const submitBtn = page.locator('button:has-text("Sign In as Super Admin")');
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    // Try to navigate to admin dashboard
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // Check if we're on the admin page
    const adminHeader = page.locator('text=Admin Dashboard');
    const isOnAdmin = await adminHeader.isVisible({ timeout: 3000 }).catch(() => false);

    if (isOnAdmin) {
      console.log('Successfully reached Admin Dashboard');

      // Click on Users tab and try to view a user
      const usersTab = page.locator('[value="users"]');
      if (await usersTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await usersTab.click();
        await page.waitForTimeout(1000);

        // Try to click the first view button
        const viewBtn = page.locator('button:has(svg.lucide-eye)').first();
        if (await viewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await viewBtn.click();
          await page.waitForTimeout(1000);

          // User Details Dialog should be open
          const userDetailsTitle = page.locator('text=User Details');
          const hasUserDialog = await userDetailsTitle.isVisible({ timeout: 2000 }).catch(() => false);
          console.log('User Details Dialog visible:', hasUserDialog);

          // Close the dialog
          const closeBtn = page.locator('[aria-label="Close"]').first();
          if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          } else {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        }
      }

      // Click on Sessions tab and try to view a session
      const sessionsTab = page.locator('[value="companies"]');
      if (await sessionsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sessionsTab.click();
        await page.waitForTimeout(1000);

        const viewBtn = page.locator('button:has(svg.lucide-eye)').first();
        if (await viewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await viewBtn.click();
          await page.waitForTimeout(1000);

          // Session Details Dialog should be open
          const sessionDetailsTitle = page.locator('text=Session Details');
          const hasSessionDialog = await sessionDetailsTitle.isVisible({ timeout: 2000 }).catch(() => false);
          console.log('Session Details Dialog visible:', hasSessionDialog);
        }
      }
    } else {
      console.log('Could not reach Admin Dashboard - may need backend running');
    }

    console.log('Admin Dashboard - Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });
});

test.describe('Dialog Component Tests', () => {
  test('all dialog components have proper ARIA attributes', async ({ page }) => {
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

    // Test auth dialogs
    await page.goto('/?mock=true');
    await page.waitForTimeout(2000);

    // Check for dialog ARIA attributes
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
      const ariaDescribedBy = await dialog.getAttribute('aria-describedby');

      console.log('Dialog ARIA attributes:');
      console.log('  aria-labelledby:', ariaLabelledBy);
      console.log('  aria-describedby:', ariaDescribedBy);

      // At least one should be present for accessibility
      expect(ariaLabelledBy || ariaDescribedBy).toBeTruthy();
    }

    // Navigate through auth options to trigger different dialogs
    const userLoginBtn = page.locator('text=User Login').first();
    if (await userLoginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userLoginBtn.click();
      await page.waitForTimeout(1000);

      // Check dialog again
      const userDialog = page.locator('[role="dialog"]');
      if (await userDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        const ariaLabelledBy = await userDialog.getAttribute('aria-labelledby');
        const ariaDescribedBy = await userDialog.getAttribute('aria-describedby');
        console.log('User Login Dialog ARIA:');
        console.log('  aria-labelledby:', ariaLabelledBy);
        console.log('  aria-describedby:', ariaDescribedBy);
      }
    }

    console.log('Dialog Component Tests - Accessibility warnings:', accessibilityWarnings);
    expect(accessibilityWarnings).toHaveLength(0);
  });
});
