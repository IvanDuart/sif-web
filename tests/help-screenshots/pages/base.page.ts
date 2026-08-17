import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object with common utilities
 */
export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific route
   */
  async goto(route: string): Promise<void> {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to /help
   */
  async navigateToHelp(): Promise<void> {
    await this.goto('/help');
  }

  /**
   * Verify role is loaded by checking visible tabs
   */
  async verifyRoleIsLoaded(role: 'nutritionist' | 'patient'): Promise<void> {
    await expect(this.page.locator('h1')).toContainText(/Centro de Ayuda|Help/);
  }

  /**
   * Wait for element to be stable (visible and network idle)
   */
  async waitForElement(locator: Locator, timeout = 5000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Close any open popovers/modals by pressing Escape
   */
  async closePopovers(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }
}
