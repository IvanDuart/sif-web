import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { MascotMoodService } from '../mascot/mascot-mood.service';
import { MascotStateService } from '../mascot-state.service';
import { MascotLauncher, ORB, beside } from './mascot-launcher';

/** Un campo colocado a mano en la pantalla. */
function fieldAt(left: number, top: number, width = 200, height = 40): HTMLElement {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
  return element;
}

/** Dónde acaba la mascota en la pantalla, deshaciendo el desplazamiento desde su esquina. */
function landsAt(target: HTMLElement): { left: number; top: number } {
  const { x, y } = beside(target);
  return {
    left: window.innerWidth - 24 - ORB + x,
    top: window.innerHeight - 24 - ORB + y,
  };
}

describe('dónde se pone la mascota para atender un campo', () => {
  it('se pone a su izquierda, que es donde menos tapa', () => {
    const left = 400;
    expect(landsAt(fieldAt(left, 300)).left).toBe(left - 14 - ORB);
  });

  it('se pasa a su derecha cuando contra el borde no cabe', () => {
    const target = fieldAt(10, 300);
    expect(landsAt(target).left).toBe(10 + 200 + 14);
  });

  it('se centra con el campo a lo alto', () => {
    const top = 300;
    const height = 40;
    expect(landsAt(fieldAt(400, top, 200, height)).top).toBe(top + height / 2 - ORB / 2);
  });

  it('no se sale de la pantalla por un campo que asoma por arriba', () => {
    expect(landsAt(fieldAt(400, -30)).top).toBeGreaterThanOrEqual(8);
  });

  it('no se sale de la pantalla por un campo que asoma por abajo', () => {
    const landed = landsAt(fieldAt(400, window.innerHeight + 50));
    expect(landed.top).toBeLessThanOrEqual(window.innerHeight - ORB - 8);
  });
});

/**
 * Lo que la nota ofrece tiene que poder pulsarse: hasta ahora una nota era
 * texto y una aspa, así que toda la proactividad del plan (tips, oferta de
 * ayuda, celebraciones) no tenía dónde ponerse.
 */
describe('las acciones de la nota', () => {
  const TENANT = 'tenant-1';
  let fixture: ComponentFixture<MascotLauncher>;
  let mood: MascotMoodService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MascotLauncher,
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
            currentMembership: () => ({
              tenantId: TENANT,
              roleCode: 'NUTRITIONIST',
              userType: 'STAFF',
              permissions: [],
            }),
            permissions: () => new Set<string>(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MascotLauncher);
    mood = TestBed.inject(MascotMoodService);
    // La mascota se pinta cuando el centro la tiene activada.
    TestBed.inject(MascotStateService).config.set({ enabled: true } as never);
  });

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const buttons = (): HTMLButtonElement[] =>
    Array.from(host().querySelectorAll<HTMLButtonElement>('.mascot-note__actions button'));

  it('no pinta botones en una nota que no ofrece nada', () => {
    mood.say({ text: 'Listo' });
    fixture.detectChanges();

    expect(host().querySelector('.mascot-note')).not.toBeNull();
    expect(buttons().length).toBe(0);
  });

  it('pinta un botón por acción, con su texto', () => {
    mood.say({
      text: '¿Lo hago por ti?',
      actions: [
        { label: 'Pruébalo', primary: true, run: () => undefined },
        { label: 'Ahora no', run: () => undefined },
      ],
    });
    fixture.detectChanges();

    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Pruébalo', 'Ahora no']);
  });

  it('pulsar una acción la ejecuta y retira la nota', () => {
    let done = 0;
    mood.say({ text: '¿Lo hago por ti?', actions: [{ label: 'Pruébalo', run: () => (done += 1) }] });
    fixture.detectChanges();

    buttons()[0].click();
    fixture.detectChanges();

    expect(done).toBe(1);
    expect(host().querySelector('.mascot-note')).toBeNull();
  });

  it('el tono se ve en la nota', () => {
    mood.say({ text: 'Algo falló', tone: 'danger' });
    fixture.detectChanges();

    expect(host().querySelector('.mascot-note')?.getAttribute('data-tone')).toBe('danger');
  });
});
