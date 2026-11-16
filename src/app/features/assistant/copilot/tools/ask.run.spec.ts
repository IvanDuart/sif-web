import { TestBed } from '@angular/core/testing';

import { PersonSaveService } from '../person-save.service';
import { QuestionService } from '../question.service';
import { WriteWatchService } from '../write-watch.service';
import { runAskUser, savedByPerson } from './ask.run';

describe('runAskUser', () => {
  let questions: QuestionService;

  const run = (args: Record<string, unknown>, signal = new AbortController().signal) =>
    runAskUser(args, { questions, signal });

  beforeEach(() => {
    questions = TestBed.inject(QuestionService);
  });

  it('pregunta y devuelve lo que se contesta', async () => {
    const pending = run({ question: '¿Qué día te viene bien?' });
    expect(questions.current()?.text).toBe('¿Qué día te viene bien?');
    questions.answer('el martes');
    expect(await pending).toEqual({ ok: true, answer: 'el martes' });
  });

  it('las opciones se ofrecen como respuestas, hasta seis', async () => {
    const pending = run({ question: '¿Cuál?', options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    expect(questions.current()?.options).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    questions.answer('a');
    await pending;
  });

  it('una pregunta vacía no se le enseña a nadie', async () => {
    expect(await run({ question: '   ' })).toEqual({ ok: false, reason: 'tool_error' });
    expect(questions.current()).toBeNull();
  });

  it('decir que no es una respuesta, no un fallo nuestro', async () => {
    const pending = run({ question: '¿Sigo?' });
    questions.decline();
    expect(await pending).toEqual({ ok: false, reason: 'user_declined' });
  });

  it('detener el turno cierra la pregunta', async () => {
    const stop = new AbortController();
    const pending = run({ question: '¿Sigo?' }, stop.signal);
    stop.abort();
    expect(await pending).toEqual({ ok: false, reason: 'aborted' });
  });

  describe('pulsar Guardar mientras pregunta', () => {
    let host: HTMLElement;
    beforeEach(() => {
      host = document.createElement('div');
      host.innerHTML = '<button data-mascot-submit="appointment">Guardar cita</button>';
      document.body.appendChild(host);
    });
    afterEach(() => host.remove());

    it('es la respuesta: dice que se guardó y que no lo vuelva a guardar', async () => {
      const saves = TestBed.inject(PersonSaveService);
      const writes = TestBed.inject(WriteWatchService);
      const pending = runAskUser({ question: 'Revísalo y guárdalo; luego sigo con la nota.' },
        { questions, saves, signal: new AbortController().signal });

      (host.querySelector('button') as HTMLElement).click();
      writes.last.set({ ok: true, status: 200 });
      const result = await pending;

      expect(result).toEqual(jasmine.objectContaining({ ok: true, answered: true, saved: true, pressedByPerson: 'Guardar cita' }));
      expect(String(result['note'])).toContain('No lo vuelvas a guardar');
      expect(questions.current()).toBeNull();
    });

    it('fuera de una pregunta, pulsar Guardar no se escucha', async () => {
      const saves = TestBed.inject(PersonSaveService);
      const watch = spyOn(saves, 'watch').and.callThrough();
      const pending = runAskUser({ question: '¿Sigo?' }, { questions, saves, signal: new AbortController().signal });
      questions.answer('sí');
      await pending;
      // Se escucha mientras la pregunta está en el aire y se deja de escuchar al contestarla.
      expect(watch).toHaveBeenCalledTimes(1);
      const outcome = spyOn(saves, 'outcome');
      (host.querySelector('button') as HTMLElement).click();
      expect(outcome).not.toHaveBeenCalled();
    });
  });

  describe('lo que se cuenta del Guardar', () => {
    it('con errores, no dice que está hecho y pasa los motivos', () => {
      const result = savedByPerson({ label: 'Guardar', outcome: { saved: false, reason: 'form_has_errors', errors: ['Falta la hora'] } });
      expect(result).toEqual(jasmine.objectContaining({ saved: false, reason: 'form_has_errors', errors: ['Falta la hora'] }));
      expect(String(result['note'])).toContain('no digas que está hecho');
    });

    it('si el servidor lo rechaza, lo dice con el estado', () => {
      const result = savedByPerson({ label: 'Guardar', outcome: { saved: false, reason: 'rejected', status: 409 } });
      expect(result).toEqual(jasmine.objectContaining({ saved: false, reason: 'rejected', status: 409 }));
    });
  });
});
