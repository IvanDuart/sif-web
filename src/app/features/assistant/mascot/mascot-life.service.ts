import { Injectable, computed, effect, signal, untracked } from '@angular/core';

import { createClickBurstDetector, createPettingDetector } from './lifeDetectors';

/** Lo que la mascota hace por su cuenta, además de su estado. */
export type MascotLife =
  /** Medio dormida, abre UN ojo y mira alrededor. */
  | { kind: 'peek'; eye: 0 | 1; dx: number; dy: number }
  /** Ojos abiertos, un giro completo sobre sí misma. */
  | { kind: 'spin' }
  /** Pulsada demasiadas veces: mareada. */
  | { kind: 'dizzy' }
  /** Acariciada rápido: se sonroja. */
  | { kind: 'blush' }
  /** Seguís pulsando mientras está mareada: se enoja. */
  | { kind: 'angry' }
  /** Esperando una respuesta mucho tiempo: saca el teléfono. `glance`: mira arriba por si volvió la persona. */
  | { kind: 'phone'; glance: boolean }
  /** La persona se fue (pestaña oculta): se duerme hasta que vuelve. */
  | { kind: 'sleep' };

export type MascotMode =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'acting'
  | 'confirm'
  | 'paused'
  | 'done'
  | 'reading'
  | 'wardrobe'
  | 'happy'
  | 'confused'
  | 'sleeping';

/** Gestos ambientales: el primero tras 1.2-3 s, luego uno cada 2.6-6.1 s. */
const FIRST_MS = 1200;
const FIRST_RANGE_MS = 1800;
const MIN_GAP_MS = 2600;
const GAP_RANGE_MS = 3500;
const SPIN_MS = 1250;

/** Esperando esto por una respuesta, saca el teléfono. */
export const PHONE_AFTER_MS = 20_000;
const GLANCE_GAP_MS = 2800;
const GLANCE_RANGE_MS = 2200;
const GLANCE_MS = 1100;

export const DIZZY_MS = 2400;
export const BLUSH_MS = 2600;
export const ANGRY_MS = 3200;
/** Pulsaciones que hacen falta, ya mareada, para enojarla. */
export const ANGRY_PRESSES = 3;

type Reaction = 'dizzy' | 'blush' | 'angry';
const REACTION_MS: Record<Reaction, number> = { dizzy: DIZZY_MS, blush: BLUSH_MS, angry: ANGRY_MS };

/** Los ojos mientras mira de reojo: [ms tras abrir, dx, dy], y cierra al final. */
const PEEK: readonly [number, number, number][] = [
  [450, -3, 0],
  [1000, 3, -1],
  [1600, 0, 1],
];
const PEEK_END_MS = 2300;

/** Solo una mascota en reposo o escuchando tiene tiempo para esto. */
const IDLE_MODES: readonly MascotMode[] = ['idle', 'listening'];

/**
 * La vida propia del orb. El componente le pasa el estado (`setMode`,
 * `setAwake`, `setStill`, `setAway`) y él decide qué gesto toca.
 */
@Injectable({ providedIn: 'root' })
export class MascotLifeService {
  readonly mode = signal<MascotMode>('idle');
  readonly awake = signal(false);
  readonly still = signal(false);
  readonly away = signal(false);

  private readonly reaction = signal<Reaction | null>(null);
  private readonly ambient = signal<MascotLife | null>(null);
  private readonly phone = signal<{ glance: boolean } | null>(null);

  /** Lo que la mascota está haciendo por su cuenta ahora mismo, o `null`. */
  readonly life = computed<MascotLife | null>(() => {
    const reaction = this.reaction();
    if (reaction) return { kind: reaction };
    const phone = this.phone();
    if (phone) return { kind: 'phone', ...phone };
    if (this.asleep()) return { kind: 'sleep' };
    return this.ambient();
  });

  private readonly clicks = createClickBurstDetector();
  private readonly petting = createPettingDetector();
  private dizzyPresses = 0;
  private reactionTimer: ReturnType<typeof setTimeout> | undefined;
  private phoneTimer: ReturnType<typeof setTimeout> | undefined;
  private phoneGlanceTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly asleep = computed(
    () =>
      this.mode() === 'idle' &&
      !this.awake() &&
      !this.still() &&
      !this.reaction() &&
      this.away(),
  );

  private readonly restless = computed(() => IDLE_MODES.includes(this.mode()) && !this.still());

  constructor() {
    // Gestos ambientales mientras descansa sin que nadie la toque.
    effect((onCleanup) => {
      const mode = this.mode();
      const awake = this.awake();
      const still = this.still();
      const away = this.away();
      const reaction = this.reaction();

      untracked(() => this.ambient.set(null));
      if (mode !== 'idle' || awake || still || reaction || away) return;

      const timers: ReturnType<typeof setTimeout>[] = [];
      const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
      const schedule = (first: boolean) => {
        later(first ? FIRST_MS + Math.random() * FIRST_RANGE_MS : MIN_GAP_MS + Math.random() * GAP_RANGE_MS, () => {
          if (Math.random() < 0.6) {
            const eye = Math.random() < 0.5 ? 0 : 1;
            this.ambient.set({ kind: 'peek', eye, dx: 0, dy: 0 });
            for (const [at, dx, dy] of PEEK) later(at, () => this.ambient.set({ kind: 'peek', eye, dx, dy }));
            later(PEEK_END_MS, () => {
              this.ambient.set(null);
              schedule(false);
            });
          } else {
            this.ambient.set({ kind: 'spin' });
            later(SPIN_MS, () => {
              this.ambient.set(null);
              schedule(false);
            });
          }
        });
      };
      schedule(true);

      onCleanup(() => {
        timers.forEach(clearTimeout);
        untracked(() => this.ambient.set(null));
      });
    });

    // Esperando mucho una respuesta: el teléfono; cualquier señal de atención lo guarda.
    effect((onCleanup) => {
      const mode = this.mode();
      const awake = this.awake();
      const still = this.still();

      untracked(() => this.phone.set(null));
      if (mode !== 'confirm' || awake || still) return;

      const timers: ReturnType<typeof setTimeout>[] = [];
      const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
      const glanceSoon = () =>
        later(GLANCE_GAP_MS + Math.random() * GLANCE_RANGE_MS, () => {
          this.phone.set({ glance: true });
          later(GLANCE_MS, () => {
            this.phone.set({ glance: false });
            glanceSoon();
          });
        });
      later(PHONE_AFTER_MS, () => {
        this.phone.set({ glance: false });
        glanceSoon();
      });

      onCleanup(() => timers.forEach(clearTimeout));
    });

    // Trabajando, preguntando o leyendo: lo que sentía termina y los detectores se reinician.
    effect(() => {
      if (this.restless()) return;
      untracked(() => {
        clearTimeout(this.reactionTimer);
        this.reaction.set(null);
        this.clicks.reset();
        this.petting.reset();
      });
    });
  }

  /** Registra una pulsación. `true` = se la traga (está mareada, o esta la mareó). */
  press(): boolean {
    if (!this.restless()) return false;

    const reaction = this.reaction();
    if (reaction === 'angry') return true;
    if (reaction === 'dizzy') {
      this.dizzyPresses += 1;
      if (this.dizzyPresses >= ANGRY_PRESSES) this.react('angry');
      return true;
    }
    if (!this.clicks.press(Date.now())) return false;
    this.react('dizzy');
    return true;
  }

  /** Registra el puntero moviéndose sobre ella. */
  move(x: number): void {
    if (!this.restless()) return;
    const reaction = this.reaction();
    if (reaction === 'dizzy' || reaction === 'angry') return;
    if (this.petting.move(x, Date.now())) this.react('blush');
  }

  /** El puntero se fue. */
  leave(): void {
    this.petting.reset();
  }

  private react(kind: Reaction): void {
    clearTimeout(this.reactionTimer);
    this.dizzyPresses = 0;
    this.reaction.set(kind);
    this.reactionTimer = setTimeout(() => this.reaction.set(null), REACTION_MS[kind]);
  }
}
