import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
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

/**
 * Dónde acaba la mascota en la pantalla, deshaciendo el desplazamiento desde
 * su esquina.
 *
 * `clientWidth` y no `innerWidth`: éste cuenta la barra de desplazamiento, y
 * un `position: fixed` con `right` no la cuenta.
 */
function landsAt(target: HTMLElement): { left: number; top: number } {
  const { x, y } = beside(target);
  return {
    left: document.documentElement.clientWidth - 24 - ORB + x,
    top: document.documentElement.clientHeight - 24 - ORB + y,
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
          langs: { es: { assistant: { attachment_drop: 'Suéltalo aquí' } } },
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
            hasPermission: () => true,
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

  it('cada pulsación pinta el anillo sobre la mascota', () => {
    const fill = TestBed.inject(MascotFillService);

    fill.presses.set(1);
    fixture.detectChanges();
    expect(host().querySelector('.mascot-press-ring')).not.toBeNull();

    // El contador es la clave: una segunda pulsación vuelve a montar el anillo.
    fill.presses.set(2);
    fixture.detectChanges();
    expect(host().querySelectorAll('.mascot-press-ring').length).toBe(1);
  });

  it('arrastrar un archivo la asoma, pero sólo se agranda encima del botón', () => {
    fixture.detectChanges();
    const fab = host().querySelector<HTMLElement>('.mascot-fab')!;
    const transform = fab.style.transform;
    const dataTransfer = { types: ['Files'], files: [] };
    const dragEvent = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
      return event;
    };

    document.dispatchEvent(dragEvent('dragenter'));
    fixture.detectChanges();

    // El archivo cruza la ventana: se asoma, pero no se agranda todavía.
    expect(fab.classList).toContain('mascot-fab--file-near');
    expect(fab.classList).not.toContain('mascot-fab--catching');

    // Ya está ENCIMA de ella: ahora sí abre los brazos.
    fab.dispatchEvent(dragEvent('dragover'));
    fixture.detectChanges();

    expect(fab.classList).toContain('mascot-fab--catching');
    // El escalado vive en el orbe; el viaje y la pose siguen en el botón.
    expect(fab.style.transform).toBe(transform);

    // Cancelar el arrastre (Escape) termina también el agrandado del botón.
    document.dispatchEvent(dragEvent('dragend'));
    fixture.detectChanges();
    expect(fab.classList).not.toContain('mascot-fab--file-near');
    expect(fab.classList).not.toContain('mascot-fab--catching');

    // Y soltarlo encima lo limpia igual.
    document.dispatchEvent(dragEvent('dragenter'));
    fab.dispatchEvent(dragEvent('dragover'));
    fixture.detectChanges();
    expect(fab.classList).toContain('mascot-fab--catching');

    fab.dispatchEvent(dragEvent('drop'));
    fixture.detectChanges();
    expect(fab.classList).not.toContain('mascot-fab--catching');
  });

  it('conserva la transición de 800 ms en la regla base al desacoplarse', () => {
    fixture.detectChanges();

    const fab = host().querySelector<HTMLElement>('.mascot-fab')!;
    const style = getComputedStyle(fab);

    expect(style.transitionProperty).toContain('right');
    expect(style.transitionDuration).toContain('0.8s');
  });

  it('en modo acting o thinking, pulsarla alterna la pausa del trabajo', () => {
    const state = TestBed.inject(MascotStateService);
    const fill = TestBed.inject(MascotFillService);
    state.config.set({ enabled: true } as never);

    fill.begin();
    fixture.detectChanges();

    const orb = host().querySelector('app-mascot-orb')!;
    orb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(state.cursor.paused()).toBeTrue();

    orb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(state.cursor.paused()).toBeFalse();

    fill.end();
  });

  it('el anillo de foco no se queda pintado tras un clic', () => {
    fixture.detectChanges();
    const fab = host().querySelector<HTMLElement>('.mascot-fab')!;

    fab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(fab.hasAttribute('data-pointer-focus')).toBeTrue();

    fab.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    expect(fab.hasAttribute('data-pointer-focus')).toBeFalse();

    fab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fab.dispatchEvent(new FocusEvent('blur'));
    expect(fab.hasAttribute('data-pointer-focus')).toBeFalse();
  });

  it('en reposo, el hover muestra la píldora y un archivo cerca pide que se lo suelten', () => {
    fixture.detectChanges();
    const fab = host().querySelector<HTMLElement>('.mascot-fab')!;

    fab.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(host().querySelector('.mascot-hint')?.textContent).toContain('Nuti');

    fab.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(host().querySelector('.mascot-hint')).toBeNull();

    const dataTransfer = { types: ['Files'], files: [] };
    const dragEvent = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
      return event;
    };
    document.dispatchEvent(dragEvent('dragenter'));
    fixture.detectChanges();
    expect(host().querySelector('.mascot-hint')?.textContent).toContain('Suéltalo aquí');
    document.dispatchEvent(dragEvent('dragend'));
  });

  it('cerca del techo pinta el bocadillo debajo sin sumar un top al viaje', async () => {
    const fill = TestBed.inject(MascotFillService);
    const field = fieldAt(400, 10);
    document.body.appendChild(field);
    fill.saying.set({ key: 'assistant.fill_writing', values: { field: 'Peso' } });
    fill.target.set(field);

    for (let tries = 0; tries < 50 && host().querySelector('.mascot-doing--below') === null; tries += 1) {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();

    const bubble = host().querySelector<HTMLElement>('.mascot-doing');
    expect(bubble?.classList).toContain('mascot-doing--below');
    // La posición la pone el CSS: un `top` inline se sumaría al translate del viaje.
    expect(bubble?.style.top).toBe('');

    fill.target.set(null);
    field.remove();
  });
});
