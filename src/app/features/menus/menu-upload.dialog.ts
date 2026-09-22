import { Component, computed, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Observable, of, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs';
import { injectContext } from '@taiga-ui/polymorpheus';
import {TuiButton, TuiDialogContext, TuiTextfield, TuiDropdown, TuiInput} from '@taiga-ui/core';
import {TuiComboBox, TuiDataListWrapper, TuiChevron, TuiTextarea, TuiFiles} from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuUploadService } from '../../core/api/services/menu-upload.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService } from '../../core/ui';
import { Menu } from '../../core/api/models/menu.model';

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [FormsModule, TuiButton, TranslocoPipe, TuiTextarea, TuiTextfield, TuiDropdown, TuiComboBox, TuiDataListWrapper, TuiChevron, TuiInput, ...TuiFiles],
  templateUrl: './menu-upload.dialog.html'
})
export class MenuUploadDialog implements OnInit, OnDestroy {
  private readonly menuUploadService = inject(MenuUploadService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<Menu, { user?: AppUserDto | null } | void>>();

  private readonly searchSubject = new Subject<string>();

  users = signal<(AppUserDto & { fullName: string })[]>([]);
  loadingUsers = signal(false);
  hideUserPicker = signal(false);
  selectedUserId: (AppUserDto & { fullName: string }) | null = null;
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  name = signal('');
  description = signal('');

  hasFile = computed(() => this.selectedFile() !== null);

  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  private readonly VALID_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  userStringify = (user: AppUserDto & { fullName: string } | null): string => user?.fullName || '';

  ngOnInit() {
    const data = this.context.data;
    if (data && typeof data === 'object' && 'user' in data && data.user) {
      this.hideUserPicker.set(true);
      const u = data.user;
      this.selectedUserId = { ...u, fullName: u.firstName + ' ' + u.lastName };
    } else {
      this.loadUsers('');
    }

    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.fetchUsers(term))
      )
      .subscribe((mapped) => {
        this.users.set(mapped);
        this.loadingUsers.set(false);
      });
  }

  ngOnDestroy() {
    this.searchSubject.complete();
  }

  onPatientSearch(value: string) {
    this.loadingUsers.set(true);
    this.searchSubject.next(value || '');
  }

  private fetchUsers(term: string): Observable<(AppUserDto & { fullName: string })[]> {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of([]);
    return this.userRoleService
      .getUsersByTenantAndType(tenantId, 'PATIENT', { search: term || undefined, size: 50 })
      .pipe(
        map((res) =>
          (res.content || []).map(u => ({
            ...u,
            fullName: u.firstName + ' ' + u.lastName
          }))
        )
      );
  }

  loadUsers(term: string) {
    this.loadingUsers.set(true);
    this.fetchUsers(term).subscribe((mapped) => {
      this.users.set(mapped);
      this.loadingUsers.set(false);
    });
  }

  private validateFile(file: File): string | null {
    if (file.size > this.MAX_FILE_SIZE) {
      return 'Archivo demasiado grande (máx 10MB)';
    }
    if (!this.VALID_FILE_TYPES.includes(file.type)) {
      return 'Tipo de archivo no soportado. Usá PDF, JPG, PNG, DOC o DOCX.';
    }
    return null;
  }

  onFileSelected(file: File | null) {
    if (!file) {
      this.selectedFile.set(null);
      return;
    }

    const validationError = this.validateFile(file);
    if (validationError) {
      this.notify.warning(validationError);
      return;
    }

    this.selectedFile.set(file);
  }

  removeFile() {
    this.selectedFile.set(null);
  }

  upload() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.selectedUserId) {
      this.notify.warning('Selecciona un paciente primero');
      return;
    }

    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.menuUploadService.uploadMenu(tenantId, this.selectedUserId.id, file, this.name(), this.description()).subscribe({
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
