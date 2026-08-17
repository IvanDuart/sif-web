import { test } from '@playwright/test';
import { BasePage } from './pages/base.page';
import { 
  NutritionistDashboardPage, 
  PatientsListPage, 
  MenusPage, 
  AppointmentsPage, 
  RevenuePage 
} from './pages/nutritionist.pages';
import { 
  PatientDashboardPage, 
  ShoppingListsPage, 
  PatientProfilePage as PatientUserPage 
} from './pages/patient.pages';
import { captureHelpScreenshot } from './utils/screenshot';

/**
 * Help page screenshot capture tests
 * Captures real application screens for each help topic/section
 */

test.describe('Help Page Screenshots - Nutritionist', () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page, context }) => {
    basePage = new BasePage(page);
  });

  test('capture: Help page - Overview', async ({ page }) => {
    await basePage.navigateToHelp();
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'help-overview');
  });

  test('capture: Common section - Getting Started', async ({ page }) => {
    await page.goto('/shell/tenant-dashboard');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'common-getting-started');
  });

  test('capture: Common section - Account Management', async ({ page }) => {
    await page.goto('/shell/users/me');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'common-account-management');
  });

  test('capture: Nutritionist section - Dashboard', async ({ page }) => {
    await page.goto('/shell/tenant-dashboard');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'nutri-dashboard');
  });

  test('capture: Nutritionist section - Patient Management', async ({ page }) => {
    await page.goto('/shell/users/PATIENT');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'nutri-patient-management');
  });

  test('capture: Nutritionist section - Menu Planning', async ({ page }) => {
    await page.goto('/shell/menus');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'nutri-menu-planning');
  });

  test('capture: Nutritionist section - Appointments', async ({ page }) => {
    await page.goto('/shell/appointments');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'nutri-appointments');
  });

  test('capture: Nutritionist section - Revenue', async ({ page }) => {
    await page.goto('/shell/revenue');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'nutri-revenue');
  });

  test('capture: Nutritionist section - Reports', async ({ page }) => {
    await page.goto('/shell/reports');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'nutri-reports');
  });

  test('capture: Patient guide section - Nutritionist View', async ({ page }) => {
    await page.goto('/shell/users/PATIENT');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'patient-interface');
  });

  test('capture: Patient guide section - Viewing Records', async ({ page }) => {
    await page.goto('/shell/users/PATIENT');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'patient-viewing-records');
  });

  test('capture: Patient guide section - Appointments from Patient View', async ({ page }) => {
    await page.goto('/shell/appointments');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'nutritionist', 'patient-appointments');
  });
});

test.describe('Help Page Screenshots - Patient', () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page, context }) => {
    basePage = new BasePage(page);
  });

  test('capture: Help page - Patient Overview', async ({ page }) => {
    await basePage.navigateToHelp();
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'help-overview');
  });

  test('capture: Patient Common - Getting Started', async ({ page }) => {
    await page.goto('/shell/tenant-dashboard');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'common-getting-started');
  });

  test('capture: Patient Common - Account Management', async ({ page }) => {
    await page.goto('/shell/users/me');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'common-account-management');
  });

  test('capture: Patient section - Patient Interface', async ({ page }) => {
    await page.goto('/shell/tenant-dashboard');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'patient-interface');
  });

  test('capture: Patient section - Viewing Records', async ({ page }) => {
    await page.goto('/shell/users/me');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'patient-viewing-records');
  });

  test('capture: Patient section - Appointments', async ({ page }) => {
    await page.goto('/shell/appointments');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'patient-appointments');
  });

  test('capture: Patient section - Shopping Lists', async ({ page }) => {
    await page.goto('/shell/shopping-lists');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'patient-shopping-lists');
  });

  test('capture: Patient section - Profile Settings', async ({ page }) => {
    await page.goto('/shell/users/me');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'patient-profile-settings');
  });

  test('capture: Patient section - Support', async ({ page }) => {
    await page.goto('/shell/help');
    await page.waitForLoadState('networkidle');
    await captureHelpScreenshot(page, 'patient', 'patient-support');
  });
});
