import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { TenantService } from '../api/services/tenant.api';
import { AppUserDto } from '../api/models/user.model';

/**
 * Angular no encadena los `canActivate` de una ruta: los lanza a la vez y
 * combina los resultados. Así que `adminGuard` no hereda la espera de
 * `authGuard` por ir detrás en el array — en un refresco en frío se ejecuta
 * cuando todavía no hay usuario, y si decide ahí expulsa al administrador de
 * su propio panel.
 */
describe('la entrada al panel de administración', () => {
  let isTenantLoaded$: BehaviorSubject<boolean>;
  let user: ReturnType<typeof signal<AppUserDto | null>>;
  let currentTenantId: ReturnType<typeof signal<string | null>>;
  let tenantProfile: ReturnType<typeof signal<{ adminTenant: boolean } | null>>;

  function run(): Promise<boolean | UrlTree> {
    return new Promise((resolve) => {
      const result = TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
      );
      (result as Observable<boolean | UrlTree>).subscribe(resolve);
    });
  }

  function urlOf(result: boolean | UrlTree): string {
    return result === true || result === false ? String(result) : result.toString();
  }

  beforeEach(() => {
    isTenantLoaded$ = new BehaviorSubject<boolean>(false);
    user = signal<AppUserDto | null>(null);
    currentTenantId = signal<string | null>(null);
    tenantProfile = signal<{ adminTenant: boolean } | null>(null);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { user, isTenantLoaded$, isSuperAdmin: () => user()?.superAdmin === true },
        },
        { provide: TenantContextService, useValue: { currentTenantId, tenantProfile } },
        { provide: TenantService, useValue: { getProfile: () => of({ adminTenant: true }) } },
      ],
    });
  });

  /** Lo que pasa de verdad al recargar con F5 sobre `/admin`. */
  function coldRefresh(resolveWith: AppUserDto): void {
    // El usuario aún no ha llegado: `/users/me` sigue en vuelo.
    setTimeout(() => {
      user.set(resolveWith);
      currentTenantId.set('t1');
      isTenantLoaded$.next(true);
    });
  }

  it('no decide con el usuario todavía sin cargar (refresco en frío)', async () => {
    const guard = run();
    coldRefresh({
      id: 'u1',
      superAdmin: true,
      memberships: [],
    } as unknown as AppUserDto);

    await expectAsync(guard).toBeResolvedTo(true);
  });

  it('deja pasar al administrador de un centro administrador tras el refresco', async () => {
    const guard = run();
    coldRefresh({
      id: 'u1',
      memberships: [{ tenantId: 't1', permissions: ['MANAGE_TENANT'] }],
    } as unknown as AppUserDto);

    await expectAsync(guard).toBeResolvedTo(true);
  });

  it('manda a elegir centro al superadministrador que no tiene ninguno', async () => {
    const guard = run();
    setTimeout(() => {
      user.set({ id: 'u1', superAdmin: true, memberships: [] } as unknown as AppUserDto);
      isTenantLoaded$.next(true);
    });

    expect(urlOf(await guard)).toBe('/select-tenant');
  });

  it('sigue cerrando la puerta a quien no es administrador', async () => {
    const guard = run();
    setTimeout(() => {
      user.set({ id: 'u1', memberships: [{ tenantId: 't1', permissions: ['VIEW_USER'] }] } as unknown as AppUserDto);
      currentTenantId.set('t1');
      isTenantLoaded$.next(true);
    });

    expect(urlOf(await guard)).toBe('/not-authorized');
  });

  it('rechaza a un administrador cuyo centro no es administrador', async () => {
    TestBed.overrideProvider(TenantService, { useValue: { getProfile: () => of({ adminTenant: false }) } });
    const guard = run();
    coldRefresh({
      id: 'u1',
      memberships: [{ tenantId: 't1', permissions: ['MANAGE_TENANT'] }],
    } as unknown as AppUserDto);

    expect(urlOf(await guard)).toBe('/not-authorized');
  });
});
