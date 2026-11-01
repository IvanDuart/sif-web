import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';

/**
 * Qué pasa con la conversación al cambiar de ficha de paciente.
 *
 * Antes: se cerraba la sesión anterior con un `DELETE` y se abría otra. Eso
 * borraba su historial —y, desde que existen, sus adjuntos— a cambio de nada:
 * las sesiones del backend van por `(tenant, usuario, paciente)`, no hay límite
 * de abiertas, y pedir la de otro paciente no toca la anterior. Así que volver
 * a la ficha de antes devuelve la misma conversación donde se dejó.
 */
describe('cambiar de ficha no tira la conversación anterior', () => {
  const TENANT = 'tenant-1';
  const MARGE = 'paciente-marge';
  const FRINK = 'paciente-frink';

  let state: MascotStateService;
  let http: HttpTestingController;
  let ficha: string | null;

  const sessionsUrl = () => `/api/tenant/${TENANT}/assistant/sessions`;

  beforeEach(() => {
    ficha = MARGE;
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
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
    // La ficha que hay abierta en pantalla, que cambia durante la prueba.
    spyOn(state as unknown as { currentSubjectUserId: () => string | null }, 'currentSubjectUserId')
      .and.callFake(() => ficha);
    state.config.set({ enabled: true } as never);
  });

  /** El historial que la sesión pide al abrirse; aquí no se mira. */
  function drainHistory(): void {
    for (const open of http.match((r) => r.url.includes('/messages') && r.method === 'GET')) {
      open.flush({ items: [] });
    }
  }

  /** Abre el panel y deja montada la sesión de esa ficha. */
  function openFor(sessionId: string, subjectUserId: string | null): void {
    state.openPanel();
    const created = http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(created.request.body.subjectUserId).toBe(subjectUserId);
    created.flush({ sessionId, consentRequired: false, greeting: '', subjectUserId });
    drainHistory();
  }

  const closings = () =>
    http.match((r) => r.method === 'DELETE' && r.url.includes('/assistant/sessions/'));

  it('no cierra la sesión del paciente que dejas atrás', () => {
    openFor('sesion-marge', MARGE);

    // El nutricionista abre la ficha de Frink y vuelve a abrir el panel.
    state.closePanel();
    ficha = FRINK;
    state.openPanel();

    expect(closings().length).toBe(0);

    const created = http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(created.request.body.subjectUserId).toBe(FRINK);
    created.flush({ sessionId: 'sesion-frink', consentRequired: false, greeting: '', subjectUserId: FRINK });
    drainHistory();

    expect(state.session()?.sessionId).toBe('sesion-frink');
  });

  it('al volver pide la de antes, que el backend devuelve con su historial', () => {
    openFor('sesion-marge', MARGE);
    state.closePanel();
    ficha = FRINK;
    openFor('sesion-frink', FRINK);

    state.closePanel();
    ficha = MARGE;
    state.openPanel();

    expect(closings().length).toBe(0);
    const again = http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(again.request.body.subjectUserId).toBe(MARGE);
    // El backend devuelve la misma de antes, no una nueva.
    again.flush({ sessionId: 'sesion-marge', consentRequired: false, greeting: '', subjectUserId: MARGE });
    drainHistory();

    expect(state.session()?.sessionId).toBe('sesion-marge');
  });

  it('con la misma ficha abierta no pide otra sesión', () => {
    openFor('sesion-marge', MARGE);

    state.closePanel();
    state.openPanel();

    http.expectNone((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(closings().length).toBe(0);
    drainHistory();
  });

  /**
   * El paciente activo es estado del backend: la mascota lo mueve ella con
   * `set_active_patient` cuando alguien nombra a otro sin abrir su ficha. Si
   * aquí se comparara contra el paciente que la sesión tenía al crearse, el
   * frontend estaría comparando contra lo que creía hace diez minutos.
   */
  it('cuenta el paciente que la mascota movió, no el de la creación', () => {
    // Sesión abierta desde la agenda, sin ficha delante.
    ficha = null;
    openFor('sesion-suelta', null);

    // "Las medidas de Frink": la mascota mueve el paciente activo de la sesión.
    (state as unknown as { activePatientId: { set(value: string): void } }).activePatientId.set(FRINK);

    // Y ahora se abre la ficha de Marge: la sesión ya no es la de esta ficha.
    state.closePanel();
    ficha = MARGE;
    state.openPanel();

    expect(closings().length).toBe(0);
    const created = http.expectOne((r) => r.url.endsWith(sessionsUrl()) && r.method === 'POST');
    expect(created.request.body.subjectUserId).toBe(MARGE);
    created.flush({ sessionId: 'sesion-marge', consentRequired: false, greeting: '', subjectUserId: MARGE });
    drainHistory();
  });
});
