import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import type { FieldAccess, FillSurface } from './mascot/fill/descriptor';
import { MascotFillService } from './mascot/fill/mascot-fill.service';
import { MascotStateService } from './mascot-state.service';
import { noHungRun } from './mascot-state.testing';

/**
 * Las herramientas que salen de la pantalla (`fill_`, `open_`, `edit_`) de
 * punta a punta: se declaran en el turno, el backend llama a una y el
 * formulario de verdad se rellena.
 */
describe('herramientas de pantalla de la mascota', () => {
  const TENANT = 'tenant-1';
  const BASE = `/api/tenant/${TENANT}/assistant`;
  let state: MascotStateService;
  let fill: MascotFillService;
  let http: HttpTestingController;
  let host: HTMLElement;
  let values: Record<string, unknown>;

  const FILL_FRAME =
    'event: client_tool\ndata: {"runId":"r1","callId":"c1","name":"fill_menu_rename","args":{"name":"Semana 1"}}\n\n';

  const SURFACE: FillSurface = {
    id: 'menu-rename',
    tools: ['rename_menu'],
    fields: [{ key: 'name', kind: 'text', from: ['name'] }],
  };

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
    fill = TestBed.inject(MascotFillService);
    http = TestBed.inject(HttpTestingController);
    spyOn(state as unknown as { currentSubjectUserId: () => string | null }, 'currentSubjectUserId')
      .and.returnValue(null);
    state.config.set({ enabled: true } as never);

    host = document.createElement('div');
    host.innerHTML = '<input formcontrolname="name" />';
    document.body.appendChild(host);
    values = {};
    const access: FieldAccess = {
      get: (key) => values[key],
      set: (key, value) => {
        values[key] = value;
      },
    };
    TestBed.runInInjectionContext(() => fill.register(SURFACE, access));
  });

  afterEach(() => {
    host.remove();
    http.verify();
  });

  function openSession(): void {
    http.expectOne((r) => r.url.endsWith(`${BASE}/sessions`) && r.method === 'POST')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null });
    noHungRun(http);
  }

  /** El SSE llega acumulado: cada progreso trae TODO el texto recibido hasta ahí. */
  function streamed(stream: TestRequest, frames: string[]): void {
    const text = frames.join('');
    stream.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text } as never);
  }

  it('el formulario montado viaja en el catálogo del turno', () => {
    state.send('Llámalo Semana 1');
    openSession();

    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));
    const names = stream.request.body.clientTools.map((tool: { name: string }) => tool.name);
    expect(names).toContain('fill_menu_rename');
    // `navigate` se ofrece siempre: es de la aplicación, no de la pantalla.
    expect(names).toContain('navigate');
    stream.flush('');
  });

  it('un `fill_` escribe en el formulario de verdad y cuenta qué escribió', fakeAsync(() => {
    state.send('Llámalo Semana 1');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));

    streamed(stream, [FILL_FRAME]);
    flushMicrotasks();
    tick(3000);

    const result = http.expectOne((r) => r.url.endsWith(`${BASE}/runs/r1/tool-results`) && r.method === 'POST');
    expect(result.request.body.result.ok).toBeTrue();
    expect(result.request.body.result.written).toEqual(['name']);
    expect(values['name']).toBe('Semana 1');
    result.flush({}, { status: 202, statusText: 'Accepted' });

    stream.flush('');
    flushMicrotasks();
  }));

  it('lo que ya rellenó una herramienta no se rellena otra vez con la propuesta del backend', fakeAsync(() => {
    state.send('Llámalo Semana 1');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));

    streamed(stream, [FILL_FRAME]);
    flushMicrotasks();
    tick(3000);
    http.expectOne((r) => r.url.endsWith(`${BASE}/runs/r1/tool-results`))
      .flush({}, { status: 202, statusText: 'Accepted' });

    // La persona corrige lo que escribió la mascota ANTES de que llegue el `done`.
    values['name'] = 'Semana uno';

    const done = {
      assistantMessage: { id: 'm1', role: 'ASSISTANT', content: 'Hecho', createdAt: new Date().toISOString() },
      pendingAction: { id: 'a1', toolName: 'rename_menu', summary: 'Renombrar', preview: [{ field: 'name', value: 'Semana 1' }] },
    };
    streamed(stream, [FILL_FRAME, `event: done\ndata: ${JSON.stringify(done)}\n\n`]);
    stream.flush('');
    flushMicrotasks();
    tick(3000);

    // Se ofrece la tarjeta, y lo que la persona corrigió sigue en pie.
    expect(state.pendingAction()?.id).toBe('a1');
    expect(values['name']).toBe('Semana uno');
  }));

  it('una herramienta que esta pantalla no tiene se contesta, no se queda colgada', fakeAsync(() => {
    state.send('Rellena la medición');
    openSession();
    const stream = http.expectOne((r) => r.url.endsWith('/messages/stream'));

    streamed(stream, ['event: client_tool\ndata: {"runId":"r1","callId":"c1","name":"fill_measurement","args":{"weightKg":70}}\n\n']);
    flushMicrotasks();

    const result = http.expectOne((r) => r.url.endsWith(`${BASE}/runs/r1/tool-results`) && r.method === 'POST');
    expect(result.request.body.result).toEqual({ ok: false, reason: 'unknown_tool' });
    result.flush({}, { status: 202, statusText: 'Accepted' });

    stream.flush('');
    flushMicrotasks();
  }));
});
