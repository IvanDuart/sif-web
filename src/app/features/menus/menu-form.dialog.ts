import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MenuService } from '../../core/api/services/menu.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';

@Component({
  selector: 'app-menu-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule, CheckboxModule],
  templateUrl: './menu-form.dialog.html'
})
export class MenuFormDialog implements OnInit {
  private fb = inject(FormBuilder);
  private menuService = inject(MenuService);
  private userRoleService = inject(UserTenantRoleService);
  private tenantCtx = inject(TenantContextService);
  ref = inject(DynamicDialogRef);

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
    // Ideally we would search only 'USER' role, but the endpoint currently returns all users
    this.userRoleService.getUsersByTenant(tenantId).subscribe({
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
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.saving.set(true);
    const req = this.form.value as any; // Matches CreateMenuRequest_Public
    
    this.menuService.create(tenantId, req).subscribe({
      next: (createdMenu) => {
        this.saving.set(false);
        this.ref.close(createdMenu);
      },
      error: () => this.saving.set(false)
    });
  }
}
