import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { MenuTemplate } from '../../core/api/models/menu-template.model';

@Component({
  selector: 'app-instantiate-template',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Button, InputText, Select, Checkbox],
  templateUrl: './instantiate-template.dialog.html'
})
export class InstantiateTemplateDialog implements OnInit {
  private fb = inject(FormBuilder);
  private templateService = inject(MenuTemplateService);
  private userRoleService = inject(UserTenantRoleService);
  private tenantCtx = inject(TenantContextService);
  
  ref = inject(DynamicDialogRef);
  config = inject(DynamicDialogConfig);

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
    this.template = this.config.data.template;
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

  submit() {
    if (this.form.invalid || !this.template) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    this.templateService.instantiate(tenantId, this.template.id, this.form.value as any).subscribe({
      next: (menu) => {
        this.saving.set(false);
        this.ref.close(menu);
      },
      error: () => this.saving.set(false)
    });
  }
}
