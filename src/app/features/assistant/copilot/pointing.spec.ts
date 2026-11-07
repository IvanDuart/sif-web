import { findPointable, isDangerous, pointables, resolvePointable } from './pointing';

describe('pointing', () => {
  let host: HTMLElement;

  const mount = (html: string) => {
    host.innerHTML = html;
    return host;
  };

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  it('solo se ofrece lo que está marcado', () => {
    mount('<button data-mascot-point="save">Guardar</button><button>Otro</button>');
    expect(pointables(host).map((control) => control.id)).toEqual(['save']);
  });

  it('lo que no se ve no se señala', () => {
    mount('<button data-mascot-point="save" style="display:none">Guardar</button>');
    expect(resolvePointable('save', host)).toBe('control_gone');
  });

  it('el mismo control repetido en la página cuenta una vez', () => {
    mount(`
      <button data-mascot-point="new">Nueva cita</button>
      <button data-mascot-point="new">Nueva cita</button>
    `);
    expect(pointables(host).length).toBe(1);
  });

  it('un botón deshabilitado se distingue de uno que no está', () => {
    mount('<button data-mascot-point="save" disabled>Guardar</button>');
    expect(resolvePointable('save', host)).toBe('control_disabled');
    // Pero señalarlo sí vale: enseña justo por qué no se puede pulsar.
    expect(findPointable('save', host)?.id).toBe('save');
  });

  it('con un diálogo abierto no se toca lo de debajo', () => {
    mount(`
      <button data-mascot-point="behind">Detrás</button>
      <div role="dialog"><button data-mascot-point="inside">Dentro</button></div>
    `);
    expect(pointables(host).map((control) => control.id)).toEqual(['inside']);
  });

  it('lo que no se deshace se reconoce por lo que dice y por lo que declara', () => {
    mount(`
      <button data-mascot-point="a">Eliminar paciente</button>
      <button data-mascot-point="b" data-mascot-danger>Hacer algo</button>
      <button data-mascot-point="c" appearance="destructive">Hacer algo</button>
      <button data-mascot-point="d">Guardar</button>
    `);
    const danger = Object.fromEntries(pointables(host).map((control) => [control.id, control.dangerous]));
    expect(danger).toEqual({ a: true, b: true, c: true, d: false });
  });

  it('se nombra por su aria-label antes que por su texto', () => {
    mount('<button data-mascot-point="x" aria-label="Cerrar la ficha">×</button>');
    expect(findPointable('x', host)?.label).toBe('Cerrar la ficha');
  });

  it('isDangerous mira también el contenedor marcado', () => {
    mount('<div data-mascot-danger><button data-mascot-point="x">Hacer</button></div>');
    expect(isDangerous(host.querySelector('button')!)).toBeTrue();
  });
});
