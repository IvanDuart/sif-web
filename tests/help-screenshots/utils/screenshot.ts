import { Page } from '@playwright/test';
import * as path from 'path';

/**
 * Helper to capture screenshots and save to organized directory structure
 * @param page Playwright page object
 * @param name Screenshot name (e.g., 'dashboard', 'patients-invite-modal')
 * @param role 'nutritionist' | 'patient'
 * @param theme 'light' | 'dark' (inferred from page's colorScheme)
 * @param viewport 'desktop' | 'mobile' (inferred from page viewport size)
 * @returns Screenshot file path relative to assets/help/screenshots/
 */
export async function captureHelpScreenshot(
  page: Page,
  role: 'nutritionist' | 'patient',
  name: string
): Promise<string> {
  const theme = page.context().colorScheme === 'dark' ? 'dark' : 'light';
  const viewport = page.viewportSize();
  const isDesktop = (viewport?.width || 1440) >= 1024;
  const viewportType = isDesktop ? 'desktop' : 'mobile';
  
  // Ensure stable viewport
  await page.evaluate(() => {
    if (document.body) {
      document.body.style.scrollBehavior = 'auto';
    }
  });
  
  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  
  // Wait for any animations to complete
  await page.waitForTimeout(300);
  
  // Build path: assets/help/screenshots/{name}/{theme}/{viewport}/{role}.png
  const fileName = `${role}.png`;
  const filePath = path.join(
    'src',
    'assets',
    'help',
    'screenshots',
    name,
    theme,
    viewportType,
    fileName
  );
  
  // Ensure directory exists
  const fs = require('fs');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Take screenshot
  await page.screenshot({
    path: filePath,
    fullPage: true,
  });
  
  console.log(`✓ Screenshot: ${filePath}`);
  
  return path.join(name, theme, viewportType, fileName);
}

/**
 * Helper to wait for page to be stable (no loading spinners, animations complete)
 */
export async function waitForPageStable(page: Page, timeout = 5000): Promise<void> {
  // Wait for any tui-loader spinners to be hidden
  const loaders = page.locator('[tuiLoader]');
  const count = await loaders.count();
  
  if (count > 0) {
    await page.locator('[tuiLoader]:visible').waitFor({ state: 'hidden', timeout });
  }
  
  // Wait for network idle
  await page.waitForLoadState('networkidle');
  
  // Wait for animations to complete
  await page.waitForTimeout(500);
}

/**
 * Helper to scroll and close any open popovers before screenshot
 */
export async function prepareForScreenshot(page: Page): Promise<void> {
  // Close any open popovers by clicking elsewhere
  await page.evaluate(() => {
    document.body.click();
  });
  
  await page.waitForTimeout(300);
  
  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  
  await waitForPageStable(page);
}
