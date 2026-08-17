import { Page } from '@playwright/test';
import { BasePage } from './base.page';

// ========== Help Page Navigation ==========

export class NutritionistPages extends BasePage {
  /**
   * Open Common tab
   */
  async openCommonTab(): Promise<void> {
    const commonTab = this.page.locator('button').filter({ hasText: /General|Common/ }).first();
    await commonTab.click();
    await this.page.waitForTimeout(300);
  }

  async openNutritionistTab(): Promise<void> {
    const nutTab = this.page.locator('button').filter({ hasText: /Nutritionist|Para Nutricionistas/ }).first();
    await nutTab.click();
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

export class NutritionistDashboardPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/tenant-dashboard');
    const widget = this.page.locator('text=Próximas').first();
    await this.waitForElement(widget);
  }
}

export class PatientsListPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/users/PATIENT');
    const tableOrList = this.page.locator('tui-table, [data-testid="patients-list"]').first();
    await this.waitForElement(tableOrList);
  }

  async openInvitePatientModal(): Promise<void> {
    const inviteButton = this.page.locator('button:has-text("Invitar paciente"), [data-testid="invite-patient-btn"]').first();
    await inviteButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

export class PatientDetailPage extends BasePage {
  async goto(patientId: string = 'first'): Promise<void> {
    // If 'first', navigate to list and get first patient
    if (patientId === 'first') {
      await this.page.goto('/shell/users/PATIENT');
      const firstPatientLink = this.page.locator('a[href*="/shell/users/"], [data-testid="patient-row"]').first();
      await firstPatientLink.click();
    } else {
      await super.goto(`/shell/users/${patientId}`);
    }
    const profileSection = this.page.locator('text=Perfil, text=Mediciones').first();
    await this.waitForElement(profileSection);
  }
}

export class StaffListPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/users/STAFF');
    const tableOrList = this.page.locator('tui-table, [data-testid="staff-list"]').first();
    await this.waitForElement(tableOrList);
  }

  async openInviteStaffModal(): Promise<void> {
    const inviteButton = this.page.locator('button:has-text("Invitar equipo"), [data-testid="invite-staff-btn"]').first();
    await inviteButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

export class AppointmentsPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/appointments');
    const calendar = this.page.locator('.fc-calendar, [data-testid="appointments-calendar"]').first();
    await this.waitForElement(calendar);
  }

  async openCreateAppointmentModal(): Promise<void> {
    const createButton = this.page.locator('button:has-text("Nueva cita"), [data-testid="create-appointment-btn"]').first();
    await createButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

export class RevenuePage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/revenue');
    const chart = this.page.locator('canvas, [data-testid="revenue-chart"]').first();
    await this.waitForElement(chart);
  }
}

export class MenusPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/menus');
    const listOrTable = this.page.locator('tui-table, [data-testid="menus-list"]').first();
    await this.waitForElement(listOrTable);
  }

  async openCreateMenuModal(): Promise<void> {
    const createButton = this.page.locator('button:has-text("Crear menú"), [data-testid="create-menu-btn"]').first();
    await createButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async openUploadMenuModal(): Promise<void> {
    const uploadButton = this.page.locator('button:has-text("Subir menú"), [data-testid="upload-menu-btn"]').first();
    await uploadButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

export class MenuDetailPage extends BasePage {
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

  async openEditMealModal(): Promise<void> {
    const editButton = this.page.locator('[data-testid="edit-meal-btn"], button:has-text("Editar")').first();
    await editButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

export class TemplatesPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/templates');
    const listOrTable = this.page.locator('tui-table, [data-testid="templates-list"]').first();
    await this.waitForElement(listOrTable);
  }

  async openCreateTemplateModal(): Promise<void> {
    const createButton = this.page.locator('button:has-text("Crear plantilla"), [data-testid="create-template-btn"]').first();
    await createButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async openUploadTemplateModal(): Promise<void> {
    const uploadButton = this.page.locator('button:has-text("Subir plantilla"), [data-testid="upload-template-btn"]').first();
    await uploadButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

export class TemplateDetailPage extends BasePage {
  async goto(templateId: string = 'first'): Promise<void> {
    if (templateId === 'first') {
      await this.page.goto('/shell/templates');
      const firstTemplateLink = this.page.locator('a[href*="/shell/templates/"], [data-testid="template-row"]').first();
      await firstTemplateLink.click();
    } else {
      await super.goto(`/shell/templates/${templateId}`);
    }
    const mealSection = this.page.locator('text=Comidas, text=Desayuno').first();
    await this.waitForElement(mealSection);
  }
}

export class SettingsPage extends BasePage {
  async goto(): Promise<void> {
    await super.goto('/shell/settings');
    const tabs = this.page.locator('tui-tabs, [data-testid="settings-tabs"]').first();
    await this.waitForElement(tabs);
  }
}
