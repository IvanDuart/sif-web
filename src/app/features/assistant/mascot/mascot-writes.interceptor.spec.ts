import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MascotMilestonesService } from './mascot-milestones.service';
import { MascotTipsService } from './mascot-tips.service';
import { mascotWritesInterceptor } from './mascot-writes.interceptor';

/**
 * Quién le dice a la mascota que mire si hay algo que celebrar. Lo importante
 * de este interceptor es lo que **no** hace: no cuenta las lecturas, no cuenta
 * lo que falló, y no cuenta sus propias escrituras —marcar un hito como
 * celebrado provocaría otra lectura, y otra celebración, y así—.
 */
describe('el aviso de que algo se ha guardado', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let milestones: jasmine.SpyObj<MascotMilestonesService>;
  let tips: jasmine.SpyObj<MascotTipsService>;

  beforeEach(() => {
    milestones = jasmine.createSpyObj<MascotMilestonesService>('MascotMilestonesService', [
      'scheduleRefresh',
    ]);
    tips = jasmine.createSpyObj<MascotTipsService>('MascotTipsService', ['noticeWrite']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mascotWritesInterceptor])),
        provideHttpClientTesting(),
        { provide: MascotMilestonesService, useValue: milestones },
        { provide: MascotTipsService, useValue: tips },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Lanza la petición y la contesta bien o mal. */
  function run(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, ok = true): void {
    const calls = {
      GET: () => http.get(url),
      POST: () => http.post(url, {}),
      PUT: () => http.put(url, {}),
      DELETE: () => http.delete(url),
    };
    calls[method]().subscribe({ next: () => undefined, error: () => undefined });
    const open = backend.expectOne(url);
    if (ok) open.flush({});
    else open.flush('', { status: 500, statusText: 'Server Error' });
  }

  it('avisa cuando se guarda algo', () => {
    run('POST', '/api/tenant/t1/appointments');

    expect(milestones.scheduleRefresh).toHaveBeenCalledTimes(1);
    // A los tips les dice además qué y dónde: a ellos sí les importa.
    expect(tips.noticeWrite).toHaveBeenCalledWith('POST', '/api/tenant/t1/appointments');
  });

  it('avisa también al borrar', () => {
    run('DELETE', '/api/tenant/t1/menus/m1');

    expect(milestones.scheduleRefresh).toHaveBeenCalledTimes(1);
  });

  it('no avisa por leer', () => {
    run('GET', '/api/tenant/t1/appointments');

    expect(milestones.scheduleRefresh).not.toHaveBeenCalled();
  });

  it('no avisa si el guardado falló', () => {
    run('POST', '/api/tenant/t1/appointments', false);

    expect(milestones.scheduleRefresh).not.toHaveBeenCalled();
    expect(tips.noticeWrite).not.toHaveBeenCalled();
  });

  it('no cuenta lo que escribe la propia mascota', () => {
    run('POST', '/api/tenant/t1/assistant/milestones/first_menu/celebrated');
    run('PUT', '/api/tenant/t1/assistant/preferences');

    expect(milestones.scheduleRefresh).not.toHaveBeenCalled();
    expect(tips.noticeWrite).not.toHaveBeenCalled();
  });
});
