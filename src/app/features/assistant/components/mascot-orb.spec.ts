import { ComponentFixture, TestBed } from '@angular/core/testing';

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
    await TestBed.configureTestingModule({ imports: [MascotOrb] }).compileComponents();
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
});
