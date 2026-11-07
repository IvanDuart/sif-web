import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ECHO_DEBUG_KEY } from './copilot/tools/echo.run';
import { MascotStateService } from './mascot-state.service';
import { noHungRun } from './mascot-state.testing';

/**
 * Herramientas de cliente (`assistant-contract` §3.2): el backend suspende el
 * turno con un `client_tool`, el navegador la ejecuta y devuelve el resultado
 * por `POST /runs/{runId}/tool-results`, y el turno sigue por el mismo SSE.
 */
describe('herramientas de cliente de la mascota', () => {
  const TENANT = 'tenant-1';
  const BASE = `/api/tenant/${TENANT}/assistant`;
  let state: MascotStateService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem(ECHO_DEBUG_KEY, '1');
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

  afterEach(() => {
    localStorage.removeItem(ECHO_DEBUG_KEY);
    http.verify();
  });

  function openSession(): void {
    http.expectOne((r) => r.url.endsWith(`${BASE}/sessions`) && r.method === 'POST')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
    noHungRun(http);
  }

  /** Simula lo que el SSE lleva acumulado hasta ahora. */
  function streamed(stream: TestRequest, text: string): void {
    stream.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text } as never);
  }

  const ECHO_CALL = 'event: client_tool\ndata: {"runId":"r1","callId":"c1","name":"echo","args":{"text":"hola"}}\n\n';

  it('declara su catálogo en el cuerpo del stream', () => {
    state.send('Llama a echo');
    openSession();

    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));
    expect(stream.request.body.content).toBe('Llama a echo');
    expect(stream.request.body.clientTools.map((tool: { name: string }) => tool.name)).toContain('echo');
    stream.flush('');
  });

  it('ejecuta la herramienta, devuelve el resultado y sigue el mismo turno', fakeAsync(() => {
    state.send('Llama a echo');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));

    streamed(stream, ECHO_CALL);
    flushMicrotasks();

    const result = http.expectOne((r) => r.url.endsWith(`${BASE}/runs/r1/tool-results`) && r.method === 'POST');
    expect(result.request.body).toEqual({ callId: 'c1', result: { ok: true, echo: 'hola' } });
    result.flush(null, { status: 202, statusText: 'Accepted' });
    flushMicrotasks();

    expect(state.sending()).toBeTrue();
    expect(state.activeRunId()).toBe('r1');
    expect(state.clientSteps()).toBe(1);

    streamed(stream, ECHO_CALL + 'event: delta\ndata: {"text":"Devolvió hola"}\n\n');
    expect(state.messages().some((m) => m.content === 'Devolvió hola')).toBeTrue();
    stream.flush('');
  }));

  it('contesta unknown_tool a una herramienta que no conoce', fakeAsync(() => {
    state.send('Hola');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));

    streamed(stream, 'event: client_tool\ndata: {"runId":"r1","callId":"c1","name":"fill_nada","args":{}}\n\n');
    flushMicrotasks();

    const result = http.expectOne((r) => r.url.endsWith('/runs/r1/tool-results'));
    expect(result.request.body.result).toEqual({ ok: false, reason: 'unknown_tool' });
    result.flush(null, { status: 202, statusText: 'Accepted' });
    flushMicrotasks();
    stream.flush('');
  }));

  it('si el backend ya no tiene el turno (404), lo da por terminado', fakeAsync(() => {
    state.send('Llama a echo');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));

    streamed(stream, ECHO_CALL);
    flushMicrotasks();
    http.expectOne((r) => r.url.endsWith('/runs/r1/tool-results'))
      .flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
    flushMicrotasks();

    expect(state.sending()).toBeFalse();
    expect(state.activeRunId()).toBeNull();
    expect(stream.cancelled).toBeTrue();
  }));

  it('al detener con el run conocido, se lo dice al backend', fakeAsync(() => {
    state.send('Llama a echo');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));
    streamed(stream, 'event: delta\ndata: {"text":"Voy"}\n\n' + ECHO_CALL);
    flushMicrotasks();
    http.expectOne((r) => r.url.endsWith('/runs/r1/tool-results')).flush(null, { status: 202, statusText: 'Accepted' });
    flushMicrotasks();

    state.stop();

    http.expectOne((r) => r.url.endsWith(`${BASE}/runs/r1`) && r.method === 'DELETE').flush(null, { status: 204, statusText: 'No Content' });
    expect(stream.cancelled).toBeTrue();
    expect(state.sending()).toBeFalse();
    expect(state.messages().find((m) => m.content === 'Voy')?.stopped).toBeTrue();
  }));

  it('el evento stopped cierra el turno sin error', () => {
    state.send('Hola');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));

    streamed(stream, 'event: delta\ndata: {"text":"Empiezo"}\n\nevent: stopped\ndata: {"runId":"r1"}\n\n');

    expect(state.sending()).toBeFalse();
    expect(state.messages().find((m) => m.content === 'Empiezo')?.stopped).toBeTrue();
    expect(state.messages().some((m) => m.role === 'SYSTEM')).toBeFalse();
  });

  it('suelta un turno colgado antes de mandar el primer mensaje', () => {
    state.send('Sigue');
    http.expectOne((r) => r.url.endsWith(`${BASE}/sessions`) && r.method === 'POST')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
    http.expectOne((r) => r.url.endsWith(`${BASE}/sessions/latest`))
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null, pendingRunId: 'viejo' });

    http.expectNone((r) => r.url.endsWith('/messages/stream'));
    http.expectOne((r) => r.url.endsWith(`${BASE}/runs/viejo`) && r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });

    http.expectOne((r) => r.url.endsWith('/messages/stream')).flush('');
  });

  it('un turno que se cae tras una herramienta no se reenvía por el bloqueante', fakeAsync(() => {
    state.send('Llama a echo');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));
    streamed(stream, ECHO_CALL);
    flushMicrotasks();
    http.expectOne((r) => r.url.endsWith('/runs/r1/tool-results')).flush(null, { status: 202, statusText: 'Accepted' });
    flushMicrotasks();

    stream.error(new ProgressEvent('error'));

    http.expectNone((r) => r.url.endsWith('/messages') && r.method === 'POST');
    expect(state.sending()).toBeFalse();
  }));
});
