import { defineConfig, devices } from '@playwright/test';

/**
 * Help/Manual Screenshots Configuration
 * Captures 84 screenshots: 13 pages + 8 modals × 2 roles × light/dark × desktop/mobile
 */
export default defineConfig({
  testDir: './tests/help-screenshots',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  timeout: 30000,
  expect: { timeout: 5000 },
  
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Global setup for authentication
  globalSetup: './tests/auth/global-setup.ts',

  projects: [
    // ========== NUTRITIONIST PROJECTS ==========
    {
      name: 'nutri-light-desktop',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/auth/nutritionist.json',
        colorScheme: 'light',
      },
    },
    {
      name: 'nutri-dark-desktop',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/auth/nutritionist.json',
        colorScheme: 'dark',
      },
    },
    {
      name: 'nutri-light-mobile',
      use: {
        ...devices['iPhone 13'],
        storageState: 'tests/auth/nutritionist.json',
        colorScheme: 'light',
      },
    },
    {
      name: 'nutri-dark-mobile',
      use: {
        ...devices['iPhone 13'],
        storageState: 'tests/auth/nutritionist.json',
        colorScheme: 'dark',
      },
    },

    // ========== PATIENT PROJECTS ==========
    {
      name: 'patient-light-desktop',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/auth/patient.json',
        colorScheme: 'light',
      },
    },
    {
      name: 'patient-dark-desktop',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/auth/patient.json',
        colorScheme: 'dark',
      },
    },
    {
      name: 'patient-light-mobile',
      use: {
        ...devices['iPhone 13'],
        storageState: 'tests/auth/patient.json',
        colorScheme: 'light',
      },
    },
    {
      name: 'patient-dark-mobile',
      use: {
        ...devices['iPhone 13'],
        storageState: 'tests/auth/patient.json',
        colorScheme: 'dark',
      },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
