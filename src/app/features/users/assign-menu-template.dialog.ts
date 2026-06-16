import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';

@Component({
  selector: 'app-assign-menu-template',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule, CheckboxModule],
  templateUrl: './assign-menu-template.dialog.html'
})
export class AssignMenuTemplateDialog implements OnInit {
  private fb = inject(FormBuilder);
  private templateService = inject(MenuTemplateService);
  private tenantCtx = inject(TenantContextService);

  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

  templates = signal<MenuTemplate[]>([]);
  loadingTemplates = signal(false);
  saving = signal(false);

  form = this.fb.group({
    templateId: ['', Validators.required],
    name: ['', Validators.required],
    isActive: [true],
  });

  ngOnInit() {
    this.loadTemplates();
  }

  private loadTemplates() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loadingTemplates.set(true);
    this.templateService.search(tenantId, 0, 100).subscribe({
      next: (page) => {
        this.templates.set(page.content || []);
        this.loadingTemplates.set(false);
      },
      error: () => this.loadingTemplates.set(false),
    });
  }

  onTemplateChange(event: { value: string }) {
    const template = this.templates().find(t => t.id === event.value);
    if (template) {
      this.form.patchValue({ name: template.name + ' - Copia' });
    }
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.config.data?.userId;
    if (!tenantId || !userId) return;

    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.templateService.instantiate(tenantId, raw.templateId!, {
      appUserId: userId,
      name: raw.name!,
      isActive: raw.isActive ?? true,
    }).subscribe({
      next: (menu) => {
        this.saving.set(false);
        this.ref.close(menu);
      },
      error: () => this.saving.set(false),
    });
  }
}
