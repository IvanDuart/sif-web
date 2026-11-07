import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TuiFocusTrap } from '@taiga-ui/cdk/directives/focus-trap';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';

/**
 * F6.0 — ¿puede la barra tener el foco con un diálogo abierto?
 *
 * Un `tui-dialog` monta `TuiFocusTrap`, que escucha `window:focusin` y
 * devuelve el foco al diálogo en cuanto se va fuera. Si eso valiera para todo,
 * la barra de abajo no podría escribirse mientras hay un diálogo abierto —y
 * ese es justo el momento en que más falta hace, porque el formulario que la
 * mascota rellena vive dentro de un diálogo.
 *
 * La salida ya existe y no es nueva: la trampa permite lo que va DESPUÉS del
 * diálogo en el DOM (`tuiContainsOrAfter`), y la capa de la mascota se pinta
 * fuera de `tui-root` (ver `OverlayLayerService`). Esto lo fija para que nadie
 * mueva la mascota dentro de `tui-root` sin enterarse de lo que rompe.
 */
@Component({
  standalone: true,
  imports: [TuiFocusTrap],
  template: `
    <input id="before" />
    <div tuiFocusTrap><button id="inside" type="button">Dentro</button></div>
    <input id="after" />
  `,
})
class TrapHost {}

describe('F6.0 — el foco de la barra con un diálogo abierto', () => {
  let root: HTMLElement;

  const focus = async (id: string) => {
    const target = root.querySelector<HTMLElement>(`#${id}`)!;
    target.focus();
    target.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return document.activeElement?.id;
  };

  beforeEach(async () => {
    // `window:focusin.zoneless` necesita los plugins de eventos de Taiga: sin
    // ellos la trampa ni se entera, y el test pasaría sin probar nada.
    TestBed.configureTestingModule({ providers: [NG_EVENT_PLUGINS] });
    const fixture = TestBed.createComponent(TrapHost);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    // La trampa se activa en un microtask.
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(() => root.remove());

  it('lo que va ANTES del diálogo pierde el foco: dentro de `tui-root` la barra no funcionaría', async () => {
    expect(await focus('before')).not.toBe('before');
  });

  it('lo que va DESPUÉS lo conserva: por eso la mascota se pinta fuera de `tui-root`', async () => {
    expect(await focus('after')).toBe('after');
  });
});
