import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';

import { MascotLifeService } from '../mascot/mascot-life.service';
import { PERSONALITIES } from '../mascot/skins/personalities';
import { SKIN_IDS, type SkinId } from '../mascot/skins/types';
import { MascotOrb } from './mascot-orb';

/**
 * Lo que flota alrededor tiene que ser lo que el movimiento va a animar.
 *
 * Las piezas (`data-o`) se dibujaban sólo por escena, así que una fruta que no
 * usa el 💢 lo tenía igualmente en el DOM, parado. Una pieza dibujada y quieta
 * se ve peor que no tenerla: parece que algo se ha roto.
 */
describe('las piezas que flotan alrededor de cada fruta', () => {
  let fixture: ComponentFixture<MascotOrb>;
  let life: MascotLifeService;

  const show = async (skin: SkinId, kind: 'blush' | 'angry') => {
    fixture.componentRef.setInput('skin', skin);
    fixture.detectChanges();
    (life as unknown as { ambient: { set(v: unknown): void } }).ambient.set(null);
    fixture.detectChanges();
    (life as unknown as { ambient: { set(v: unknown): void } }).ambient.set({ kind });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const drawn = () =>
    [...host().querySelectorAll('[data-o]')].map((piece) => piece.getAttribute('data-o') ?? '');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NG_EVENT_PLUGINS] });
    fixture = TestBed.createComponent(MascotOrb);
    life = TestBed.inject(MascotLifeService);
    fixture.componentRef.setInput('still', true);
    fixture.detectChanges();
  });

  it('sólo sale el 💢 de quien lo usa', async () => {
    for (const skin of SKIN_IDS as readonly SkinId[]) {
      await show(skin, 'angry');
      expect(drawn().includes('mark')).withContext(skin).toBe(PERSONALITIES[skin].angry.mark);
    }
  });

  it('cada una saca lo suyo al alegrarse, y sólo lo suyo', async () => {
    for (const skin of SKIN_IDS as readonly SkinId[]) {
      await show(skin, 'blush');
      const bits = PERSONALITIES[skin].happy.bits;
      const pieces = drawn();
      expect(pieces.includes('heart')).withContext(`${skin} · corazones`).toBe(bits === 'heart' || bits === 'both');
      expect(pieces.includes('star')).withContext(`${skin} · estrellas`).toBe(bits === 'star' || bits === 'both');
    }
  });

  it('nadie saca zetas al enfadarse: la zeta dice «durmiendo», no «enfadada»', async () => {
    for (const skin of SKIN_IDS as readonly SkinId[]) {
      await show(skin, 'angry');
      expect(drawn().includes('z')).withContext(skin).toBeFalse();
    }
  });

  it('la que no saca nada al alegrarse no deja nada dibujado', async () => {
    await show('brocoli', 'blush');
    expect(drawn().filter((piece) => piece === 'heart' || piece === 'star')).toEqual([]);
  });
});
