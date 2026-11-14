import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ASSISTANT_WRITE_HEADER, assistantWriteInterceptor } from './assistant-write.interceptor';
import { ToolRunnerService } from './tool-runner.service';
import { WriteWatchService } from './write-watch.service';

describe('assistantWriteInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let runner: ToolRunnerService;
  let writes: WriteWatchService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([assistantWriteInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    runner = TestBed.inject(ToolRunnerService);
    writes = TestBed.inject(WriteWatchService);
  });

  afterEach(() => backend.verify());

  const running = (over: Partial<{ name: string; callId: string; sessionId: string }> = {}) =>
    runner.running.set({ name: 'action_measurement', callId: 'c1', sessionId: 's1', ...over });

  it('marca la escritura que sale de una herramienta', () => {
    running();
    http.post('/api/tenant/t1/measurements', {}).subscribe();
    const request = backend.expectOne('/api/tenant/t1/measurements');
    expect(request.request.headers.get(ASSISTANT_WRITE_HEADER)).toBe('s1');
    request.flush({});
  });

  it('lo que hace la persona por su cuenta NO se marca', () => {
    http.post('/api/tenant/t1/measurements', {}).subscribe();
    const request = backend.expectOne('/api/tenant/t1/measurements');
    expect(request.request.headers.has(ASSISTANT_WRITE_HEADER)).toBeFalse();
    request.flush({});
  });

  it('una lectura no se marca, aunque haya una herramienta en marcha', () => {
    running();
    http.get('/api/tenant/t1/measurements').subscribe();
    const request = backend.expectOne('/api/tenant/t1/measurements');
    expect(request.request.headers.has(ASSISTANT_WRITE_HEADER)).toBeFalse();
    request.flush({});
  });

  it('las del propio asistente no se marcan: serían ruido', () => {
    running();
    http.post('/api/tenant/t1/assistant/runs/r1/tool-results', {}).subscribe();
    const request = backend.expectOne((r) => r.url.includes('/assistant/'));
    expect(request.request.headers.has(ASSISTANT_WRITE_HEADER)).toBeFalse();
    request.flush({});
  });

  it('apunta cómo acabó, que es lo que necesita saber quien vigila la escritura', () => {
    running();
    http.post('/api/tenant/t1/measurements', {}).subscribe();
    backend.expectOne('/api/tenant/t1/measurements').flush({}, { status: 201, statusText: 'Created' });
    expect(writes.last()).toEqual({ ok: true, status: 201 });
  });

  it('una escritura rechazada se apunta como tal', () => {
    running();
    http.post('/api/tenant/t1/measurements', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/tenant/t1/measurements')
      .flush({ error: 'nope' }, { status: 409, statusText: 'Conflict' });
    expect(writes.last()).toEqual({ ok: false, status: 409 });
  });
});
