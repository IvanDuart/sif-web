import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';

/**
 * El error de un turno en streaming. El backend manda su código dentro del
 * evento SSE, no en una respuesta HTTP, y ese camino pintaba el `error` crudo:
 * "Permiso denegado" a secas, que no dice qué pasa. Ahora el código manda, y
 * el 403 del asistente dice lo mismo que al abrir sesión sobre un paciente de
 * otro: esa ficha no está asignada a quien pregunta.
 */
describe('error de un turno de la mascota', () => {
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

  /** Abre sesión y deja el turno enviado, a la espera del stream. */
  function sendMessage(text: string): void {
    state.send(text);
    http.expectOne((r) => r.url.endsWith(`/api/tenant/${TENANT}/assistant/sessions`) && r.method === 'POST')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
  }

  /** Responde el stream con un único marco de error, como el backend. */
  function failStream(payload: Record<string, unknown>): void {
    const stream = http.expectOne((r) => r.url.includes('/messages/stream') && r.method === 'POST');
    stream.flush(`event:error\ndata:${JSON.stringify(payload)}\n\n`);
  }

  function lastSystemMessage(): string {
    const system = state.messages().filter((m) => m.role === 'SYSTEM');
    return system.length ? system[system.length - 1].content : '';
  }

  it('traduce el 403 en vez de pintar el "Permiso denegado" del backend', () => {
    sendMessage('Quiero agendar a Frank Grimes el día 5 a las 10');
    failStream({ code: 'error.permission_denied', error: 'Permiso denegado' });

    expect(lastSystemMessage()).toBe('assistant.subject_not_allowed');
    expect(state.sending()).toBeFalse();
  });

  it('sin código conocido se queda con el texto del backend', () => {
    sendMessage('Hola');
    failStream({ code: 'error.assistant_unavailable', error: 'El asistente no está disponible ahora mismo' });

    expect(lastSystemMessage()).toBe('El asistente no está disponible ahora mismo');
  });

  it('sin código ni texto, el error genérico', () => {
    sendMessage('Hola');
    failStream({ code: null, error: '  ' });

    expect(lastSystemMessage()).toBe('errors.unexpected');
  });
});
