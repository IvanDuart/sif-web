import { TestBed } from '@angular/core/testing';

import { QuestionService } from '../question.service';
import { runAskUser } from './ask.run';

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
});
