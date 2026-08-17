import { chromium, FullConfig } from '@playwright/test';

const NUTRITIONIST_EMAIL = 'nelson@carajillolabs.com';
const NUTRITIONIST_PASSWORD = process.env.NUTRITIONIST_PASSWORD || 'nelson1234';
const PATIENT_EMAIL = 'frink@carajillolabs.com';
const PATIENT_PASSWORD = process.env.PATIENT_PASSWORD || 'frink1234';

/**
 * Global setup: Authenticate both users before running tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🔐 Starting global auth setup...');

  // Authenticate nutritionist
  await authenticateUser(
    'nutritionist',
    NUTRITIONIST_EMAIL,
    NUTRITIONIST_PASSWORD,
    'tests/auth/nutritionist.json',
    config.webServer?.url || 'http://localhost:4200'
  );

  // Authenticate patient
  await authenticateUser(
    'patient',
    PATIENT_EMAIL,
    PATIENT_PASSWORD,
    'tests/auth/patient.json',
    config.webServer?.url || 'http://localhost:4200'
  );

  console.log('✓ Global auth setup complete\n');
}

/**
 * Helper: Authenticate a single user
 */
async function authenticateUser(
  role: 'nutritionist' | 'patient',
  email: string,
  password: string,
  storageFile: string,
  baseURL: string
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`🔓 Authenticating ${role} (${email})...`);

    // Navigate to app
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Check if already logged in
    if (page.url().includes('/shell') || page.url().includes('/dashboard')) {
      console.log(`✓ ${role} already authenticated`);
      await context.storageState({ path: storageFile });
      await browser.close();
      return;
    }

    // Wait for login redirect
    try {
      await page.waitForURL('**/auth/realms/**login**', { timeout: 15000 });
    } catch {
      console.log(`ℹ No Keycloak redirect detected; attempting direct login elements`);
    }

    // Try to find and fill login form
    const usernameLocator = page
      .locator('#username')
      .or(page.locator('input[name="username"]'));
    const passwordLocator = page
      .locator('#password')
      .or(page.locator('input[name="password"]'));

    // Wait for form fields to be ready
    await usernameLocator.first().waitFor({ state: 'visible', timeout: 10000 });
    await passwordLocator.first().waitFor({ state: 'visible', timeout: 10000 });

    // Fill credentials
    await usernameLocator.first().fill(email);
    await passwordLocator.first().fill(password);

    // Get the submit button and click it
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });

    console.log(`  Filling login form for ${email}...`);

    // Click and wait for response
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Wait for auth to complete or error
    let attempts = 0;
    let currentUrl = page.url();
    while (currentUrl.includes('/realms/') && currentUrl.includes('login-actions') && attempts < 3) {
      attempts++;
      console.log(`  Attempt ${attempts}: Still on Keycloak, waiting...`);
      await page.waitForTimeout(2000);
      await page.reload();
      await page.waitForLoadState('networkidle');
      currentUrl = page.url();
    }

    if (currentUrl.includes('/realms/') && currentUrl.includes('login-actions')) {
      // Get page content for debugging
      const pageContent = await page.content();
      const hasErrorAlert = pageContent.includes('alert-error') || pageContent.includes('kc-feedback');
      const message = hasErrorAlert ? '- Keycloak shows an error' : '- No error visible but stuck on Keycloak';
      throw new Error(`Login failed: still on Keycloak after 3 reloads ${message}`);
    }

    console.log(`  ✓ Redirected from Keycloak to: ${currentUrl.substring(0, 50)}...`);

    // Save session (authentication redirect to dashboard confirmed working)
    await context.storageState({ path: storageFile });
    console.log(`✓ ${role} authenticated successfully`);
  } catch (error) {
    console.error(`✗ ${role} authentication failed:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
