import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';
import { noHungRun } from './mascot-state.testing';

/**
 * `confirm_action` (`assistant-contract` §3.2): la escritura que propone el
 * backend se pregunta dentro del turno. Si el navegador no contesta, el
 * backend lo toma por un «no» y rechaza la acción: por eso **tiene** que haber
 * quien conteste.
 */
describe('confirm_action de la mascota', () => {
  const TENANT = 'tenant-1';
  const BASE = `/api/tenant/${TENANT}/assistant`;
  let state: MascotStateService;
  let http: HttpTestingController;

  const CARD =
    'event: client_tool\ndata: ' +
    JSON.stringify({
      runId: 'r1',
      callId: 'c1',
      name: 'confirm_action',
      args: {
        actionId: 'a1',
        toolName: 'create_measurement',
        summary: 'Registrar 70 kg',
        question: '¿Quieres que lo registre?',
        idempotencyKey: 'key-1',
        expiresAt: '2026-11-07T12:15:00Z',
        preview: [{ label: 'Peso', value: '70 kg' }],
      },
    }) +
    '\n\n';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } }),
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
    spyOn(state as unknown as { currentSubjectUserId: () => string | null }, 'currentSubjectUserId').and.returnValue(null);
    state.config.set({ enabled: true } as never);
  });

  /**
   * Los efectos del servicio piden config, mascotas, look, preferencias e hitos
   * al montarse; aquí no se miran. Se vacían en cadena porque cada respuesta
   * puede abrir otra petición.
   */
  function ignoreSideRequests(): void {
    const side = (r: { method: string; url: string }) =>
      r.method === 'GET' && /\/(config|pets|look|preferences|milestones)$/.test(r.url);
    for (let round = 0; round < 5; round += 1) {
      const pending = http.match(side);
      if (pending.length === 0) return;
      for (const request of pending) request.flush(request.request.url.endsWith('/config') ? { enabled: true } : []);
    }
  }

  afterEach(() => {
    ignoreSideRequests();
    http.verify();
  });

  function startTurn(): TestRequest {
    state.send('Apunta 70 kg');
    http.expectOne((r) => r.url.endsWith(`${BASE}/sessions`) && r.method === 'POST')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
    noHungRun(http);
    return http.expectOne((r) => r.url.endsWith('/messages/stream'));
  }

  function streamed(stream: TestRequest, text: string): void {
    stream.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text } as never);
  }

  /** Lleva el turno hasta tener la tarjeta en pantalla. */
  function withCard(): TestRequest {
    const stream = startTurn();
    streamed(stream, CARD);
    flushMicrotasks();
    TestBed.tick();
    ignoreSideRequests();
    return stream;
  }

  it('la propuesta sale en la tarjeta de siempre, sin tocar el backend', fakeAsync(() => {
    withCard();

    expect(state.pendingAction()?.id).toBe('a1');
    expect(state.pendingAction()?.summary).toBe('Registrar 70 kg');
    expect(state.pendingAction()?.preview).toEqual([{ field: 'Peso', label: 'Peso', value: '70 kg' }]);
    http.expectNone((r) => r.url.includes('/runs/r1/tool-results'));
  }));

  it('confirmar contesta {confirmed:true} por el turno y no llama a /confirm', fakeAsync(() => {
    const stream = withCard();

    state.confirmAction(state.pendingAction()!);
    flushMicrotasks();

    const result = http.expectOne((r) => r.url.endsWith(`${BASE}/runs/r1/tool-results`));
    expect(result.request.body).toEqual({ callId: 'c1', result: { ok: true, confirmed: true } });
    result.flush(null, { status: 202, statusText: 'Accepted' });
    http.expectNone((r) => r.url.includes('/pending-actions/'));
    expect(state.pendingAction()).toBeNull();
    expect(state.sending()).toBeTrue();
    stream.flush('');
    ignoreSideRequests();
  }));

  it('cancelar contesta {confirmed:false} y el turno sigue', fakeAsync(() => {
    const stream = withCard();

    state.rejectAction(state.pendingAction()!);
    flushMicrotasks();

    const result = http.expectOne((r) => r.url.endsWith('/runs/r1/tool-results'));
    expect(result.request.body.result).toEqual({ ok: true, confirmed: false });
    result.flush(null, { status: 202, statusText: 'Accepted' });
    http.expectNone((r) => r.url.includes('/pending-actions/'));
    expect(state.sending()).toBeTrue();
    stream.flush('');
  }));

  it('si el turno sigue hablando, la tarjeta pasa a resolverse por REST', fakeAsync(() => {
    const stream = withCard();

    // Se confirmó desde otra pestaña: el backend despierta el turno.
    streamed(stream, CARD + 'event: delta\ndata: {"text":"Hecho"}\n\n');
    flushMicrotasks();
    // El resultado de «ya contestado» por la tarjeta llega como superseded.
    http.expectOne((r) => r.url.endsWith('/runs/r1/tool-results'))
      .flush(null, { status: 204, statusText: 'No Content' });
    flushMicrotasks();

    state.confirmAction(state.pendingAction()!);
    const rest = http.expectOne((r) => r.url.includes('/pending-actions/a1/confirm'));
    expect(rest.request.method).toBe('POST');
    rest.flush({ status: 'APPLIED', message: 'Hecho', uiActions: [] });
    stream.flush('');
  }));

  it('detener con una tarjeta esperando la rechaza en el servidor', fakeAsync(() => {
    const stream = withCard();

    state.stop();
    flushMicrotasks();

    http.expectOne((r) => r.url.includes('/pending-actions/a1/reject')).flush(null);
    http.expectOne((r) => r.url.endsWith(`${BASE}/runs/r1`) && r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(state.pendingAction()).toBeNull();
    expect(stream.cancelled).toBeTrue();
    tick();
  }));
});
