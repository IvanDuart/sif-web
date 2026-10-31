import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';

/**
 * Qué pasa cuando el backend no deja abrir sesión con el paciente de la ficha
 * (`error.permission_denied`: no está asignado a quien mira). Antes el panel
 * se quedaba muerto; ahora se abre sin paciente y se dice por qué.
 */
describe('sesión de la mascota con un paciente que no es suyo', () => {
  const TENANT = 'tenant-1';
  const PACIENTE = 'paciente-ajeno';
  let state: MascotStateService;
  let http: HttpTestingController;

  const sessionsUrl = () => `/api/tenant/${TENANT}/assistant/sessions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            currentTenantId: () => TENANT,
            currentMembership: () => ({ tenantId: TENANT, roleCode: 'NUTRITIONIST', userType: 'STAFF', permissions: [] }),
            permissions: () => new Set<string>(),
          },
        },
      ],
    });
    state = TestBed.inject(MascotStateService);
    http = TestBed.inject(HttpTestingController);
    // La mascota está en la ficha de un paciente que no es suyo.
    spyOn(state as unknown as { currentSubjectUserId: () => string | null }, 'currentSubjectUserId')
      .and.returnValue(PACIENTE);
    // `visible` sale del rol y de que el centro la tenga activada.
    state.config.set({ enabled: true } as never);
  });

  afterEach(() => http.verify());

  /** El historial que la sesión pide al abrirse; aquí no se mira. */
  function drainHistory(): void {
    for (const open of http.match((r) => r.url.includes('/messages') && r.method === 'GET')) {
      open.flush({ items: [] });
    }
  }

  /** Deniega la primera sesión como lo hace el backend. */
  function denyFirstSession(): void {
    const first = http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(first.request.body.subjectUserId).toBe(PACIENTE);
    first.flush(
      { status: 403, title: 'Forbidden', detail: 'Permiso denegado', code: 'error.permission_denied' },
      { status: 403, statusText: 'Forbidden' },
    );
  }

  it('reabre la sesión sin paciente en vez de dejar el panel muerto', () => {
    state.openPanel();
    denyFirstSession();

    const retry = http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(retry.request.body.subjectUserId).toBeNull();
    retry.flush({ sessionId: 's1', consentRequired: false, greeting: '¿Te ayudo?', subjectUserId: null });

    drainHistory();
    expect(state.session()?.sessionId).toBe('s1');
    expect(state.messages().some((m) => m.role === 'SYSTEM')).toBeTrue();
  });

  it('no se pone a cerrar y abrir sesiones cada vez que se abre el panel', () => {
    state.openPanel();
    denyFirstSession();
    http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
    drainHistory();

    // La sesión no apunta a la ficha, pero es la única que el backend permite:
    // reabrir el panel NO debe tirarla ni pedir otra.
    state.closePanel();
    state.openPanel();

    http.expectNone((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    drainHistory();
    expect(state.session()?.sessionId).toBe('s1');
  });

  it('un 403 de otra clase (la IA apagada) no se reintenta', () => {
    state.openPanel();
    const first = http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    first.flush(
      { status: 403, title: 'Forbidden', detail: 'El asistente está desactivado', code: 'error.assistant_disabled' },
      { status: 403, statusText: 'Forbidden' },
    );

    http.expectNone((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(state.session()).toBeNull();
  });
});
