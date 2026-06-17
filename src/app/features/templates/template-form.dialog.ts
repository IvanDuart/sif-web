import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MenuTemplateService, CreateMenuTemplateRequest } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Button, InputText, Textarea],
  templateUrl: './template-form.dialog.html'
})
export class TemplateFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  ref = inject(DynamicDialogRef);

  saving = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    description: ['']
  });

  submit() {
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    const payload = { ...this.form.value, meals: [] } as CreateMenuTemplateRequest;
    this.templateService.create(tenantId, payload).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.ref.close(created);
      },
      error: () => this.saving.set(false)
    });
  }
}
