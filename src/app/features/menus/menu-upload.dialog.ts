import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
import { MenuUploadService } from '../../core/api/services/menu-upload.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService } from '../../core/ui';

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './menu-upload.dialog.html'
})
export class MenuUploadDialog implements OnInit {
  private readonly menuUploadService = inject(MenuUploadService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<unknown, void>>();

  users = signal<(AppUserDto & { fullName: string })[]>([]);
  loadingUsers = signal(false);
  selectedUserId: string | null = null;
  selectedFile: File | null = null;
  uploading = signal(false);

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

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  upload() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.selectedUserId) {
      this.notify.warning('Selecciona un paciente primero');
      return;
    }

    if (!this.selectedFile) return;

    this.uploading.set(true);
    this.menuUploadService.uploadMenu(tenantId, this.selectedUserId, this.selectedFile).subscribe({
      next: (createdMenu) => {
        this.notify.success('Menú extraído y creado correctamente');
        this.context.$implicit.next(createdMenu);
        this.context.$implicit.complete();
      },
      error: () => {
        this.uploading.set(false);
      }
    });
  }

  cancel() {
    this.context.$implicit.complete();
  }
}
