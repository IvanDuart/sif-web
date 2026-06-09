import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MenuUploadService } from '../../core/api/services/menu-upload.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, SelectModule, FileUploadModule, MessageModule],
  templateUrl: './menu-upload.dialog.html'
})
export class MenuUploadDialog implements OnInit {
  private menuUploadService = inject(MenuUploadService);
  private userRoleService = inject(UserTenantRoleService);
  private tenantCtx = inject(TenantContextService);
  private messageService = inject(MessageService);
  ref = inject(DynamicDialogRef);

  users = signal<(AppUserDto & { fullName: string })[]>([]);
  loadingUsers = signal(false);
  selectedUserId: string | null = null;

  ngOnInit() {
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

  onUpload(event: any) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.selectedUserId) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Selecciona un paciente primero' });
      return;
    }

    const file = event.files[0];
    if (!file) return;

    // Trigger upload
    this.menuUploadService.uploadMenu(tenantId, this.selectedUserId, file).subscribe({
      next: (createdMenu) => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Menú extraído y creado correctamente' });
        this.ref.close(createdMenu);
      },
      error: () => {
        // Error interceptor handles the toast
        event.options.clear(); // Clear files on error so they can try again
      }
    });
  }
}
