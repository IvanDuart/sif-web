import { NEW_ROW_ATTR, ROW_GAP_MS, markNewRow, revealRows, rowOf } from './insert-reveal';

describe('filas en cascada', () => {
  let host: HTMLElement;

  const mount = (rows: number) => {
    host.innerHTML = Array.from({ length: rows }, (_, i) => `<tr data-mascot-row="details.${i}"></tr>`).join('');
  };

  beforeEach(() => {
    host = document.createElement('tbody');
    document.body.appendChild(host);
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    host.remove();
  });

  it('cada fila entra un poco después que la anterior', () => {
    mount(3);
    revealRows('details', 0, 3, host);
    const delays = Array.from(host.querySelectorAll<HTMLElement>(`[${NEW_ROW_ATTR}]`)).map((row) =>
      row.style.getPropertyValue('--mascot-row-delay'),
    );
    expect(delays).toEqual(['0ms', `${ROW_GAP_MS}ms`, `${ROW_GAP_MS * 2}ms`]);
  });

  it('la marca se quita sola: es para entrar, no un estado', () => {
    mount(1);
    markNewRow(host.querySelector('tr')!, 0);
    expect(host.querySelector(`[${NEW_ROW_ATTR}]`)).not.toBeNull();
    jasmine.clock().tick(1000);
    expect(host.querySelector(`[${NEW_ROW_ATTR}]`)).toBeNull();
  });

  it('sólo marca el tramo que se añadió, no la lista entera', () => {
    mount(5);
    revealRows('details', 3, 5, host);
    expect(host.querySelectorAll(`[${NEW_ROW_ATTR}]`).length).toBe(2);
    expect(rowOf('details', 0, host)?.hasAttribute(NEW_ROW_ATTR)).toBeFalse();
  });

  it('una fila que aún no está en el DOM se salta, no revienta', () => {
    mount(1);
    expect(() => revealRows('details', 0, 4, host)).not.toThrow();
  });

  it('se puede deshacer antes de tiempo', () => {
    mount(2);
    revealRows('details', 0, 2, host)();
    expect(host.querySelectorAll(`[${NEW_ROW_ATTR}]`).length).toBe(0);
  });
});
