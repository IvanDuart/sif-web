import { fakeAsync, tick } from '@angular/core/testing';

import { MascotMoodService, NOTE_MS, type NoteAction } from './mascot-mood.service';

/**
 * Lo que decide si una nota se queda o se va sola. Importa porque de ello
 * depende que una oferta de ayuda siga ahí cuando la persona levanta la vista:
 * una nota con botones que se desvanece a los seis segundos es una oferta que
 * se retira mientras la lees.
 */
describe('MascotMoodService: cuánto se queda lo que dice', () => {
  let mood: MascotMoodService;

  const action = (run: () => void = () => undefined): NoteAction => ({ label: 'Pruébalo', run });

  beforeEach(() => {
    mood = new MascotMoodService();
  });

  it('una nota sin acciones se va sola', fakeAsync(() => {
    mood.say({ text: 'Listo' });
    expect(mood.note()).not.toBeNull();

    tick(NOTE_MS);
    expect(mood.note()).toBeNull();
  }));

  it('una nota con acciones espera a que le contesten', fakeAsync(() => {
    mood.say({ text: '¿Lo hago por ti?', actions: [action()] });

    tick(NOTE_MS * 10);
    expect(mood.note()).not.toBeNull();

    mood.unsay();
  }));

  it('con `ms` explícito manda `ms`, aunque tenga acciones', fakeAsync(() => {
    mood.say({ text: '¿Lo hago por ti?', ms: 2000, actions: [action()] });

    tick(1999);
    expect(mood.note()).not.toBeNull();

    tick(1);
    expect(mood.note()).toBeNull();
  }));

  it('la nota que espera no deja colgado el reloj de la anterior', fakeAsync(() => {
    mood.say({ text: 'Me voy sola' });
    mood.say({ text: 'Yo espero', actions: [action()] });

    tick(NOTE_MS * 10);
    expect(mood.note()?.text).toBe('Yo espero');

    mood.unsay();
  }));

  it('`unsay` retira la que espera', fakeAsync(() => {
    const id = mood.say({ text: '¿Lo hago por ti?', actions: [action()] });

    mood.unsay(id);
    expect(mood.note()).toBeNull();
  }));

  it('`unsay` con el id de otra no se lleva la que se muestra', fakeAsync(() => {
    const first = mood.say({ text: 'Primera' });
    mood.say({ text: 'Segunda', actions: [action()] });

    mood.unsay(first);
    expect(mood.note()?.text).toBe('Segunda');

    mood.unsay();
  }));
});
