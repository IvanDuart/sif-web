import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Observable, of, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiButton, TuiDialogContext, TuiTextfield, TuiDropdown } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuUploadService } from '../../core/api/services/menu-upload.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { NotificationService } from '../../core/ui';

@Component({
  selector: 'app-menu-upload',
  standalone: true,
  imports: [FormsModule, TuiButton, TranslocoPipe, TuiTextfield, TuiDropdown, TuiComboBox, TuiDataListWrapper, TuiChevron],
  templateUrl: './menu-upload.dialog.html'
})
export class MenuUploadDialog implements OnInit, OnDestroy {
  private readonly menuUploadService = inject(MenuUploadService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<unknown, void>>();

  private readonly searchSubject = new Subject<string>();

  users = signal<(AppUserDto & { fullName: string })[]>([]);
  loadingUsers = signal(false);
  selectedUserId: (AppUserDto & { fullName: string }) | null = null;
  selectedFile: File | null = null;
  uploading = signal(false);

  userStringify = (user: AppUserDto & { fullName: string } | null): string => user?.fullName || '';

  ngOnInit() {
    this.loadUsers('');

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
    this.menuUploadService.uploadMenu(tenantId, this.selectedUserId.id, this.selectedFile).subscribe({
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
