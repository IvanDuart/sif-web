import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { MenuTemplateService, InstantiateMenuTemplateRequest } from '../../core/api/services/menu-template.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { MenuTemplate } from '../../core/api/models/menu-template.model';

export interface InstantiateTemplateDialogInput {
  template: MenuTemplate;
}

@Component({
  selector: 'app-instantiate-template',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TuiTextfield],
  templateUrl: './instantiate-template.dialog.html'
})
export class InstantiateTemplateDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<boolean, InstantiateTemplateDialogInput>>();

  template: MenuTemplate | null = null;
  users = signal<(AppUserDto & { fullName: string })[]>([]);
  loadingUsers = signal(false);
  saving = signal(false);

  form = this.fb.group({
    appUserId: ['', Validators.required],
    name: ['', Validators.required],
    isActive: [true]
  });

  ngOnInit() {
    this.template = this.context.data.template;
    if (this.template) {
      this.form.patchValue({ name: this.template.name + ' - Copia' });
    }
    this.loadUsers();
  }

  loadUsers() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loadingUsers.set(true);
    this.userRoleService.getUsersByTenantAndType(tenantId, 'PATIENT').subscribe({
      next: (res) => {
        const mapped = res.map(u => ({
          ...u,
          fullName: u.firstName + ' ' + u.lastName
        }));
        this.users.set(mapped);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false)
    });
  }

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid || !this.template) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    this.templateService.instantiate(tenantId, this.template.id, this.form.value as InstantiateMenuTemplateRequest).subscribe({
      next: () => {
        this.saving.set(false);
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
