import { TestBed } from '@angular/core/testing';

import { PersonSaveService, SEND_GRACE_MS, errorsNear } from './person-save.service';
import { WriteWatchService } from './write-watch.service';

describe('PersonSaveService', () => {
  let saves: PersonSaveService;
  let writes: WriteWatchService;
  let host: HTMLElement;

  beforeEach(() => {
    saves = TestBed.inject(PersonSaveService);
    writes = TestBed.inject(WriteWatchService);
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  const button = (html: string): HTMLElement => {
    host.innerHTML = html;
    return host.querySelector('button') as HTMLElement;
  };

  describe('qué cuenta como pulsar Guardar', () => {
    it('un botón marcado con data-mascot-submit, una sola vez', () => {
      const pressed: string[] = [];
      const save = button('<button data-mascot-submit="appointment"><span>Guardar</span></button>');
      const stop = saves.watch((b) => pressed.push(b.textContent ?? ''));

      (save.querySelector('span') as HTMLElement).click();
      save.click();
      stop();

      expect(pressed).toEqual(['Guardar']);
    });

    it('no un botón cualquiera', () => {
      const onPress = jasmine.createSpy('onPress');
      const other = button('<button>Cancelar</button>');
      const stop = saves.watch(onPress);
      other.click();
      stop();
      expect(onPress).not.toHaveBeenCalled();
    });

    it('no un Guardar deshabilitado: ese clic no manda nada', () => {
      const onPress = jasmine.createSpy('onPress');
      const save = button('<button data-mascot-submit="meal" disabled>Guardar</button>');
      const stop = saves.watch(onPress);
      save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      stop();
      expect(onPress).not.toHaveBeenCalled();
    });

    it('al dejar de escuchar ya no cuenta', () => {
      const onPress = jasmine.createSpy('onPress');
      const save = button('<button data-mascot-submit="meal">Guardar</button>');
      saves.watch(onPress)();
      save.click();
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('cómo acabó', () => {
    it('guardado si la escritura volvió bien', async () => {
      const save = button('<button data-mascot-submit="meal">Guardar</button>');
      const outcome = saves.outcome(save);
      writes.inFlight.set(1);
      writes.inFlight.set(0);
      writes.last.set({ ok: true, status: 200 });
      expect(await outcome).toEqual({ saved: true, status: 200 });
    });

    it('rechazado si el servidor dijo que no', async () => {
      const save = button('<button data-mascot-submit="meal">Guardar</button>');
      const outcome = saves.outcome(save);
      writes.last.set({ ok: false, status: 409 });
      expect(await outcome).toEqual({ saved: false, reason: 'rejected', status: 409 });
    });

    it('no espera a dar el resultado mientras la petición sigue fuera', async () => {
      const save = button('<button data-mascot-submit="meal">Guardar</button>');
      const outcome = saves.outcome(save);
      writes.inFlight.set(1);
      await new Promise((resolve) => setTimeout(resolve, SEND_GRACE_MS + 200));
      writes.inFlight.set(0);
      writes.last.set({ ok: true, status: 201 });
      expect(await outcome).toEqual({ saved: true, status: 201 });
    });

    it('si el botón no mandó nada, son los errores del formulario', async () => {
      const save = button(
        '<form><tui-error>La hora es obligatoria</tui-error><button data-mascot-submit="meal">Guardar</button></form>',
      );
      expect(await saves.outcome(save)).toEqual({
        saved: false,
        reason: 'form_has_errors',
        errors: ['La hora es obligatoria'],
      });
    });
  });

  it('si no mandó nada y no hay errores a la vista, no se envió', async () => {
    const save = button('<button data-mascot-submit="appointment-status">Atendida</button>');
    expect(await saves.outcome(save)).toEqual({ saved: false, reason: 'not_sent' });
  });

  it('si el botón abre un «¿seguro?», espera a que lo conteste', async () => {
    const save = button('<button data-mascot-submit="appointment-status">Cancelar cita</button>');
    const confirm = document.createElement('div');
    confirm.setAttribute('role', 'dialog');
    const outcome = saves.outcome(save);
    document.body.appendChild(confirm);

    await new Promise((resolve) => setTimeout(resolve, SEND_GRACE_MS + 300));
    confirm.remove();
    writes.last.set({ ok: true, status: 200 });

    expect(await outcome).toEqual({ saved: true, status: 200 });
  });

  it('los errores se buscan sólo en el formulario del botón', () => {
    host.innerHTML =
      '<tui-error>De otra pantalla</tui-error><form><tui-error> Falta  el tipo </tui-error><button>Guardar</button></form>';
    expect(errorsNear(host.querySelector('button') as HTMLElement)).toEqual(['Falta el tipo']);
  });
});
