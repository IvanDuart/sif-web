import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton, TuiInput, TuiTextfield, TuiDialogContext } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

import { ChatThreadService } from '../../../core/api/services/chat-thread.api';
import { UserTenantRoleService } from '../../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../../core/api/models/user.model';
import { ChatThreadDto } from '../../../core/api/models/chat.model';

/**
 * Selector de paciente para abrir una conversación nueva. El backend devuelve
 * el hilo existente si ya lo hay, así que elegir el mismo paciente dos veces no
 * duplica nada.
 *
 * Un nutricionista abre el hilo consigo mismo, así que `nutritionistId` es
 * opcional. Para un superadministrador es obligatorio —el valor por defecto lo
 * metería a él dentro de una conversación clínica—, de ahí el paso previo de
 * elegir profesional.
 */
@Component({
  selector: 'app-new-thread-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiInput,
    TuiTextfield,
    TuiAvatar,
  ],
  templateUrl: './new-thread.dialog.html',
})
export class NewThreadDialog implements OnInit {
  private readonly chatThreads = inject(ChatThreadService);
  private readonly users = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<ChatThreadDto | null>>();

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly results = signal<AppUserDto[]>([]);
  readonly loading = signal(false);
  readonly creatingId = signal<string | null>(null);

  /** El superadmin tiene que nombrar al profesional del hilo (409 si no). */
  readonly needsNutritionist = computed(() => this.tenantCtx.isSuperAdmin());
  readonly nutritionist = signal<AppUserDto | null>(null);
  readonly staffSearchControl = new FormControl('', { nonNullable: true });
  readonly staffResults = signal<AppUserDto[]>([]);
  readonly staffLoading = signal(false);

  /** ¿Toca elegir profesional antes que paciente? */
  readonly pickingNutritionist = computed(
    () => this.needsNutritionist() && !this.nutritionist()
  );

  ngOnInit(): void {
    if (this.needsNutritionist()) this.initStaffSearch();

    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.fetchPatients(term))
      )
      .subscribe({
        next: (users) => this.results.set(users),
        error: () => this.results.set([]),
      });

    this.loading.set(true);
    this.fetchPatients('').subscribe({
      next: (users) => {
        this.results.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private initStaffSearch(): void {
    this.staffSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.fetchStaff(term))
      )
      .subscribe({
        next: (users) => this.staffResults.set(users),
        error: () => this.staffResults.set([]),
      });

    this.staffLoading.set(true);
    this.fetchStaff('').subscribe({
      next: (users) => {
        this.staffResults.set(users);
        this.staffLoading.set(false);
      },
      error: () => this.staffLoading.set(false),
    });
  }

  private fetchStaff(term: string) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of<AppUserDto[]>([]);

    return this.users
      .getUsersByTenantAndType(tenantId, 'STAFF', {
        search: term.trim() || undefined,
        size: 10,
        sort: ['firstName,ASC'],
      })
      .pipe(switchMap((page) => of(page.content ?? [])));
  }

  chooseNutritionist(user: AppUserDto): void {
    this.nutritionist.set(user);
  }

  clearNutritionist(): void {
    this.nutritionist.set(null);
  }

  fullName(user: AppUserDto): string {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  }

  private fetchPatients(term: string) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of<AppUserDto[]>([]);

    return this.users
      .getUsersByTenantAndType(tenantId, 'PATIENT', {
        search: term.trim() || undefined,
        size: 10,
        sort: ['firstName,ASC'],
      })
      .pipe(switchMap((page) => of(page.content ?? [])));
  }

  initials(user: AppUserDto): string {
    return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  }

  open(user: AppUserDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.creatingId()) return;

    const nutritionistId = this.nutritionist()?.id;
    if (this.needsNutritionist() && !nutritionistId) return;

    // Para un nutricionista se omite: el backend lo resuelve con el usuario
    // autenticado y mandarlo a `null` no es lo mismo que no mandarlo.
    const request = nutritionistId
      ? { patientId: user.id, nutritionistId }
      : { patientId: user.id };

    this.creatingId.set(user.id);
    this.chatThreads
      .create(tenantId, request)
      .subscribe({
        next: (thread) => {
          this.creatingId.set(null);
          this.context.$implicit.next(thread);
          this.context.$implicit.complete();
        },
        error: () => this.creatingId.set(null),
      });
  }

  cancel(): void {
    this.context.$implicit.next(null);
    this.context.$implicit.complete();
  }

  /** Texto de ayuda accesible para el botón de cada paciente. */
  openLabel(user: AppUserDto): string {
    return this.transloco.translate('chat.start_with', {
      name: `${user.firstName} ${user.lastName}`.trim(),
    });
  }
}
