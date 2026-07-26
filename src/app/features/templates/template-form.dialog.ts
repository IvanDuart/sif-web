import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiTextfield, TuiLabel } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuTemplateService, CreateMenuTemplateRequest } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TuiButton, TuiInput, TuiTextarea, TuiTextfield, TuiLabel, TranslocoPipe],
  templateUrl: './template-form.dialog.html'
})
export class TemplateFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<MenuTemplate, void>>();

  saving = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    description: ['']
  });

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    const payload = { ...this.form.value, meals: [] } as CreateMenuTemplateRequest;
    this.templateService.create(tenantId, payload).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.context.$implicit.next(created);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
