import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';
import { noHungRun } from './mascot-state.testing';

/**
 * De quién habla el backend (`assistant-contract` §3 y §4).
 *
 * Antes se deducía del `params.patientId` de los `uiActions` de navegación. La
 * fase B4 los retiró, así que ahora viene en `subjectUserId` del turno. Si esto
 * se rompe, la mascota no se entera de que el modelo ha cambiado de paciente y
 * sigue trabajando sobre la ficha equivocada: nadie vería el fallo hasta que
 * alguien guarde una medición en quien no es.
 */
describe('el paciente activo del turno', () => {
  const TENANT = 'tenant-1';
  let state: MascotStateService;
  let http: HttpTestingController;

  const activo = () =>
    (state as unknown as { activePatientId: () => string | null }).activePatientId();

  beforeEach(() => {
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
            hasPermission: () => true,
          },
        },
      ],
    });
    state = TestBed.inject(MascotStateService);
    http = TestBed.inject(HttpTestingController);
    state.config.set({ enabled: true } as never);
    abierta = false;
  });

  afterEach(() => http.verify());

  /**
   * Un turno entero, con lo que traiga el `done`. La sesión se abre sólo la
   * primera vez: después se reutiliza, como en la aplicación.
   */
  let abierta = false;
  function turno(extra: Record<string, unknown>): TestRequest {
    state.send('hola');
    if (!abierta) {
      http.expectOne((r) => r.url.endsWith('/sessions') && r.method === 'POST')
        .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
      noHungRun(http);
      abierta = true;
    }

    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));
    const done = {
      assistantMessage: { id: 'm1', role: 'ASSISTANT', content: 'Hecho', createdAt: new Date().toISOString() },
      pendingAction: null,
      uiActions: [],
      ...extra,
    };
    const text = `event: done\ndata: ${JSON.stringify(done)}\n\n`;
    stream.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text } as never);
    stream.flush('');
    return stream;
  }

  it('se toma del `subjectUserId` del turno', fakeAsync(() => {
    turno({ subjectUserId: 'homer-uuid' });
    flushMicrotasks();
    expect(activo()).toBe('homer-uuid');
  }));

  it('un `null` es «ninguno», y se obedece', fakeAsync(() => {
    turno({ subjectUserId: 'homer-uuid' });
    flushMicrotasks();
    turno({ subjectUserId: null });
    flushMicrotasks();
    expect(activo()).toBeNull();
  }));

  it('si no viene, no se toca: un backend viejo no debe borrar lo que había', fakeAsync(() => {
    turno({ subjectUserId: 'homer-uuid' });
    flushMicrotasks();
    turno({});
    flushMicrotasks();
    expect(activo()).toBe('homer-uuid');
  }));

  it('ya NO se deduce de los uiActions: la B4 los retiró', fakeAsync(() => {
    turno({
      uiActions: [{ type: 'NAVIGATE', screen: 'PATIENT_PROFILE', params: { patientId: 'otro-uuid' } }],
    });
    flushMicrotasks();
    expect(activo()).toBeNull();
  }));
});
