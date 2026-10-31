import { Component, inject, OnInit, signal } from '@angular/core';
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

  ngOnInit(): void {
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

    this.creatingId.set(user.id);
    this.chatThreads
      .create(tenantId, { patientId: user.id })
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
