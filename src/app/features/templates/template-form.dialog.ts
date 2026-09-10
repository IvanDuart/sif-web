import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiTextfield, TuiLabel } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuTemplateService, CreateMenuTemplateRequest, CreateMealTemplateRequest } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';

export interface TemplateFormDialogInput {
  initialMeals?: CreateMealTemplateRequest[];
  defaultName?: string;
}

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TuiButton, TuiInput, TuiTextarea, TuiTextfield, TuiLabel, TranslocoPipe],
  templateUrl: './template-form.dialog.html'
})
export class TemplateFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<MenuTemplate, TemplateFormDialogInput>>();

  saving = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    description: ['']
  });

  ngOnInit() {
    const initialData = this.context.data;
    if (initialData?.defaultName) {
      this.form.patchValue({ name: initialData.defaultName });
    }
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    const initialData = this.context.data;
    const payload = { 
      ...this.form.value, 
      meals: initialData?.initialMeals || [] 
    } as CreateMenuTemplateRequest;

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
