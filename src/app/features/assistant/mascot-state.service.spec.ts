import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotFillService } from './mascot/fill/mascot-fill.service';
import { MascotMoodService } from './mascot/mascot-mood.service';
import { MascotStateService } from './mascot-state.service';

/**
 * Qué cara pone la mascota: el orden de `orbMode()` decide si una pausa, una
 * pregunta o un relleno se ven. Antes `sending()` iba primero y eclipsaba todo
 * lo demás durante un turno en streaming.
 */
describe('MascotStateService: el modo expresivo del orb', () => {
  let state: MascotStateService;
  let fill: MascotFillService;

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
    fill = TestBed.inject(MascotFillService);
    state.config.set({ enabled: true } as never);
  });

  it('una pausa gana al turno en marcha', () => {
    state.sending.set(true);
    state.cursor.paused.set(true);

    expect(state.orbMode()).toBe('paused');
  });

  it('una pregunta gana al turno en marcha', () => {
    state.sending.set(true);
    void state.questions.ask({ kind: 'ask', text: '¿Qué paciente?' });

    expect(state.orbMode()).toBe('confirm');

    state.questions.release();
  });

  it('una escritura pendiente también es confirmar', () => {
    state.sending.set(true);
    state.pendingAction.set({ id: 'a1', toolName: 'rename', summary: 'Renombrar', preview: [] } as never);

    expect(state.orbMode()).toBe('confirm');
  });

  it('mientras rellena, actúa aunque el turno siga en marcha', () => {
    state.sending.set(true);
    fill.filling.set(true);

    expect(state.orbMode()).toBe('acting');
  });

  it('con un archivo subiendo, lee', () => {
    state.uploading.set(true);

    expect(state.orbMode()).toBe('reading');
  });

  it('el armario manda sobre todo lo demás', () => {
    state.sending.set(true);
    state.wardrobeOpen.set(true);

    expect(state.orbMode()).toBe('wardrobe');
  });

  it('el estado transitorio del relleno se pinta y se apaga solo', fakeAsync(() => {
    state.open.set(true);
    fill.flashMode('done', 1400);

    expect(state.orbMode()).toBe('done');

    tick(1400);
    expect(fill.transientMode()).toBeNull();
    expect(state.orbMode()).toBe('listening');
  }));

  it('el remate del relleno gana al turno en marcha', () => {
    state.sending.set(true);
    fill.flashMode('done', 1400);

    expect(state.orbMode()).toBe('done');
  });

  it('cuando el remate se apaga, el turno vuelve a mandar', fakeAsync(() => {
    state.sending.set(true);
    fill.flashMode('confused', 1600);

    expect(state.orbMode()).toBe('confused');

    tick(1600);
    expect(state.orbMode()).toBe('thinking');
  }));

  it('al terminar un relleno con rechazos se queda confusa un momento', () => {
    fill.flashMode('confused', 1600);

    expect(state.orbMode()).toBe('confused');
  });

  it('con el panel abierto, tocarla responde igual', () => {
    const mood = TestBed.inject(MascotMoodService);
    state.open.set(true);

    state.toggle();

    expect(mood.mood()?.kind).toBe('highfive');
    expect(state.open()).toBeTrue();
  });
});
