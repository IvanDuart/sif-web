import { chromium, FullConfig } from '@playwright/test';

const NUTRITIONIST_EMAIL = 'nelson@carajillolabs.com';
const NUTRITIONIST_PASSWORD = process.env.NUTRITIONIST_PASSWORD;
const PATIENT_EMAIL = 'frink@carajillolabs.com';
const PATIENT_PASSWORD = process.env.PATIENT_PASSWORD;

/**
 * Global setup: Authenticate both users before running tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🔐 Starting global auth setup...');

  if (!NUTRITIONIST_PASSWORD || !PATIENT_PASSWORD) {
    throw new Error(
      'Missing required env vars: NUTRITIONIST_PASSWORD and PATIENT_PASSWORD must be set'
    );
  }

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

    // Check if already logged in (has dashboard in URL and tenant loaded)
    if (page.url().includes('/dashboard')) {
      // Verify tenant is loaded by checking for localStorage or app state
      const tenantLoaded = await page.evaluate(() => {
        return localStorage.getItem('active-tenant') !== null;
      });
      if (tenantLoaded) {
        console.log(`✓ ${role} already authenticated`);
        await context.storageState({ path: storageFile });
        await browser.close();
        return;
      }
    }

    // Wait for Keycloak login redirect - correct KC 26 path
    try {
      await page.waitForURL('**/realms/master/protocol/openid-connect/auth*', { timeout: 15000 });
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

    // Wait for auth to complete - redirect back to app
    let attempts = 0;
    let currentUrl = page.url();
    while (
      (currentUrl.includes('/realms/') && currentUrl.includes('login-actions')) &&
      attempts < 3
    ) {
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

    // Wait for app to fully load and tenant context to be established
    // The app navigates to /dashboard after auth, then authGuard waits for isTenantLoaded$
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Additional wait for tenant context (localStorage active-tenant)
    await page.waitForFunction(() => {
      return localStorage.getItem('active-tenant') !== null;
    }, {}, 10000);

    console.log(`  ✓ Tenant context loaded`);

    // Save session
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
