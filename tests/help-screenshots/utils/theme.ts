import { Page } from '@playwright/test';

/**
 * Helper to toggle dark/light mode in the app
 * Clicks the theme toggle button in the shell header
 */
export async function toggleTheme(page: Page): Promise<void> {
  // Find the theme toggle button (usually in header/shell)
  // It's typically an icon button with moon/sun icon
  const themeToggleButton = page.locator('[data-testid="theme-toggle"]')
    .or(page.locator('button:has-text("🌙")'))
    .or(page.locator('button:has-text("☀️")'))
    .or(page.locator('button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"]').first());
  
  if (await themeToggleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await themeToggleButton.click();
    await page.waitForTimeout(500); // Wait for theme transition
  } else {
    console.warn('⚠ Theme toggle button not found, may need manual implementation');
  }
}

/**
 * Helper to verify current theme
 */
export async function getCurrentTheme(page: Page): Promise<'light' | 'dark'> {
  const htmlClass = await page.locator('html').getAttribute('class');
  const hasDarkClass = htmlClass?.includes('dark');
  return hasDarkClass ? 'dark' : 'light';
}

/**
 * Helper to set theme explicitly via localStorage or attribute
 * (used if button toggle isn't reliable)
 */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    const html = document.documentElement;
    if (t === 'dark') {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, theme);
  
  await page.waitForTimeout(500); // Wait for theme CSS to apply
}
