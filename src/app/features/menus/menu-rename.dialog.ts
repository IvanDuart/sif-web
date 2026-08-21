import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton } from '@taiga-ui/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { MenuService } from '../../core/api/services/menu.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Menu } from '../../core/api/models/menu.model';

export interface MenuRenameDialogInput {
  menu: Menu;
}

@Component({
  selector: 'app-menu-rename',
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, TranslocoDirective],
  templateUrl: './menu-rename.dialog.html'
})
export class MenuRenameDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly menuService = inject(MenuService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<Menu, MenuRenameDialogInput>>();

  saving = signal(false);
  menu: Menu | null = null;

  form = this.fb.group({
    name: ['', Validators.required]
  });

  ngOnInit() {
    this.menu = this.context.data.menu;
    this.form.patchValue({ name: this.menu?.name || '' });
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid || !this.menu) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const name = this.form.get('name')?.value?.trim() || '';
    if (!name) return;

    this.saving.set(true);
    this.menuService.update(tenantId, this.menu.id, { name }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.context.$implicit.next(updated);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
