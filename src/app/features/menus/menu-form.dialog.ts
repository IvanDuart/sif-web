import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject, Observable, of, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiTextfield, TuiDropdown } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuService, CreateMenuRequest } from '../../core/api/services/menu.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';

@Component({
  selector: 'app-menu-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslocoPipe, TuiTextfield, TuiDropdown, TuiComboBox, TuiDataListWrapper, TuiChevron],
  templateUrl: './menu-form.dialog.html'
})
export class MenuFormDialog implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly menuService = inject(MenuService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<unknown, { userId?: string }>>();

  private readonly searchSubject = new Subject<string>();

  users = signal<(AppUserDto & { fullName: string })[]>([]);
  loadingUsers = signal(false);
  saving = signal(false);

  userStringify = (user: AppUserDto & { fullName: string } | null): string => user?.fullName || '';

  form = this.fb.group({
    name: ['', Validators.required],
    appUserId: [null as (AppUserDto & { fullName: string }) | null, Validators.required],
    isActive: [true]
  });

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

    const userId = this.context.data?.userId;
    if (userId) {
      this.form.patchValue({ appUserId: { id: userId, fullName: '' } as AppUserDto & { fullName: string } });
      this.form.get('appUserId')?.disable();
    }
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

  cancel() {
    this.context.$implicit.complete();
  }

  submit() {
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.getRawValue();
    const selected = raw.appUserId;
    if (!selected) return;

    this.saving.set(true);
    const req = { ...raw, appUserId: selected.id } as CreateMenuRequest;

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
