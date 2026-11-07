import { TestBed } from '@angular/core/testing';

import type { MascotAction } from '../../mascot/fill/descriptor';
import { QuestionService, YES } from '../question.service';
import { runAction } from './action.run';

describe('runAction', () => {
  let questions: QuestionService;
  let done: number;

  const action = (over: Partial<MascotAction> = {}): MascotAction => ({
    id: 'complete-appointment',
    description: 'Marca la cita abierta como realizada',
    run: () => {
      done += 1;
    },
    ...over,
  });

  const run = (value: MascotAction, signal = new AbortController().signal) =>
    runAction(value, { questions, signal });

  beforeEach(() => {
    questions = TestBed.inject(QuestionService);
    done = 0;
  });

  it('lo que no escribe se hace sin preguntar', async () => {
    expect(await run(action())).toEqual({ ok: true, action: 'complete-appointment' });
    expect(done).toBe(1);
  });

  it('lo que escribe en el backend no se hace sin un sí explícito', async () => {
    const pending = run(action({ confirm: true, confirmText: '¿La marco como realizada?' }));
    expect(questions.current()?.text).toBe('¿La marco como realizada?');
    expect(done).toBe(0);

    questions.decline();
    expect((await pending).ok).toBeFalse();
    expect(done).toBe(0);
  });

  it('con el sí, se hace una vez', async () => {
    const pending = run(action({ confirm: true }));
    questions.answer(YES);
    expect((await pending).ok).toBeTrue();
    expect(done).toBe(1);
  });

  it('detener el turno no ejecuta nada', async () => {
    expect(await run(action(), AbortSignal.abort())).toEqual({ ok: false, reason: 'user_declined' });
    expect(done).toBe(0);
  });
});
