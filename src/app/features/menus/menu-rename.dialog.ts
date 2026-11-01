import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiTextfield, TuiInput } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';

import { MenuService } from '../../core/api/services/menu.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Menu } from '../../core/api/models/menu.model';
import { bindingAccess } from '../assistant/mascot/fill/descriptor';
import { MascotFillService } from '../assistant/mascot/fill/mascot-fill.service';
import { MENU_RENAME_SURFACE } from '../assistant/mascot/fill/surfaces/menu-rename.surface';

export interface MenuRenameDialogInput {
  menu: Menu;
}

@Component({
  selector: 'app-menu-rename',
  standalone: true,
  imports: [FormsModule, TuiButton, TranslocoPipe, TuiTextarea, TuiTextfield, TuiInput],
  templateUrl: './menu-rename.dialog.html'
})
export class MenuRenameDialog implements OnInit {

  constructor() {
    // Mientras el diálogo esté abierto, la mascota puede rellenarlo.
    inject(MascotFillService).register(MENU_RENAME_SURFACE, bindingAccess({
      name: { get: () => this.name(), set: (value) => this.name.set(String(value ?? '')) },
    }));
  }
  private readonly menuService = inject(MenuService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<Menu, MenuRenameDialogInput>>();

  saving = signal(false);
  menu: Menu | null = null;
  name = signal('');
  description = signal('');

  ngOnInit() {
    this.menu = this.context.data.menu;
    this.name.set(this.menu?.name || '');
    this.description.set(this.menu?.description || '');
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    const name = this.name().trim();
    if (!this.menu || !name) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const description = this.description().trim() || undefined;

    this.saving.set(true);
    this.menuService.update(tenantId, this.menu.id, { name, description }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.context.$implicit.next(updated);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
