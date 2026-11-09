import { TestBed } from '@angular/core/testing';

import { HIGHLIGHT_ATTR } from '../../mascot/fill/animated-fill';
import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { runPointAt } from './point.run';

/** Deja correr el turno hasta que se cumpla algo, sin montar relojes falsos. */
async function waitFor(check: () => boolean): Promise<boolean> {
  for (let tries = 0; tries < 100 && !check(); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return check();
}

describe('runPointAt', () => {
  let fill: MascotFillService;
  let host: HTMLElement;

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  const mount = (html: string): HTMLButtonElement => {
    host.innerHTML = html;
    return host.querySelector('button')!;
  };

  it('deja el control señalado mientras lo explica', async () => {
    const button = mount('<button data-mascot-point="save">Guardar</button>');
    const pending = runPointAt({ control: 'save' }, { fill, signal: new AbortController().signal });

    expect(await waitFor(() => button.hasAttribute(HIGHLIGHT_ATTR))).toBeTrue();

    fill.requestSkip();
    const result = await pending;

    expect(result.ok).toBeTrue();
    expect(button.hasAttribute(HIGHLIGHT_ATTR)).toBeFalse();
  });

  it('si se detiene el turno, el resaltado se limpia igual', async () => {
    const button = mount('<button data-mascot-point="save">Guardar</button>');
    const pending = runPointAt({ control: 'save' }, { fill, signal: new AbortController().signal });

    await waitFor(() => button.hasAttribute(HIGHLIGHT_ATTR));
    fill.requestSkip();
    await pending;

    expect(button.hasAttribute(HIGHLIGHT_ATTR)).toBeFalse();
  });

  it('con la señal ya abortada no señala nada', async () => {
    const button = mount('<button data-mascot-point="save">Guardar</button>');

    const result = await runPointAt({ control: 'save' }, { fill, signal: AbortSignal.abort() });

    expect(result).toEqual({ ok: false, reason: 'user_declined' });
    expect(button.hasAttribute(HIGHLIGHT_ATTR)).toBeFalse();
  });

  it('un control que ya no está no se inventa', async () => {
    const result = await runPointAt({ control: 'gone' }, { fill, signal: new AbortController().signal });

    expect(result).toEqual({ ok: false, reason: 'control_gone', control: 'gone' });
  });
});
