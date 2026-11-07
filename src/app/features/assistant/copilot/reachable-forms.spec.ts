import { allSurfaces } from './all-surfaces.testing';
import { reachableForms } from './reachable-forms';
import { NAVIGABLE_SCREENS } from './screen-routes';
import { fillTools } from './schema';
import { slugOf } from './tool-names';

describe('dónde vive cada formulario', () => {
  const mapa = reachableForms();

  it('están TODAS las superficies: una que falte es un formulario invisible para el modelo', () => {
    const declaradas = new Set(mapa.map((form) => form.id));
    for (const surface of allSurfaces()) {
      expect(declaradas.has(slugOf(surface.id))).withContext(surface.id).toBeTrue();
    }
  });

  it('el id es el mismo que el de su herramienta, no el del descriptor', () => {
    for (const surface of allSurfaces()) {
      const tools = fillTools(surface);
      if (tools.length === 0) continue;
      const entry = mapa.find((form) => `fill_${form.id}` === tools[0].decl.name);
      expect(entry).withContext(surface.id).toBeDefined();
    }
  });

  it('todas las pantallas son de las que `navigate` sabe alcanzar', () => {
    for (const form of mapa) {
      expect(NAVIGABLE_SCREENS).withContext(form.id).toContain(form.screen);
    }
  });

  it('cumple el saneado del backend: id en minúsculas y pantalla en mayúsculas', () => {
    for (const form of mapa) {
      expect(form.id).withContext(form.id).toMatch(/^[a-z][a-z0-9_]{0,48}$/);
      expect(form.screen).withContext(form.screen).toMatch(/^[A-Z][A-Z0-9_]{0,48}$/);
    }
  });

  it('cabe en el tope de 40 del backend', () => {
    expect(mapa.length).toBeLessThanOrEqual(40);
  });

  it('lo que vive en la ficha de alguien pide paciente', () => {
    const pide = (id: string) => mapa.find((form) => form.id === id)?.needsPatient;
    expect(pide('measurement')).toBeTrue();
    expect(pide('patient_profile')).toBeTrue();
    // Lo del centro, no.
    expect(pide('schedule')).toBeFalse();
    expect(pide('holiday')).toBeFalse();
  });
});
