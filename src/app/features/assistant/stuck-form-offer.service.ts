import { DestroyRef, Injectable, inject } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import { MascotFillService } from './mascot/fill/mascot-fill.service';
import { MascotLifeService } from './mascot/mascot-life.service';
import { MascotMoodService, type NoteAction } from './mascot/mascot-mood.service';
import { MascotPreferencesService } from './mascot/mascot-preferences.service';
import { MascotStateService } from './mascot-state.service';

/**
 * La mascota se ofrece cuando la persona se atasca en un formulario.
 *
 * Qué cuenta como atascarse: el foco está dentro de un formulario que ya tiene
 * campos en rojo —inválidos **y tocados**, que es cuando el error se ve— y
 * durante `STUCK_MS` no se escribe ni se pulsa nada. Eso no es rellenar: es
 * estar mirando el error sin saber qué quiere.
 *
 * Lo que no hace, a propósito:
 * - No se ofrece dos veces por el mismo formulario, ni dos veces seguidas antes
 *   de `GAP_MS`, ni mientras la mascota está haciendo otra cosa.
 * - No se ofrece si el formulario lo está rellenando ella misma.
 * - Se retira sola si la persona arregla los campos o se va del formulario: una
 *   oferta que sobrevive al problema es ruido.
 *
 * El "no me lo vuelvas a decir" es ya una preferencia del usuario en el centro
 * (`MascotPreferencesService`), así que viaja entre navegadores. Se consulta en
 * cada vuelta en vez de una sola vez al arrancar: así apagarlo desde ajustes
 * surte efecto sin recargar, y volver a encenderlo también.
 */

/** Sin tocar nada este rato, con campos en rojo delante, se ofrece. */
export const STUCK_MS = 20_000;
/** Entre una oferta y la siguiente, pase lo que pase. */
export const GAP_MS = 10 * 60_000;

/** Lo que reinicia la cuenta: señales de que la persona sigue a lo suyo. */
const ACTIVITY = ['keydown', 'pointerdown', 'input', 'focusin'] as const;

/**
 * Un campo en rojo. `ng-invalid` + `ng-touched` las pone Angular en el propio
 * control, y es lo que hace visible al `<tui-error>` de al lado: mirar eso en
 * vez de clases de Taiga deja la detección atada al framework, no al tema.
 *
 * El `:not(tui-error)` no es cosmético. `TuiErrorDirective` casa con
 * `tui-error[formControlName]` **e implementa `ControlValueAccessor`**, así que
 * Angular trata al propio mensaje de error como un control más y le pone las
 * mismas clases que al campo. Sin descartarlo, cada campo en rojo se cuenta dos
 * veces y la mascota ofrece ayuda con "Peso, peso".
 */
const INVALID = [
  '[formControlName].ng-invalid.ng-touched:not(tui-error)',
  '[formControl].ng-invalid.ng-touched:not(tui-error)',
  '[ngModel].ng-invalid.ng-touched:not(tui-error)',
].join(',');

/** Cuántos nombres de campo caben en lo que se le cuenta al asistente. */
const FIELDS_IN_PROMPT = 4;

@Injectable({ providedIn: 'root' })
export class StuckFormOfferService {
  private readonly mood = inject(MascotMoodService);
  private readonly life = inject(MascotLifeService);
  private readonly state = inject(MascotStateService);
  private readonly fill = inject(MascotFillService);
  private readonly preferences = inject(MascotPreferencesService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;
  /** Suelta los listeners: lo que de verdad apaga esto. */
  private detach: (() => void) | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastOffer = -Infinity;
  /** Formularios por los que ya se ofreció: no se insiste con el mismo. */
  private readonly offered = new WeakSet<Element>();
  /** La oferta que está en pantalla, para poder retirarla si deja de hacer falta. */
  private showing: number | null = null;

  /** Empieza a mirar. Llamarlo dos veces no engancha dos veces. */
  start(): void {
    if (this.started) return;
    this.started = true;

    const restart = () => this.onActivity();
    for (const type of ACTIVITY) document.addEventListener(type, restart, true);
    this.detach = () => {
      clearTimeout(this.timer);
      for (const type of ACTIVITY) document.removeEventListener(type, restart, true);
      this.detach = undefined;
    };
    this.destroyRef.onDestroy(() => this.detach?.());

    this.onActivity();
  }

  private onActivity(): void {
    // Si la oferta sigue en pantalla pero el problema ya no está —los campos
    // arreglados, o el foco fuera—, se retira sin que nadie tenga que cerrarla.
    if (this.showing !== null && !this.stuckForm()) {
      this.mood.unsay(this.showing);
      this.showing = null;
    }

    clearTimeout(this.timer);
    // Apagado: ni se arma el reloj. Se mira aquí y no al arrancar porque la
    // preferencia llega del centro más tarde, y puede cambiar en marcha.
    if (!this.preferences.stuckOffer()) return;
    this.timer = setTimeout(() => this.offer(), STUCK_MS);
  }

  private offer(now = Date.now()): void {
    const form = this.stuckForm();
    if (!form || this.offered.has(form)) return;
    if (!this.preferences.stuckOffer() || this.isBusy() || now - this.lastOffer < GAP_MS) return;

    this.offered.add(form);
    this.lastOffer = now;

    const fields = this.invalidFieldNames(form);
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`assistant.${key}`, params);

    const actions: NoteAction[] = [
      {
        label: t('stuck_help'),
        primary: true,
        run: () => {
          this.state.openPanel();
          // Si el consentimiento está pendiente, `send` no hace nada y el panel
          // lo pide: la persona ve por qué, en vez de perder el mensaje.
          this.state.send(t('stuck_ask', { fields: fields.join(', ') }));
        },
      },
      { label: t('stuck_not_now'), run: () => undefined },
      { label: t('stuck_never'), run: () => this.optOut() },
    ];

    // Primero reclamarla: si estaba con el teléfono o dormida, lo deja.
    this.life.attend();
    this.mood.feel('worried');
    this.showing = this.mood.say({
      title: t('stuck_title'),
      text: fields.length ? t('stuck_text', { fields: fields.join(', ') }) : t('stuck_text_plain'),
      tone: 'danger',
      actions,
    });
  }

  /** El formulario en el que la persona está atascada ahora mismo, si lo hay. */
  private stuckForm(): Element | null {
    const active = document.activeElement;
    const form = active?.closest('form, [role="dialog"]') ?? null;
    return form?.querySelector(INVALID) ? form : null;
  }

  private invalidFieldNames(form: Element): string[] {
    return Array.from(form.querySelectorAll<HTMLElement>(INVALID))
      .map((field) => this.fieldName(form, field))
      .filter(Boolean)
      .slice(0, FIELDS_IN_PROMPT);
  }

  /** Cómo se llama ese campo para quien lo mira: su etiqueta antes que su id. */
  private fieldName(form: Element, field: HTMLElement): string {
    const id = field.getAttribute('id');
    const label = id ? form.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    return (
      label?.textContent?.trim() ||
      field.getAttribute('aria-label')?.trim() ||
      field.getAttribute('formcontrolname')?.trim() ||
      ''
    );
  }

  /**
   * Cuándo no se ofrece: porque no se la ve, porque ya está hablando con ella,
   * porque está trabajando, o porque ya está diciendo otra cosa.
   */
  private isBusy(): boolean {
    return (
      !this.state.visible() ||
      this.state.open() ||
      this.state.wardrobeOpen() ||
      this.state.sending() ||
      this.state.resolvingAction() ||
      this.state.pendingAction() !== null ||
      this.fill.filling() ||
      this.mood.note() !== null
    );
  }

  /**
   * Obedecer aquí y ahora —el reloj que estuviera armado se para— y que quede
   * dicho en el centro, para el resto de navegadores y para mañana.
   */
  private optOut(): void {
    clearTimeout(this.timer);
    this.preferences.disableStuckOffer();
  }
}
