import { TestBed } from '@angular/core/testing';

import { HIGHLIGHT_ATTR } from '../../mascot/fill/animated-fill';
import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { CursorService } from '../cursor.service';
import { runShowAround } from './tour.run';

async function waitFor(check: () => boolean): Promise<boolean> {
  for (let tries = 0; tries < 100 && !check(); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return check();
}

describe('runShowAround', () => {
  let fill: MascotFillService;
  let cursor: CursorService;
  let host: HTMLElement;

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
    cursor = TestBed.inject(CursorService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  const mount = (html: string): HTMLButtonElement => {
    host.innerHTML = html;
    return host.querySelector('button')!;
  };

  it('resalta cada parada mientras la cuenta y la suelta al pasar', async () => {
    const first = mount('<button data-mascot-point="one">Uno</button>');
    const pending = runShowAround(
      { stops: [{ control: 'one', say: 'Esto es uno' }] },
      { fill, cursor, signal: new AbortController().signal },
    );

    expect(await waitFor(() => first.hasAttribute(HIGHLIGHT_ATTR))).toBeTrue();

    fill.requestSkip();
    await pending;

    expect(first.hasAttribute(HIGHLIGHT_ATTR)).toBeFalse();
  });

  it('el resaltado se limpia si se corta el recorrido', async () => {
    const first = mount('<button data-mascot-point="one">Uno</button>');
    const pending = runShowAround(
      { stops: [{ control: 'one', say: '' }] },
      { fill, cursor, signal: new AbortController().signal },
    );

    await waitFor(() => first.hasAttribute(HIGHLIGHT_ATTR));
    fill.requestSkip();
    await pending;

    expect(first.hasAttribute(HIGHLIGHT_ATTR)).toBeFalse();
  });

  it('sin paradas es un error de herramienta', async () => {
    const result = await runShowAround(
      { stops: [] },
      { fill, cursor, signal: new AbortController().signal },
    );

    expect(result).toEqual({ ok: false, reason: 'tool_error' });
  });

  it('las paradas que no están se saltan, no cortan el recorrido', async () => {
    mount('<button data-mascot-point="two">Dos</button>');

    const result = await runShowAround(
      { stops: [{ control: 'one', say: '' }] },
      { fill, cursor, signal: new AbortController().signal },
    );

    expect(result['stops']).toEqual([]);
    expect(result['skipped']).toEqual(['one']);
  });
});
