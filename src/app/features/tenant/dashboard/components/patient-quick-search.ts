import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { UserTenantRoleService } from '../../../../core/api/services/user-tenant-role.api';
import { AppUserDto } from '../../../../core/api/models/user.model';
import { TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';

interface PatientRow {
  id: string;
  label: string;
  email: string;
  initials: string;
}

/**
 * Buscador de pacientes de la cabecera del panel (prototipo
 * `design/dashboard-nutricionista.html`, `.search`).
 *
 * El prototipo describe un buscador global "paciente, plan o factura"; la API
 * solo permite buscar pacientes, así que se ofrece exactamente eso: escribir un
 * nombre y saltar a su ficha. Atajo `Ctrl/Cmd + K` como en el diseño.
 */
@Component({
  selector: 'app-patient-quick-search',
  standalone: true,
  imports: [FormsModule, TranslocoDirective, TuiAvatar, TuiInput, TuiTextfield],
  templateUrl: './patient-quick-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class PatientQuickSearch implements OnInit, OnDestroy {
  private readonly tenantCtx = inject(TenantContextService);
  private readonly userRoleService = inject(UserTenantRoleService);
  private readonly router = inject(Router);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  private readonly search$ = new Subject<string>();

  readonly query = signal('');
  readonly results = signal<PatientRow[]>([]);
  readonly open = signal(false);

  readonly hasQuery = computed(() => this.query().trim().length > 0);

  ngOnInit(): void {
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.fetch(term))
      )
      .subscribe((rows) => {
        this.results.set(rows);
        this.open.set(this.query().trim().length > 0);
      });
  }

  ngOnDestroy(): void {
    this.search$.complete();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    const term = value.trim();
    if (!term) {
      this.results.set([]);
      this.open.set(false);
      return;
    }
    this.search$.next(term);
  }

  private fetch(term: string) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of<PatientRow[]>([]);

    return this.userRoleService
      .getUsersByTenantAndType(tenantId, 'PATIENT', { search: term, size: 6 })
      .pipe(
        switchMap((res) =>
          of(
            (res.content || []).map((user: AppUserDto) => ({
              id: user.id,
              label: `${user.firstName} ${user.lastName}`.trim(),
              email: user.email ?? '',
              initials: `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase(),
            }))
          )
        )
      );
  }

  select(patient: PatientRow): void {
    this.router.navigate(['/users', patient.id]);
    this.reset();
  }

  close(): void {
    this.open.set(false);
  }

  /** Cierra el desplegable al pulsar fuera del componente. */
  onDocumentClick(event: MouseEvent): void {
    if (!this.hostRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  onFocus(): void {
    if (this.hasQuery()) this.open.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (isShortcut) {
      event.preventDefault();
      this.focusInput();
      return;
    }
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  private focusInput(): void {
    document.getElementById('dashboardPatientSearch')?.focus();
  }

  private reset(): void {
    this.query.set('');
    this.results.set([]);
    this.open.set(false);
  }
}
