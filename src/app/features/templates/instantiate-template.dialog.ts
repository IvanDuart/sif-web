import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject, Observable, of, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext, TuiButton, TuiInput, TuiDropdown, TuiCheckbox } from '@taiga-ui/core';
import { TuiComboBox, TuiDataListWrapper, TuiChevron } from '@taiga-ui/kit';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuTemplateService, InstantiateMenuTemplateRequest } from '../../core/api/services/menu-template.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { MenuTemplate } from '../../core/api/models/menu-template.model';
import { Menu } from '../../core/api/models/menu.model';

export interface InstantiateTemplateDialogInput {
  template: MenuTemplate;
}

type PatientOption = AppUserDto & { fullName: string };

@Component({
  selector: 'app-instantiate-template',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TuiButton, TuiInput, TuiDropdown, TuiComboBox, TuiDataListWrapper, TuiChevron, TranslocoPipe, TuiCheckbox],
  templateUrl: './instantiate-template.dialog.html'
})
export class InstantiateTemplateDialog implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(MenuTemplateService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  readonly context = injectContext<TuiDialogContext<Menu, InstantiateTemplateDialogInput>>();

  private readonly searchSubject = new Subject<string>();

  template: MenuTemplate | null = null;
  users = signal<PatientOption[]>([]);
  loadingUsers = signal(false);
  saving = signal(false);

  patientStringify = (user: PatientOption | null): string => user?.fullName || '';

  form = this.fb.group({
    appUserId: [null as PatientOption | null, Validators.required],
    name: ['', Validators.required],
    isActive: [true]
  });

  ngOnInit() {
    this.template = this.context.data.template;
    if (this.template) {
      this.form.patchValue({ name: this.template.name + ' - Copia' });
    }
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

  private fetchUsers(term: string): Observable<PatientOption[]> {
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
    if (this.form.invalid || !this.template) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.getRawValue();
    const selected = raw.appUserId;
    if (!selected) return;

    const request: InstantiateMenuTemplateRequest = {
      appUserId: selected.id,
      name: raw.name ?? undefined,
      isActive: raw.isActive ?? undefined
    };

    this.saving.set(true);
    this.templateService.instantiate(tenantId, this.template.id, request).subscribe({
      next: (menu) => {
        this.saving.set(false);
        this.context.$implicit.next(menu);
        this.context.$implicit.complete();
      },
      error: () => this.saving.set(false)
    });
  }
}
