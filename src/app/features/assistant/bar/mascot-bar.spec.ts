import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { FIRST_STEPS_KEY } from '../mascot/first-steps';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { QuestionService } from '../copilot/question.service';
import { MascotStateService } from '../mascot-state.service';
import { MascotBar } from './mascot-bar';

describe('MascotBar', () => {
  let fixture: ComponentFixture<MascotBar>;
  let state: MascotStateService;
  let questions: QuestionService;

  const text = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  beforeEach(() => {
    // Estos tests miran la tarjeta, no el estreno: las primeras ofertas sólo
    // salen una vez y aquí estorban.
    localStorage.setItem(FIRST_STEPS_KEY, '1');
    TestBed.configureTestingModule({
      imports: [
        MascotBar,
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              assistant: {
                thinking: 'Pensando…',
                paused: 'En pausa',
                step_of: 'Paso {{n}}/{{max}}',
                placeholder: 'Pídeme algo…',
                queue_placeholder: 'Añade otra instrucción…',
                answer_placeholder: 'Escribe tu respuesta…',
              },
            },
          },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        NG_EVENT_PLUGINS,
        {
          provide: TenantContextService,
          useValue: {
            currentTenantId: () => 't1',
            currentMembership: () => ({ tenantId: 't1', roleCode: 'NUTRITIONIST', userType: 'STAFF', permissions: [] }),
            permissions: () => new Set<string>(),
            hasPermission: () => true,
          },
        },
      ],
    });
    state = TestBed.inject(MascotStateService);
    questions = TestBed.inject(QuestionService);
    fixture = TestBed.createComponent(MascotBar);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.removeItem(FIRST_STEPS_KEY));

  /** Desplegar la tarjeta, que es lo que hace pulsar la mascota. */
  const openBar = () => {
    state.open.set(true);
    fixture.detectChanges();
  };

  const el = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector);

  it('cerrada no hay tarjeta: sólo queda la mascota en su esquina', () => {
    expect(el('.card')).toBeNull();
  });

  it('se despliega sola cuando hay algo que no puede esperar', () => {
    state.sending.set(true);
    fixture.detectChanges();
    expect(el('.card')).not.toBeNull();
  });

  it('en reposo la tarjeta se encoge a una pastilla, sin nada más', () => {
    openBar();
    expect(el('.card--pill')).not.toBeNull();
    expect(el('.say')).toBeNull();
    expect(el('.doing')).toBeNull();
  });

  it('mientras trabaja dice qué hace, y deja de ser una pastilla', () => {
    state.sending.set(true);
    fixture.detectChanges();
    expect(text('.doing__text')).toBe('Pensando…');
    expect(el('.card--pill')).toBeNull();
    expect(text('.doing__step')).toBeNull();
  });

  it('mientras trabaja, el campo dice que lo que escribas se encola', () => {
    openBar();
    expect((el('textarea') as HTMLTextAreaElement).placeholder).toBe('Pídeme algo…');
    state.sending.set(true);
    fixture.detectChanges();
    expect((el('textarea') as HTMLTextAreaElement).placeholder).toBe('Añade otra instrucción…');
  });

  it('pausar y detener están junto a lo que hace, no junto a lo que escribes', () => {
    openBar();
    expect(el('.icon--pause')).toBeNull();
    state.sending.set(true);
    fixture.detectChanges();
    expect(el('.doing .icon--pause')).not.toBeNull();
    expect(el('.doing .icon--stop')).not.toBeNull();
  });

  it('la pregunta se lee en la tarjeta, con qué contestarla debajo', () => {
    state.sending.set(true);
    void questions.ask({ kind: 'confirm', text: '¿Lo guardo?' });
    fixture.detectChanges();

    expect(text('.say__text')).toBe('¿Lo guardo?');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.answers .chip').length).toBe(2);
  });

  it('lo que no se deshace se tiñe', () => {
    void questions.ask({ kind: 'confirm', text: '¿La borro?', dangerous: true });
    fixture.detectChanges();
    expect(el('.say--danger')).not.toBeNull();
  });

  it('una pregunta abierta ofrece sus opciones', () => {
    void questions.ask({ kind: 'ask', text: '¿Qué día?', options: ['lunes', 'martes'] });
    fixture.detectChanges();
    const chips = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.answers .chip'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['lunes', 'martes']);
  });

  it('cerrar una pregunta es decir que no: dejarla abierta colgaría el turno', async () => {
    const answer = questions.ask({ kind: 'confirm', text: '¿Lo guardo?' });
    fixture.detectChanges();
    (el('.say__close') as HTMLButtonElement).click();

    expect(await answer).toEqual({ ok: false, reason: 'declined' });
  });

  it('en pausa lo dice, aunque esté trabajando', () => {
    state.sending.set(true);
    state.cursor.pause();
    fixture.detectChanges();
    expect(text('.doing__text')).toBe('En pausa');
  });

  it('la cola se ve, con qué hacer con cada cosa', () => {
    openBar();
    state.queued.set(['y apunta la analítica']);
    fixture.detectChanges();
    expect(text('.queued__text')).toBe('y apunta la analítica');
    expect(text('.queued__act')).not.toBeNull();
  });

  describe('el consentimiento', () => {
    beforeEach(() => {
      state.consentRequired.set(true);
      openBar();
    });

    it('se ve, y es lo primero: sin él `send()` descarta el mensaje en silencio', () => {
      expect(el('.consent')).not.toBeNull();
    });

    it('mientras falta, enviar está apagado: nada de tragarse el mensaje', () => {
      (fixture.componentInstance as unknown as { text: { set(v: string): void } }).text.set('hola');
      fixture.detectChanges();
      expect((el('.icon--send') as HTMLButtonElement).disabled).toBeTrue();
    });

    it('aceptar y rechazar están conectados', () => {
      const accept = spyOn(state, 'acceptConsent');
      const decline = spyOn(state, 'declineConsent');
      (el('.consent .chip--primary') as HTMLButtonElement).click();
      expect(accept).toHaveBeenCalled();
      (el('.consent .chip:not(.chip--primary)') as HTMLButtonElement).click();
      expect(decline).toHaveBeenCalled();
    });

    it('mientras falta no se saluda ni se sugiere nada', () => {
      expect(el('.say')).toBeNull();
    });
  });

  it('pulsar la mascota abre, pero NO cierra: para eso está el botón de plegar', () => {
    // `toggle` sólo hace algo con el asistente encendido para este centro.
    state.config.set({ enabled: true } as never);
    state.toggle();
    expect(state.open()).toBeTrue();
    // Otra pulsación no la cierra: cerrarla podría tirar una respuesta a
    // medio leer, y convertiría cada clic en una apuesta.
    state.toggle();
    expect(state.open()).toBeTrue();
  });

  it('el botón de plegar sí cierra', () => {
    openBar();
    (el('.icon[aria-label="assistant.hide"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(state.open()).toBeFalse();
  });

  it('el armario se abre desde la barra', () => {
    openBar();
    (el('.icon[aria-label="assistant.wardrobe"]') as HTMLButtonElement).click();
    expect(state.wardrobeOpen()).toBeTrue();
  });

  it('el armario y el plegar desaparecen mientras trabaja', () => {
    openBar();
    expect(el('.icon[aria-label="assistant.wardrobe"]')).not.toBeNull();
    state.sending.set(true);
    fixture.detectChanges();
    expect(el('.icon[aria-label="assistant.wardrobe"]')).toBeNull();
    expect(el('.icon[aria-label="assistant.hide"]')).toBeNull();
  });

  it('al cerrar se enrolla antes de desmontarse, y luego suelta el acople', fakeAsync(() => {
    openBar();
    expect(el('.card')).not.toBeNull();

    state.open.set(false);
    fixture.detectChanges();

    // La tarjeta sigue en el DOM, con la animación de salida.
    expect(el('.card--leaving')).not.toBeNull();
    expect(el('.card')).not.toBeNull();

    tick(720);
    fixture.detectChanges();

    expect(el('.card')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--mascot-dock-right')).toBe('');
  }));

  it('si la mascota sale a trabajar, marca su hueco y pliega la fila de escribir', fakeAsync(() => {
    const fill = TestBed.inject(MascotFillService);
    openBar();

    fill.begin();
    fixture.detectChanges();

    expect(el('.card__dock-ghost')).not.toBeNull();
    expect(el('.input--folded')).not.toBeNull();

    // El puntero sobre la tarjeta la despliega.
    el('.card')!.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(el('.input--folded')).toBeNull();

    fill.end();
  }));

  it('no oscila cuando el campo cae en la franja que descubre la compactación', fakeAsync(() => {
    const fill = TestBed.inject(MascotFillService);
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const component = fixture.componentInstance as unknown as { compact(): boolean };

    // Un campo cuyo borde derecho queda entre el borde de la barra a 560 y a
    // 400: con el ancho compacto dejaría de solapar y la barra volvería a
    // crecer. Es justo la franja que provoca la oscilación.
    const target = document.createElement('div');
    target.getBoundingClientRect = () =>
      ({ left: vw - 500, top: vh - 100, width: 40, height: 30, right: vw - 460, bottom: vh - 70 }) as DOMRect;

    state.sending.set(true);
    fixture.detectChanges();

    const card = el('.card') as HTMLElement;
    card.getBoundingClientRect = () => {
      const width = component.compact() ? 400 : 560;
      return {
        left: vw - width - 24,
        top: vh - 224,
        width,
        height: 200,
        right: vw - 24,
        bottom: vh - 24,
      } as DOMRect;
    };

    fill.target.set(target);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();

    expect(component.compact()).toBeTrue();

    // Otra medición, ya con la tarjeta a 400: el ancho de referencia sigue
    // siendo el completo y no se vuelve a crecer.
    state.queued.set(['otra instrucción']);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();

    expect(component.compact()).toBeTrue();

    fill.end();
    state.queued.set([]);
  }));

  it('enfocar la tarjeta también despliega la fila plegada', fakeAsync(() => {
    const fill = TestBed.inject(MascotFillService);
    openBar();
    fill.begin();
    fixture.detectChanges();
    expect(el('.input--folded')).not.toBeNull();

    el('.card')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    expect(el('.input--folded')).toBeNull();

    fill.end();
  }));

  it('cuando se compacta, el host y la tarjeta llevan su clase', () => {
    openBar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('is-compact')).toBeFalse();

    (fixture.componentInstance as unknown as { compact: { set(value: boolean): void } }).compact.set(true);
    fixture.detectChanges();

    expect(host.classList.contains('is-compact')).toBeTrue();
    expect(el('.card')!.classList.contains('card--compact')).toBeTrue();
  });

  it('enviar está apagado hasta que hay algo que enviar', () => {
    openBar();
    expect((el('.icon--send') as HTMLButtonElement).disabled).toBeTrue();
    (fixture.componentInstance as unknown as { text: { set(v: string): void } }).text.set('hola');
    fixture.detectChanges();
    expect((el('.icon--send') as HTMLButtonElement).disabled).toBeFalse();
  });

  describe('escribir con una pregunta en el aire', () => {
    const bar = () =>
      fixture.componentInstance as unknown as { text: { set(v: string): void }; submit(): void };

    it('una pregunta abierta se contesta escribiendo: lo escrito es la respuesta', async () => {
      openBar();
      const answer = questions.ask({ kind: 'ask', text: '¿Qué día te viene bien?' });
      const send = spyOn(state, 'send');
      fixture.detectChanges();
      expect((el('textarea') as HTMLTextAreaElement).placeholder).toBe('Escribe tu respuesta…');

      bar().text.set('el martes por la tarde');
      bar().submit();

      expect(await answer).toEqual({ ok: true, value: 'el martes por la tarde' });
      expect(send).not.toHaveBeenCalled();
    });

    it('con opciones también se puede contestar con palabras propias', async () => {
      openBar();
      const answer = questions.ask({ kind: 'ask', text: '¿Cuál?', options: ['Ana', 'Marta'] });
      fixture.detectChanges();

      bar().text.set('ninguna, es otra');
      bar().submit();

      expect(await answer).toEqual({ ok: true, value: 'ninguna, es otra' });
    });

    it('escribir en vez de confirmar es un no, y lo escrito sigue como mensaje', async () => {
      openBar();
      const answer = questions.ask({ kind: 'confirm', text: '¿Lo guardo?' });
      const send = spyOn(state, 'send');
      fixture.detectChanges();

      bar().text.set('cámbiale la hora antes');
      bar().submit();

      expect(await answer).toEqual({ ok: false, reason: 'declined' });
      expect(send).toHaveBeenCalledWith('cámbiale la hora antes');
    });

    it('sin pregunta, escribir sigue siendo mandar un mensaje', () => {
      openBar();
      const send = spyOn(state, 'send');

      bar().text.set('hola');
      bar().submit();

      expect(send).toHaveBeenCalledWith('hola');
    });
  });
});
