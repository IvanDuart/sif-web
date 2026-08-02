import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuService, CreateMenuRequest } from '../../core/api/services/menu.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';

@Component({
  selector: 'app-menu-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './menu-form.dialog.html'
})
export class MenuFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly menuService = inject(MenuService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<unknown, { userId?: string }>>();

  users = signal<(AppUserDto & { fullName: string })[]>([]);
  loadingUsers = signal(false);
  saving = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    appUserId: ['', Validators.required],
    isActive: [true]
  });

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loadingUsers.set(true);
    this.userRoleService.getUsersByTenantAndType(tenantId, 'PATIENT', { size: 1000 }).subscribe({
      next: (res) => {
        const mapped = (res.content || []).map(u => ({
          ...u,
          fullName: u.firstName + ' ' + u.lastName
        }));
        this.users.set(mapped);
        this.loadingUsers.set(false);

        const userId = this.context.data?.userId;
        if (userId) {
          this.form.patchValue({ appUserId: userId });
          this.form.get('appUserId')?.disable();
        }
      },
      error: () => this.loadingUsers.set(false)
    });
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    const req = this.form.getRawValue() as CreateMenuRequest;

    this.menuService.create(tenantId, req).subscribe({
      next: (createdMenu) => {
        this.saving.set(false);
        this.context.$implicit.next(createdMenu);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
