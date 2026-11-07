import { TestBed } from '@angular/core/testing';

import { QuestionService, YES } from './question.service';

describe('QuestionService', () => {
  let questions: QuestionService;

  beforeEach(() => {
    questions = TestBed.inject(QuestionService);
  });

  it('la pregunta se ve hasta que se contesta', async () => {
    const pending = questions.ask({ kind: 'ask', text: '¿Qué día?' });
    expect(questions.current()?.text).toBe('¿Qué día?');

    questions.answer('martes');
    expect(await pending).toEqual({ ok: true, value: 'martes' });
    expect(questions.current()).toBeNull();
  });

  it('un «no» es una respuesta, y se distingue de que nadie conteste', async () => {
    const declined = questions.ask({ kind: 'confirm', text: '¿La borro?' });
    questions.decline();
    expect(await declined).toEqual({ ok: false, reason: 'declined' });

    const released = questions.ask({ kind: 'confirm', text: '¿La borro?' });
    questions.release();
    expect(await released).toEqual({ ok: false, reason: 'superseded' });
  });

  it('detener el turno resuelve lo que estuviera esperando', async () => {
    const stop = new AbortController();
    const pending = questions.ask({ kind: 'ask', text: '¿Qué día?' }, stop.signal);
    stop.abort();
    expect(await pending).toEqual({ ok: false, reason: 'aborted' });
    expect(questions.current()).toBeNull();
  });

  it('preguntar con el turno ya detenido no deja nada en pantalla', async () => {
    expect(await questions.ask({ kind: 'ask', text: '¿Qué día?' }, AbortSignal.abort()))
      .toEqual({ ok: false, reason: 'aborted' });
    expect(questions.current()).toBeNull();
  });

  it('dos preguntas no se pisan: la primera se suelta en vez de quedarse colgada', async () => {
    const first = questions.ask({ kind: 'ask', text: 'Primera' });
    const second = questions.ask({ kind: 'ask', text: 'Segunda' });

    expect(await first).toEqual({ ok: false, reason: 'superseded' });
    expect(questions.current()?.text).toBe('Segunda');
    questions.answer(YES);
    expect(await second).toEqual({ ok: true, value: YES });
  });

  it('contestar sin nada esperando no hace nada', () => {
    expect(() => questions.answer('hola')).not.toThrow();
    expect(questions.current()).toBeNull();
  });
});
