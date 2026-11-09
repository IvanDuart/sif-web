import { TestBed } from '@angular/core/testing';

import { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import { CursorService } from '../cursor.service';
import { QuestionService, YES } from '../question.service';
import { runPress } from './press.run';

describe('runPress', () => {
  let fill: MascotFillService;
  let cursor: CursorService;
  let questions: QuestionService;
  let host: HTMLElement;

  const run = (control: string, signal = new AbortController().signal) =>
    runPress({ control }, { fill, questions, cursor, signal });

  const mount = (html: string) => {
    host.innerHTML = html;
    return host.querySelector('button')!;
  };

  /** La mascota viaja hasta el control antes de preguntar: hay que dejarla llegar. */
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
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  it('pulsa lo que está marcado', async () => {
    const button = mount('<button data-mascot-point="new">Nueva cita</button>');
    const clicked = spyOn(button, 'click');
    const result = await run('new');
    expect(result.ok).toBeTrue();
    expect(clicked).toHaveBeenCalled();
  });

  it('al terminar deja el anillo de pulsación apagado', async () => {
    mount('<button data-mascot-point="new">Nueva cita</button>');

    expect((await run('new')).ok).toBeTrue();

    expect(fill.presses()).toBe(0);
  });

  it('lo que no está marcado no se pulsa, aunque exista', async () => {
    const button = mount('<button>Eliminar</button>');
    const clicked = spyOn(button, 'click');
    expect(await run('delete')).toEqual({ ok: false, reason: 'control_gone', control: 'delete' });
    expect(clicked).not.toHaveBeenCalled();
  });

  it('un botón deshabilitado se dice, no se fuerza', async () => {
    mount('<button data-mascot-point="save" disabled>Guardar</button>');
    expect(await run('save')).toEqual({ ok: false, reason: 'control_disabled', control: 'save' });
  });

  it('lo que no se deshace no se pulsa sin un sí', async () => {
    const button = mount('<button data-mascot-point="del">Eliminar paciente</button>');
    const clicked = spyOn(button, 'click');

    const pending = run('del');
    // La pregunta sale antes de pulsar nada.
    expect((await waitForQuestion())?.dangerous).toBeTrue();
    expect(clicked).not.toHaveBeenCalled();

    questions.decline();
    expect(await pending).toEqual({ ok: false, reason: 'user_declined', control: 'del' });
    expect(clicked).not.toHaveBeenCalled();
  });

  it('con el sí explícito sí se pulsa', async () => {
    const button = mount('<button data-mascot-point="del">Eliminar paciente</button>');
    const clicked = spyOn(button, 'click');

    const pending = run('del');
    await waitForQuestion();
    questions.answer(YES);
    expect((await pending).ok).toBeTrue();
    expect(clicked).toHaveBeenCalled();
  });

  it('si la aplicación abre SU confirmación, la mascota no la atraviesa', async () => {
    const button = mount('<button data-mascot-point="archive">Marcar como hecha</button>');
    button.addEventListener('click', () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.textContent = '¿Seguro?';
      host.appendChild(dialog);
    });

    const result = await run('archive');
    expect(result).toEqual({
      ok: false,
      reason: 'opened_dialog',
      control: 'archive',
      label: 'Marcar como hecha',
    });
  });

  it('detener el turno antes de pulsar deja la pantalla como estaba', async () => {
    const button = mount('<button data-mascot-point="new">Nueva cita</button>');
    const clicked = spyOn(button, 'click');
    expect(await run('new', AbortSignal.abort())).toEqual({ ok: false, reason: 'user_declined' });
    expect(clicked).not.toHaveBeenCalled();
  });
});
