import { TestBed, fakeAsync, tick, type ComponentFixture } from '@angular/core/testing';

import { MascotLifeService, PHONE_AFTER_MS } from '../mascot/mascot-life.service';
import { MascotOrb } from './mascot-orb';

/**
 * El teléfono (y todo lo que flota alrededor: zetas, humos, chispas) nace con
 * `opacity: 0` y lo enciende la animación. Si la animación arranca antes de
 * que Angular haya pintado su `@if`, no encuentra el elemento y no sale nada:
 * por eso el motion va en un `afterRenderEffect` y no en un `effect`.
 */
describe('MascotOrb: lo que flota alrededor', () => {
  let fixture: ComponentFixture<MascotOrb>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MascotOrb] });
    fixture = TestBed.createComponent(MascotOrb);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.autoDetectChanges();
  });

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  it('saca el teléfono, y se ve, cuando lleva mucho esperando una confirmación', fakeAsync(() => {
    fixture.componentRef.setInput('mode', 'confirm');

    tick(PHONE_AFTER_MS + 100);

    expect(TestBed.inject(MascotLifeService).life()?.kind).toBe('phone');
    const phone = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.mascot-phone');
    expect(phone).withContext('el elemento del teléfono').toBeTruthy();
    // La animación de entrada lo trae desde `opacity: 0`; que la animación lo
    // encontrara se ve en la opacidad que deja escrita en línea.
    expect(phone!.style.opacity).withContext('opacidad en línea del teléfono').toBe('1');

    fixture.destroy(); // corta los temporizadores de las miraditas
  }));
});
