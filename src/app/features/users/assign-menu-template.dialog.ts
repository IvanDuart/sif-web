import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiTextfield, TuiLabel } from '@taiga-ui/core';
import { TuiSwitch } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';
import { Menu } from '../../core/api/models/menu.model';

@Component({
  selector: 'app-assign-menu-template',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TuiButton, TuiInput, TuiTextfield, TuiLabel, TuiSwitch, TranslocoPipe],
  templateUrl: './assign-menu-template.dialog.html'
})
export class AssignMenuTemplateDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);

  readonly context = injectContext<TuiDialogContext<Menu, { userId: string }>>();
  ref = { close: () => this.context.$implicit.complete() };

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

  onTemplateChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const template = this.templates().find(t => t.id === value);
    if (template) {
      this.form.patchValue({ name: template.name + ' - Copia' });
    }
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.context.data?.userId;
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
        this.context.$implicit.next(menu);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false),
    });
  }
}
