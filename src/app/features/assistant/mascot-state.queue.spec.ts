import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';

/**
 * La cola (F6.5): lo que se escribe mientras la mascota está ocupada no se
 * pierde. Antes el envío se ignoraba sin más y lo tecleado desaparecía.
 */
describe('la cola de la mascota', () => {
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
            currentTenantId: () => 't1',
            currentMembership: () => ({ tenantId: 't1', roleCode: 'NUTRITIONIST', userType: 'STAFF', permissions: [] }),
            permissions: () => new Set<string>(),
            hasPermission: () => true,
          },
        },
      ],
    });
    state = TestBed.inject(MascotStateService);
    http = TestBed.inject(HttpTestingController);
    state.config.set({ enabled: true } as never);
  });

  it('lo que se escribe mientras está ocupada se encola, en orden', () => {
    state.sending.set(true);
    state.send('primero');
    state.send('segundo');
    expect(state.queued()).toEqual(['primero', 'segundo']);
  });

  it('un envío vacío no ocupa sitio en la cola', () => {
    state.sending.set(true);
    state.send('   ');
    expect(state.queued()).toEqual([]);
  });

  it('se puede quitar lo que ya no se quiere mandar', () => {
    state.queued.set(['uno', 'dos', 'tres']);
    state.unqueue(1);
    expect(state.queued()).toEqual(['uno', 'tres']);
  });

  it('«Hacer ahora» corta lo que hay y manda ese', fakeAsync(() => {
    state.sending.set(true);
    state.queued.set(['lo urgente']);
    const stop = spyOn(state, 'stop').and.callFake(() => state.sending.set(false));
    const send = spyOn(state, 'send').and.callThrough();

    state.sendNow(0);
    tick();

    expect(stop).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('lo urgente');
    expect(state.queued()).toEqual([]);
    http.match(() => true).forEach((request) => request.flush({}, { status: 404, statusText: 'Not Found' }));
  }));

  it('con la mascota libre, enviar NO encola: va directo', () => {
    state.send('ahora mismo');
    expect(state.queued()).toEqual([]);
    expect(state.sending()).toBeTrue();
    http.match(() => true).forEach((request) => request.flush({}, { status: 404, statusText: 'Not Found' }));
  });
});
