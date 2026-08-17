import { test as setup, expect } from '@playwright/test';

const NUTRITIONIST_EMAIL = 'nelson@carajillolabs.com';
const NUTRITIONIST_PASSWORD = process.env.NUTRITIONIST_PASSWORD || 'nelson1234';

setup('authenticate as nutritionist', async ({ page, context }) => {
  // Navigate to login page
  await page.goto('/');
  
  // Wait for Keycloak login page to load
  await page.waitForLoadState('networkidle');
  
  // Check if already logged in (should redirect to /dashboard if authenticated)
  if (page.url().includes('/dashboard') || page.url().includes('/shell')) {
    console.log('✓ Already authenticated as nutritionist');
    await context.storageState({ path: 'tests/auth/nutritionist.json' });
    return;
  }
  
  // Click login button or navigate to Keycloak
  const loginButton = page.locator('[data-testid="login-button"]').or(page.locator('text=Login'));
  if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await loginButton.click();
  }
  
  // Wait for Keycloak login form
  await page.waitForURL('**/auth/realms/**login**');
  
  // Fill username
  const usernameField = page.locator('#username').or(page.locator('input[name="username"]'));
  await usernameField.fill(NUTRITIONIST_EMAIL);
  
  // Fill password
  const passwordField = page.locator('#password').or(page.locator('input[name="password"]'));
  await passwordField.fill(NUTRITIONIST_PASSWORD);
  
  // Submit login
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  
  // Wait for redirect to app dashboard
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  
  // Verify we're logged in and have tenant loaded
  const userDropdown = page.locator('[data-testid="user-dropdown"]').or(page.locator('button:has-text("Nelson")'));
  await expect(userDropdown).toBeVisible({ timeout: 10000 });
  
  console.log('✓ Successfully authenticated as nutritionist');
  
  // Save storage state
  await context.storageState({ path: 'tests/auth/nutritionist.json' });
});
