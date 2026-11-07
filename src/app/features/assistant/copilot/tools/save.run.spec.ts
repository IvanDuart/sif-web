import { TestBed } from '@angular/core/testing';

import type { FieldAccess, FillSurface } from '../../mascot/fill/descriptor';
import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { CursorService } from '../cursor.service';
import { QuestionService, YES } from '../question.service';
import { WriteWatchService } from '../write-watch.service';
import { runSave } from './save.run';

describe('runSave', () => {
  let fill: MascotFillService;
  let cursor: CursorService;
  let questions: QuestionService;
  let writes: WriteWatchService;
  let host: HTMLElement;
  let values: Record<string, unknown>;
  let access: FieldAccess;

  const SURFACE: FillSurface = {
    id: 'measurement',
    tools: [],
    fields: [{ key: 'weightKg', kind: 'number', from: [] }],
  };

  const register = (surface: FillSurface = SURFACE) =>
    TestBed.runInInjectionContext(() => fill.register(surface, access));

  const run = (surface: FillSurface = SURFACE, signal = new AbortController().signal) =>
    runSave(surface, access, { fill, questions, writes, cursor, signal });

  /** La mascota viaja hasta el botón antes de preguntar. */
  const waitForQuestion = async () => {
    for (let tries = 0; tries < 60 && questions.current() === null; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return questions.current();
  };

  beforeEach(() => {
    fill = TestBed.inject(MascotFillService);
    cursor = TestBed.inject(CursorService);
    questions = TestBed.inject(QuestionService);
    writes = TestBed.inject(WriteWatchService);
    writes.reset();
    host = document.createElement('div');
    host.innerHTML = '<button data-mascot-submit="measurement">Guardar</button>';
    document.body.appendChild(host);
    values = { weightKg: 70 };
    access = {
      get: (key) => values[key],
      set: (key, value) => {
        values[key] = value;
      },
    };
  });

  afterEach(() => host.remove());

  const button = () => host.querySelector('button')!;

  it('NO pulsa sin un sí explícito', async () => {
    register();
    const clicked = spyOn(button(), 'click');

    const pending = run();
    await waitForQuestion();
    expect(clicked).not.toHaveBeenCalled();

    questions.decline();
    expect(await pending).toEqual({ ok: false, reason: 'user_declined' });
    expect(clicked).not.toHaveBeenCalled();
  });

  it('la pregunta dice qué se va a guardar', async () => {
    register();
    const pending = run();
    expect((await waitForQuestion())?.text).toBe('weightKg: 70');
    questions.decline();
    await pending;
  });

  it('con el sí pulsa, y se da por guardado cuando la escritura sale bien', async () => {
    register();
    const clicked = spyOn(button(), 'click').and.callFake(() => writes.last.set({ ok: true, status: 200 }));

    const pending = run();
    await waitForQuestion();
    questions.answer(YES);

    expect(await pending).toEqual({ ok: true, saved: true });
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('un formulario que guarda SIN cerrarse también cuenta como guardado', async () => {
    register();
    // Los ajustes del centro guardan en su sitio: no se cierra ningún diálogo
    // ni se desmonta nada, y aun así se guardó.
    button().addEventListener('click', () => writes.last.set({ ok: true, status: 204 }));

    const pending = run();
    await waitForQuestion();
    questions.answer(YES);
    expect(await pending).toEqual({ ok: true, saved: true });
  });

  it('una escritura que el servidor rechaza no se cuenta como guardada', async () => {
    register();
    button().addEventListener('click', () => writes.last.set({ ok: false, status: 409 }));

    const pending = run();
    await waitForQuestion();
    questions.answer(YES);

    const result = await pending;
    expect(result.ok).toBeFalse();
    expect(result['saved']).toBeFalse();
    expect(result['status']).toBe(409);
  });

  it('si la persona guarda mientras se le pregunta, no se pulsa dos veces', async () => {
    register();
    let presses = 0;
    button().addEventListener('click', () => {
      presses += 1;
      writes.last.set({ ok: true, status: 200 });
    });

    const pending = run();
    await waitForQuestion();
    // La persona pulsa Guardar ella misma: eso ya es el sí, ejecutado.
    button().click();

    expect(await pending).toEqual({ ok: true, saved: true });
    expect(presses).toBe(1);
  });

  it('un error del formulario se cuenta, en vez de dar el guardado por hecho', async () => {
    register();
    button().addEventListener('click', () => {
      const error = document.createElement('p');
      error.setAttribute('role', 'alert');
      error.textContent = 'El peso debe ser menor de 400';
      host.appendChild(error);
    });

    const pending = run();
    await waitForQuestion();
    questions.answer(YES);

    const result = await pending;
    expect(result.ok).toBeFalse();
    expect(result['errors']).toEqual(['El peso debe ser menor de 400']);
  });

  it('un botón deshabilitado dice lo que falta, no se fuerza', async () => {
    register();
    button().setAttribute('disabled', '');
    access.missingRequired = () => ['date'];

    const result = await run();
    expect(result.ok).toBeFalse();
    expect(result['reason']).toBe('control_disabled');
    expect(result['missingRequired']).toEqual(['date']);
  });

  it('sin botón de guardar no se busca uno cualquiera por la página', async () => {
    host.innerHTML = '<button>Otro botón primario</button>';
    register();
    expect(await run()).toEqual({ ok: false, reason: 'control_gone' });
  });

  it('un formulario excluido no se guarda ni aunque se le llame a mano', async () => {
    const excluded = { ...SURFACE, id: 'clinical-status', noSave: true };
    host.innerHTML = '<button data-mascot-submit="clinical-status">Guardar</button>';
    const clicked = spyOn(button(), 'click');
    register(excluded);

    expect(await run(excluded)).toEqual({ ok: false, reason: 'unknown_tool' });
    expect(clicked).not.toHaveBeenCalled();
  });

  it('detener el turno no guarda nada', async () => {
    register();
    const clicked = spyOn(button(), 'click');
    expect(await run(SURFACE, AbortSignal.abort())).toEqual({ ok: false, reason: 'user_declined' });
    expect(clicked).not.toHaveBeenCalled();
  });
});
