import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { MascotFillService } from './mascot/fill/mascot-fill.service';
import { MascotMoodService } from './mascot/mascot-mood.service';
import { MascotPreferencesService } from './mascot/mascot-preferences.service';
import { MascotStateService } from './mascot-state.service';
import { GAP_MS, STUCK_MS, StuckFormOfferService } from './stuck-form-offer.service';

const TEXTS = {
  assistant: {
    stuck_title: '¿Te atascaste?',
    stuck_text: 'Puedo ayudarte con {{fields}}.',
    stuck_text_plain: 'Puedo ayudarte a terminar este formulario.',
    stuck_help: 'Ayúdame',
    stuck_not_now: 'Ahora no',
    stuck_never: 'No me lo digas más',
    stuck_ask: 'Me da error en: {{fields}}.',
  },
};

/** El estado de la mascota, con lo justo para decidir si puede ofrecerse. */
function stateStub() {
  return {
    visible: signal(true),
    open: signal(false),
    wardrobeOpen: signal(false),
    sending: signal(false),
    resolvingAction: signal(false),
    pendingAction: signal(null),
    openPanel: jasmine.createSpy('openPanel'),
    send: jasmine.createSpy('send'),
  };
}

/** Las preferencias del usuario, con lo justo para encender o apagar la oferta. */
function preferencesStub() {
  const stuckOffer = signal(true);
  return {
    stuckOffer,
    disableStuckOffer: jasmine
      .createSpy('disableStuckOffer')
      .and.callFake(() => stuckOffer.set(false)),
  };
}

describe('la mascota se ofrece cuando te atascas en un formulario', () => {
  let service: StuckFormOfferService;
  let mood: MascotMoodService;
  let state: ReturnType<typeof stateStub>;
  let preferences: ReturnType<typeof preferencesStub>;
  let form: HTMLFormElement;

  /**
   * Un formulario como los de la aplicación: el campo en rojo, su `<tui-error>`
   * —que Angular marca con las mismas clases, porque es un `ControlValueAccessor`
   * más— y otro campo correcto.
   */
  function buildForm(): HTMLFormElement {
    const element = document.createElement('form');
    element.innerHTML = `
      <label for="peso">Peso</label>
      <input id="peso" formcontrolname="peso" class="ng-invalid ng-touched" />
      <tui-error formcontrolname="peso" class="ng-invalid ng-touched"></tui-error>
      <label for="altura">Altura</label>
      <input id="altura" formcontrolname="altura" class="ng-valid ng-touched" />
    `;
    document.body.appendChild(element);
    return element;
  }

  const field = (id: string) => form.querySelector<HTMLInputElement>(`#${id}`)!;
  const fix = (id: string) => {
    for (const element of form.querySelectorAll(`#${id}, [formcontrolname="${id}"]`)) {
      element.classList.replace('ng-invalid', 'ng-valid');
    }
  };
  const act = (type: 'input' | 'keydown') =>
    field('peso').dispatchEvent(new Event(type, { bubbles: true }));

  beforeEach(() => {
    state = stateStub();
    preferences = preferencesStub();
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: TEXTS },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
          // Sin esto `translate()` devuelve la clave: el idioma no está cargado
          // todavía cuando el servicio pregunta.
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: MascotStateService, useValue: state },
        { provide: MascotFillService, useValue: { filling: signal(false) } },
        { provide: MascotPreferencesService, useValue: preferences },
      ],
    });
    service = TestBed.inject(StuckFormOfferService);
    mood = TestBed.inject(MascotMoodService);
    form = buildForm();
  });

  afterEach(() => form.remove());

  it('se ofrece tras un rato parado con el campo en rojo delante', fakeAsync(() => {
    field('peso').focus();
    service.start();

    tick(STUCK_MS - 1);
    expect(mood.note()).toBeNull();

    tick(1);
    expect(mood.note()?.title).toBe('¿Te atascaste?');
    // El nombre del campo sale de su etiqueta, no de su id.
    expect(mood.note()?.text).toBe('Puedo ayudarte con Peso.');
    expect(mood.note()?.tone).toBe('danger');
  }));

  it('no cuenta dos veces el campo por culpa de su mensaje de error', fakeAsync(() => {
    field('peso').focus();
    service.start();
    tick(STUCK_MS);

    // Sin descartar el `<tui-error>` esto diría "Peso, peso".
    expect(mood.note()?.text).toBe('Puedo ayudarte con Peso.');
  }));

  it('la oferta espera: no se va sola como una nota cualquiera', fakeAsync(() => {
    field('peso').focus();
    service.start();
    tick(STUCK_MS);

    tick(GAP_MS);
    expect(mood.note()).not.toBeNull();
  }));

  it('no se ofrece si no hay ningún campo en rojo', fakeAsync(() => {
    fix('peso');
    field('peso').focus();
    service.start();

    tick(STUCK_MS);
    expect(mood.note()).toBeNull();
  }));

  it('no se ofrece si el foco está fuera del formulario', fakeAsync(() => {
    service.start();

    tick(STUCK_MS);
    expect(mood.note()).toBeNull();
  }));

  it('seguir escribiendo reinicia la cuenta', fakeAsync(() => {
    field('peso').focus();
    service.start();

    tick(STUCK_MS - 1000);
    act('input');
    tick(STUCK_MS - 1000);
    expect(mood.note()).toBeNull();

    tick(1000);
    expect(mood.note()).not.toBeNull();
  }));

  it('no insiste con el mismo formulario', fakeAsync(() => {
    field('peso').focus();
    service.start();
    tick(STUCK_MS);

    mood.unsay();
    act('keydown');
    tick(STUCK_MS);
    expect(mood.note()).toBeNull();
  }));

  it('no se ofrece mientras ya estás hablando con ella', fakeAsync(() => {
    state.open.set(true);
    field('peso').focus();
    service.start();

    tick(STUCK_MS);
    expect(mood.note()).toBeNull();
  }));

  it('se retira sola si arreglas el campo', fakeAsync(() => {
    field('peso').focus();
    service.start();
    tick(STUCK_MS);
    expect(mood.note()).not.toBeNull();

    fix('peso');
    act('input');
    expect(mood.note()).toBeNull();
  }));

  it('"ayúdame" abre el panel y le cuenta qué campos fallan', fakeAsync(() => {
    field('peso').focus();
    service.start();
    tick(STUCK_MS);

    const help = mood.note()?.actions?.[0];
    expect(help?.label).toBe('Ayúdame');
    help?.run();

    expect(state.openPanel).toHaveBeenCalled();
    expect(state.send).toHaveBeenCalledWith('Me da error en: Peso.');
  }));

  it('"no me lo digas más" queda dicho en el centro, no en el navegador', fakeAsync(() => {
    field('peso').focus();
    service.start();
    tick(STUCK_MS);

    const never = mood.note()?.actions?.find((action) => action.label === 'No me lo digas más');
    never?.run();
    mood.unsay();

    expect(preferences.disableStuckOffer).toHaveBeenCalled();

    // Ni en este formulario ni en otro nuevo: ya no hay reloj que armar.
    form.remove();
    form = buildForm();
    field('peso').focus();
    act('input');
    tick(STUCK_MS);
    expect(mood.note()).toBeNull();
  }));

  it('con la preferencia apagada no se ofrece', fakeAsync(() => {
    preferences.stuckOffer.set(false);
    field('peso').focus();
    service.start();

    tick(STUCK_MS);
    expect(mood.note()).toBeNull();
  }));

  it('volver a encenderla la devuelve sin recargar', fakeAsync(() => {
    preferences.stuckOffer.set(false);
    field('peso').focus();
    service.start();
    tick(STUCK_MS);
    expect(mood.note()).toBeNull();

    preferences.stuckOffer.set(true);
    act('input');
    tick(STUCK_MS);
    expect(mood.note()).not.toBeNull();
  }));
});
