import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { forkJoin, of, switchMap } from 'rxjs';

import { TenantService } from '../../core/api/services/tenant.api';
import { AuthService } from '../../core/auth/auth.service';
import { Tenant } from '../../core/api/models/tenant.model';
import { superAdminMembership } from '../../core/api/models/user.model';

/** Tamaño de página de `GET /api/tenants` al traerse el listado completo. */
const PAGE_SIZE = 100;
/** Tope de páginas: 2.000 centros son de sobra y acotan el arranque. */
const MAX_PAGES = 20;

/**
 * Selección de centro del superadministrador. No es miembro de ninguno, así
 * que `memberships` le llega vacío y el conmutador habitual de la cabecera no
 * tiene de dónde tirar: esta pantalla vive fuera del `Shell`, antes de que
 * exista contexto de tenant.
 *
 * `GET /api/tenants` no acepta búsqueda, así que el listado se trae entero y
 * se filtra en cliente.
 */
@Component({
  selector: 'app-select-tenant',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoDirective, TuiButton, TuiInput, TuiTextfield, TuiBadge],
  templateUrl: './select-tenant.page.html',
})
export default class SelectTenantPage implements OnInit {
  private readonly tenants = inject(TenantService);
  private readonly authService = inject(AuthService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly term = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  readonly all = signal<Tenant[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly enteringId = signal<string | null>(null);

  readonly results = computed(() => {
    const needle = this.term().trim().toLowerCase();
    const all = this.all();
    if (!needle) return all;
    return all.filter((tenant) => (tenant.name ?? '').toLowerCase().includes(needle));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.tenants
      .search(0, PAGE_SIZE)
      .pipe(
        switchMap((first) => {
          const totalPages = Math.min(first.page?.totalPages ?? 1, MAX_PAGES);
          if (totalPages <= 1) return of([first.content ?? []]);

          const rest = Array.from({ length: totalPages - 1 }, (_, index) =>
            this.tenants.search(index + 1, PAGE_SIZE)
          );
          return forkJoin(rest).pipe(
            switchMap((pages) => of([first.content ?? [], ...pages.map((p) => p.content ?? [])]))
          );
        })
      )
      .subscribe({
        next: (chunks) => {
          this.all.set(chunks.flat());
          this.loading.set(false);
        },
        error: () => {
          this.all.set([]);
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /**
   * Recarga la aplicación dentro del centro elegido: la marca, los permisos y
   * el canal de avisos se montan en el arranque, no al vuelo.
   */
  enter(tenant: Tenant): void {
    if (this.enteringId()) return;
    this.enteringId.set(tenant.id);
    this.authService.enterTenant(superAdminMembership(tenant.id, tenant.name ?? ''));
  }

  logout(): void {
    this.authService.clearSuperAdminTenant();
    this.authService.logout();
  }

  initials(tenant: Tenant): string {
    const name = (tenant.name ?? '').trim();
    if (!name) return '?';
    const words = name.split(/\s+/);
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
  }
}
