import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';
import { noHungRun } from './mascot-state.testing';

/**
 * Detener la respuesta: se corta el stream, lo que llegó se queda marcado y
 * nada de ese turno se aplica después.
 */
describe('detener la respuesta de la mascota', () => {
  const TENANT = 'tenant-1';
  let state: MascotStateService;
  let http: HttpTestingController;

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
          },
        },
      ],
    });
    state = TestBed.inject(MascotStateService);
    http = TestBed.inject(HttpTestingController);
    spyOn(state as unknown as { currentSubjectUserId: () => string | null }, 'currentSubjectUserId')
      .and.returnValue(null);
    state.config.set({ enabled: true } as never);
  });

  afterEach(() => http.verify());

  function openSession(): void {
    http.expectOne((r) => r.url.endsWith(`/api/tenant/${TENANT}/assistant/sessions`) && r.method === 'POST')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
    noHungRun(http);
  }

  it('deja el texto parcial marcado como detenido y cancela la petición', () => {
    state.send('Hola');
    openSession();
    const stream = http.expectOne((r) => r.url.includes('/messages/stream'));
    stream.event({
      type: HttpEventType.DownloadProgress,
      loaded: 1,
      partialText: 'event:delta\ndata:{"text":"Buenas, "}\n\n',
    } as never);

    const painted = state.messages().find((m) => m.role === 'ASSISTANT');
    expect(painted?.content).toBe('Buenas, ');

    state.stop();

    expect(stream.cancelled).toBeTrue();
    expect(state.sending()).toBeFalse();
    const last = state.messages()[state.messages().length - 1];
    expect(last.content).toBe('Buenas, ');
    expect(last.stopped).toBeTrue();
  });

  it('antes de abrir sesión, el envío ya no sale', () => {
    state.send('Hola');
    state.stop();
    openSession();

    http.expectNone((r) => r.url.includes('/messages'));
    expect(state.sending()).toBeFalse();
  });
});
