import { ALL_OPENERS } from '../mascot/fill/surfaces/openers';
import { reachableForms } from './reachable-forms';
import { NAVIGABLE_SCREENS, routeForScreen } from './screen-routes';
import { slugOf } from './tool-names';

/**
 * El mapa de formularios alcanzables tiene que decir la verdad.
 *
 * Si promete un formulario en una pantalla donde no hay botón que pulsar, la
 * mascota navega hasta allí, no encuentra nada y se rinde: acaba escribiendo
 * por detrás, que es peor que no haber ofrecido el camino. Pasó con
 * `appointment`, que decía vivir en `PATIENT_APPOINTMENTS` (la agenda) cuando
 * su botón está en la cabecera de la ficha del paciente.
 */
describe('dónde vive cada formulario', () => {
  const mapa = reachableForms();

  it('todo lo que se sabe abrir Y tiene pantalla está en el mapa', () => {
    const ids = new Set(mapa.map((form) => form.id));
    for (const opener of ALL_OPENERS) {
      if (!opener.screen) continue;
      expect(ids.has(slugOf(opener.id))).withContext(opener.id).toBeTrue();
    }
  });

  it('lo que no tiene pantalla NO se promete: no habría forma de llegar', () => {
    const ids = mapa.map((form) => form.id);
    for (const opener of ALL_OPENERS) {
      if (opener.screen) continue;
      expect(ids).withContext(opener.id).not.toContain(slugOf(opener.id));
    }
  });

  it('cada formulario dice qué escrituras de servidor cubre', () => {
    // Es el eslabón que le faltaba al modelo: `appointment` ↔
    // `reschedule_appointment` no se parecen en nada, y sin esto llamaba a la
    // tool de servidor sin mirar siquiera el formulario.
    const cita = mapa.find((form) => form.id === 'appointment');
    expect(cita?.tools).toContain('reschedule_appointment');
    expect(cita?.tools).toContain('create_appointment');
    const medicion = mapa.find((form) => form.id === 'measurement');
    expect(medicion?.tools).toContain('create_measurement');
  });

  it('cada pantalla es de las que `navigate` alcanza', () => {
    for (const form of mapa) {
      expect(NAVIGABLE_SCREENS).withContext(form.id).toContain(form.screen);
    }
  });

  it('la pantalla de un formulario con paciente lleva a SU ficha, no a un listado', () => {
    for (const form of mapa) {
      if (!form.needsPatient) continue;
      const route = routeForScreen(form.screen, { patientId: 'p-1' });
      expect(route?.commands)
        .withContext(`${form.id} → ${form.screen}`)
        .toEqual(['/users', 'p-1']);
    }
  });

  it('la cita se abre desde la ficha, no desde la agenda', () => {
    // El regresivo del fallo: `PATIENT_APPOINTMENTS` lleva a `/appointments`,
    // donde no hay ningún `data-mascot-open="appointment"`.
    const cita = mapa.find((form) => form.id === 'appointment');
    expect(cita?.screen).not.toBe('PATIENT_APPOINTMENTS');
    expect(routeForScreen(cita!.screen, { patientId: 'p-1' })?.commands).toEqual(['/users', 'p-1']);
  });

  it('cumple el saneado del backend y cabe en su tope', () => {
    for (const form of mapa) {
      expect(form.id).withContext(form.id).toMatch(/^[a-z][a-z0-9_]{0,48}$/);
      expect(form.screen).withContext(form.screen).toMatch(/^[A-Z][A-Z0-9_]{0,48}$/);
    }
    expect(mapa.length).toBeLessThanOrEqual(40);
  });

  it('no promete lo que nadie sabe abrir', () => {
    // La comida de un menú, renombrar y la nota de agenda tienen superficie
    // pero NO tienen opener: se llega a ellas por un camino que la mascota no
    // sabe recorrer. Ofrecerlas sería mandarla a un sitio donde se rinde.
    const ids = mapa.map((form) => form.id);
    expect(ids).not.toContain('meal');
    expect(ids).not.toContain('menu_rename');
    expect(ids).not.toContain('calendar_note');
  });
});
