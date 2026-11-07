import { startMotion } from './agentMotion';
import { SKIN_IDS, type SkinId } from './skins/types';

/** Un orbe de mentira con las piezas que el de verdad dibuja. */
function orb(): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = `
    <span data-turner>
      <svg><g data-eye><rect data-bar/><path data-arch/><g data-spiral/><ellipse data-cheek/></g></svg>
    </span>
    <i data-o="heart"></i><i data-o="heart"></i>
    <i data-o="star"></i><i data-o="star"></i>
    <i data-o="z"></i><i data-o="z"></i>
    <span data-o="mark"></span>
  `;
  document.body.appendChild(host);
  return host;
}

/** Qué se está animando ahora mismo, por el `data-o` de cada pieza. */
function moving(host: HTMLElement): Set<string> {
  const names = new Set<string>();
  for (const animation of host.getAnimations({ subtree: true })) {
    const target = (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null;
    if (!target) continue;
    names.add(target.getAttribute('data-o') ?? (target.hasAttribute('data-turner') ? 'turner' : 'otro'));
  }
  return names;
}

describe('cada fruta reacciona a su manera', () => {
  let host: HTMLElement;

  beforeEach(() => (host = orb()));
  afterEach(() => host.remove());

  it('la piña no saca 💢 al enfadarse: te da la espalda', () => {
    startMotion(host, 'angry', 'pina', false);
    expect(moving(host).has('mark')).toBeFalse();
  });

  it('la manzana sí lo saca', () => {
    startMotion(host, 'angry', 'manzana', false);
    expect(moving(host).has('mark')).toBeTrue();
  });

  it('el melón enfadado resopla con el cuerpo, sin zetas: dormir no es enfadarse', () => {
    startMotion(host, 'angry', 'melon', false);
    const piezas = moving(host);
    expect(piezas.has('turner')).toBeTrue();
    expect(piezas.has('z')).toBeFalse();
  });

  it('la naranja contenta saca estrellas, no corazones', () => {
    startMotion(host, 'blush', 'naranja', false);
    const bits = moving(host);
    expect(bits.has('star')).toBeTrue();
    expect(bits.has('heart')).toBeFalse();
  });

  it('la semilla contenta saca las dos cosas: todo le admira', () => {
    startMotion(host, 'blush', 'semilla', false);
    const bits = moving(host);
    expect(bits.has('heart')).toBeTrue();
    expect(bits.has('star')).toBeTrue();
  });

  it('el brócoli se alegra por dentro: sólo las mejillas', () => {
    startMotion(host, 'blush', 'brocoli', false);
    const bits = moving(host);
    expect(bits.has('heart')).toBeFalse();
    expect(bits.has('star')).toBeFalse();
  });

  it('ninguna se queda sin reaccionar, ni contenta ni enfadada', () => {
    for (const skin of SKIN_IDS as readonly SkinId[]) {
      for (const scene of ['blush', 'angry'] as const) {
        host.remove();
        host = orb();
        startMotion(host, scene, skin, false);
        expect(moving(host).size).withContext(`${skin} · ${scene}`).toBeGreaterThan(0);
      }
    }
  });

  it('sin movimiento no se anima nada, pero no revienta', () => {
    expect(() => startMotion(host, 'blush', 'manzana', true)).not.toThrow();
  });
});
