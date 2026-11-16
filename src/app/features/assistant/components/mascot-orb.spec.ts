import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';

import { MascotMoodService } from '../mascot/mascot-mood.service';
import { AWAY_AFTER_MS, MascotLifeService, WELCOME_AFTER_MS } from '../mascot/mascot-life.service';

import { FACES } from '../mascot/skins/faces';
import { SKIN_IDS, type SkinId } from '../mascot/skins/types';
import { MascotOrb } from './mascot-orb';

/**
 * Los ojos se colocan con `transform`, y el atributo `transform` de SVG no
 * admite unidades: `translate(53px, 42px)` se descarta entero y los dos ojos
 * acaban superpuestos en la esquina del dibujo. Por eso aquí no se mira el
 * binding, se mira dónde cae el ojo de verdad en el navegador.
 */
describe('MascotOrb: la cara', () => {
  let fixture: ComponentFixture<MascotOrb>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MascotOrb], providers: [NG_EVENT_PLUGINS] }).compileComponents();
    fixture = TestBed.createComponent(MascotOrb);
    fixture.componentRef.setInput('decorative', true);
    fixture.componentRef.setInput('still', true);
    fixture.componentRef.setInput('size', 'l');
    document.body.appendChild(host());
  });

  afterEach(() => host().remove());

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const bars = (): SVGRectElement[] =>
    Array.from(host().querySelectorAll<SVGRectElement>('[data-eye] [data-bar]'));

  function show(skin: SkinId): void {
    fixture.componentRef.setInput('skin', skin);
    fixture.detectChanges();
  }

  it('dibuja dos ojos por skin, cada uno en su sitio', () => {
    for (const id of SKIN_IDS) {
      show(id);
      const [left, right] = bars().map((bar) => bar.getBoundingClientRect());

      expect(bars().length).withContext(id).toBe(2);
      // Superpuestos = el transform no se ha aplicado (el fallo que esto vigila).
      expect(right.left).withContext(id).toBeGreaterThan(left.right);
    }
  });

  it('los deja dentro del orb y a la misma distancia de su centro', () => {
    for (const id of SKIN_IDS) {
      show(id);
      const orb = host().getBoundingClientRect();
      const middle = orb.left + orb.width / 2;
      const [left, right] = bars().map((bar) => bar.getBoundingClientRect());

      for (const eye of [left, right]) {
        expect(eye.left).withContext(id).toBeGreaterThanOrEqual(orb.left);
        expect(eye.right).withContext(id).toBeLessThanOrEqual(orb.right);
        expect(eye.top).withContext(id).toBeGreaterThanOrEqual(orb.top);
        expect(eye.bottom).withContext(id).toBeLessThanOrEqual(orb.bottom);
      }
      expect(middle - (left.left + left.width / 2))
        .withContext(id)
        .toBeCloseTo(right.left + right.width / 2 - middle, 1);
    }
  });

  it('pinta cada skin con el color de ojos de su diseño', () => {
    for (const id of SKIN_IDS) {
      show(id);
      expect(bars()[0].getAttribute('fill')).withContext(id).toBe(FACES[id].colour);
    }
  });

  it('en vista previa, agua saca la botella y fuerza los dos brazos y los ojos arqueados', () => {
    fixture.componentRef.setInput('previewScene', 'water');
    fixture.detectChanges();
    expect(host().querySelector('.mascot-water')).withContext('agua').not.toBeNull();

    fixture.componentRef.setInput('previewScene', 'proud');
    fixture.detectChanges();
    expect(host().querySelectorAll('.mascot-flex').length).withContext('brazos').toBe(2);
    const arches = host().querySelectorAll('[data-eye][data-look="arch"]');
    expect(arches.length).withContext('ojos arqueados').toBe(2);
    for (const arch of Array.from(arches)) {
      expect(arch.querySelector('[data-arch]')?.getAttribute('opacity')).toBe('1');
    }
  });

  it('en vista previa, el móvil y la tabla clínica salen con su escena', () => {
    fixture.componentRef.setInput('previewScene', 'phone');
    fixture.detectChanges();
    expect(host().querySelector('.mascot-phone')).withContext('móvil').not.toBeNull();
    expect(host().querySelector('.mascot-clipboard')).withContext('sin tabla').toBeNull();

    fixture.componentRef.setInput('previewScene', 'notes');
    fixture.detectChanges();
    expect(host().querySelector('.mascot-clipboard')).withContext('tabla').not.toBeNull();
    expect(host().querySelector('.mascot-pencil')).withContext('lápiz').not.toBeNull();
  });

  it('las gafas suben y bajan con los ojos de cada fruta', () => {
    const glasses = () => host().querySelector<SVGGElement>('[data-glasses]');
    const offset = (el: SVGGElement | null) => {
      const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el?.style.transform ?? '');
      return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
    };

    fixture.componentRef.setInput('accessories', ['gafas']);
    fixture.componentRef.setInput('skin', 'naranja');
    fixture.detectChanges();
    const orange = offset(glasses());

    fixture.componentRef.setInput('skin', 'semilla');
    fixture.detectChanges();
    const seed = offset(glasses());

    expect(orange).withContext('naranja').not.toBeNull();
    expect(seed).withContext('semilla').not.toBeNull();
    // La semilla tiene los ojos más abajo (`FACES.semilla.eyes[0][1]`), así que
    // la montura la sigue en vez de quedarse a la altura de la naranja.
    expect(seed!.y).withContext('la montura baja con los ojos').toBeGreaterThan(orange!.y);
  });
});

describe('MascotOrb: señales de estado', () => {
  let fixture: ComponentFixture<MascotOrb>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MascotOrb] }).compileComponents();
    fixture = TestBed.createComponent(MascotOrb);
    // Decorativo para no arrancar el reloj de ausencia; no quieto, para que
    // se pinten las señales.
    fixture.componentRef.setInput('decorative', true);
    fixture.componentRef.setInput('still', false);
    fixture.detectChanges();
  });

  it('en confirm pinta la insignia de pregunta', () => {
    fixture.componentRef.setInput('mode', 'confirm');
    fixture.detectChanges();

    expect(host().querySelector('[data-badge="ask"]')?.textContent?.trim()).toBe('?');
  });

  it('en pausa pinta las dos barras', () => {
    fixture.componentRef.setInput('mode', 'paused');
    fixture.detectChanges();

    expect(host().querySelector('[data-badge="paused"]')).not.toBeNull();
  });

  it('preocupada enseña cejas de disculpa, no el ceño del enfado', () => {
    const mood = TestBed.inject(MascotMoodService);
    mood.feel('worried');
    fixture.detectChanges();

    const brow = host().querySelector<SVGPathElement>('[data-brow]');
    expect(brow).not.toBeNull();
    expect(brow?.getAttribute('data-brow-kind')).toBe('sorry');
    expect(brow?.getAttribute('opacity')).toBe('0.8');
  });

  it('al cambiar de fruta suelta un destello radial', () => {
    fixture.componentRef.setInput('skin', 'naranja');
    fixture.detectChanges();
    fixture.detectChanges();

    expect(host().querySelector('.mascot-burst')).not.toBeNull();
  });

  it('tras 120 s sin actividad se marca ausente y al volver tras 5 min saluda', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(0));
    try {
      const mood = TestBed.inject(MascotMoodService);
      const life = TestBed.inject(MascotLifeService);
      const absent = TestBed.createComponent(MascotOrb);
      absent.componentRef.setInput('decorative', false);
      absent.componentRef.setInput('still', false);
      absent.detectChanges();

      jasmine.clock().tick(AWAY_AFTER_MS);
      absent.detectChanges();
      expect(life.away()).toBeTrue();

      const attend = spyOn(life, 'attend').and.callThrough();
      const feel = spyOn(mood, 'feel').and.callThrough();
      spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
      jasmine.clock().tick(WELCOME_AFTER_MS);
      window.dispatchEvent(new Event('pointermove'));
      absent.detectChanges();

      expect(life.away()).toBeFalse();
      expect(attend).toHaveBeenCalled();
      expect(feel).toHaveBeenCalledWith('welcome');
      expect(mood.mood()?.kind).toBe('welcome');
      absent.destroy();
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
