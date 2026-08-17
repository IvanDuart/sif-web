import { Page } from '@playwright/test';
import { BasePage } from './base.page';

// ========== Help Page Navigation ==========

export class PatientPages extends BasePage {
  /**
   * Open Common tab
   */
  async openCommonTab(): Promise<void> {
    const commonTab = this.page.locator('button').filter({ hasText: /General|Common/ }).first();
    await commonTab.click();
    await this.page.waitForTimeout(300);
  }

  async openPatientTab(): Promise<void> {
    const patTab = this.page.locator('button').filter({ hasText: /Patient|Guía de Pacientes/ }).first();
    await patTab.click();
    await this.page.waitForTimeout(300);
  }

  async openSection(sectionId: string): Promise<void> {
    const sectionButton = this.page.locator(`button`).filter({ hasText: new RegExp(sectionId, 'i') }).first();
    await sectionButton.click();
    await this.page.waitForTimeout(500);
  }
}

// ========== App Pages (for reference) ==========

export class PatientDashboardPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/tenant-dashboard');
    const widget = this.page.locator('text=Agua, text=Comidas').first();
    await this.waitForElement(widget);
  }
}

export class PatientMenusPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/menus');
    const listOrTable = this.page.locator('tui-table, [data-testid="menus-list"]').first();
    await this.waitForElement(listOrTable);
  }
}

export class PatientMenuDetailPage extends BasePage {
  async goto(menuId: string = 'first'): Promise<void> {
    if (menuId === 'first') {
      await this.page.goto('/shell/menus');
      const firstMenuLink = this.page.locator('a[href*="/shell/menus/"], [data-testid="menu-row"]').first();
      await firstMenuLink.click();
    } else {
      await super.goto(`/shell/menus/${menuId}`);
    }
    const mealSection = this.page.locator('text=Comidas, text=Desayuno').first();
    await this.waitForElement(mealSection);
  }
}

export class ShoppingListsPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/shopping-lists');
    const listOrTable = this.page.locator('tui-table, [data-testid="shopping-lists"]').first();
    await this.waitForElement(listOrTable);
  }

  async openShoppingListDetail(): Promise<void> {
    const firstList = this.page.locator('[data-testid="shopping-list-row"], tr').first();
    await firstList.click();
    await this.page.waitForLoadState('networkidle');
  }
}

export class PatientProfilePage extends BasePage {
  async goto(): Promise<void> {
    // Patient views their own profile
    await super.goto('/shell/users/me');
    const profileSection = this.page.locator('text=Perfil, text=Mediciones').first();
    await this.waitForElement(profileSection);
  }

  async openAddMeasurementModal(): Promise<void> {
    const addButton = this.page.locator('button:has-text("Añadir medición"), [data-testid="add-measurement-btn"]').first();
    await addButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async openEditAnamnesisModal(): Promise<void> {
    const editButton = this.page.locator('button:has-text("Editar"), [data-testid="edit-anamnesis-btn"]').first();
    await editButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async openAddEventModal(): Promise<void> {
    const addButton = this.page.locator('button:has-text("Añadir evento"), [data-testid="add-event-btn"]').first();
    await addButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}
