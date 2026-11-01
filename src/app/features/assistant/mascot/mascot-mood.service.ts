import { Injectable, signal } from '@angular/core';

/**
 * Cómo se siente la mascota con lo que pasa en la plataforma, aparte de lo que
 * hace el asistente y de lo que hace por su cuenta.
 *
 * - `worried`: algo salió mal.
 * - `cheer`: algo que merece celebrarse.
 * - `highfive`: la persona le chocó los cinco tras un trabajo bien hecho.
 * - `welcome`: la persona volvió después de estar fuera.
 * - `proud`: trae algo que terminó mientras la persona estaba en otra cosa.
 *
 * Y dos condiciones que duran lo que dure su causa:
 * - `offline`: sin conexión.
 * - `tired`: sin créditos.
 */
export type MoodKind = 'worried' | 'cheer' | 'highfive' | 'welcome' | 'proud';
export type Condition = 'offline' | 'tired';

export const MOOD_MS: Record<MoodKind, number> = {
  worried: 3200,
  cheer: 3000,
  highfive: 1200,
  welcome: 2400,
  proud: 2600,
};

/**
 * Algo que se puede hacer desde la propia nota, sin abrir el panel.
 *
 * El `label` viene ya traducido: la nota no sabe de i18n, y quien la dice sí.
 */
export interface NoteAction {
  label: string;
  /** La que se ofrece de verdad. Como mucho una por nota. */
  primary?: boolean;
  run(): void;
}

/** Algo que la mascota dice por su cuenta (no es una respuesta del asistente). */
export interface MascotNote {
  id: number;
  /** El resumen, en pocas palabras. */
  title?: string;
  text: string;
  /** Su tono: neutro, algo malo o algo que celebrar. */
  tone?: 'neutral' | 'danger' | 'celebrate';
  /** Cuánto tiempo se queda (ms). Sin él, una nota sin acciones se va sola. */
  ms?: number;
  /**
   * Lo que ofrece. Una nota con acciones y sin `ms` **espera**: irse sola sería
   * retirar de las manos lo que acaba de ofrecer.
   */
  actions?: readonly NoteAction[];
}

/** Una nota sin acciones se va sola tras este tiempo. */
export const NOTE_MS = 6000;

@Injectable({ providedIn: 'root' })
export class MascotMoodService {
  readonly mood = signal<{ kind: MoodKind; id: number } | null>(null);
  readonly conditions = signal<readonly Condition[]>([]);
  readonly note = signal<MascotNote | null>(null);

  private moodTimer: ReturnType<typeof setTimeout> | undefined;
  private noteTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  /** Siente `kind` durante su tiempo (o `ms`), por encima de lo que sentía antes. */
  feel(kind: MoodKind, ms = MOOD_MS[kind]): void {
    clearTimeout(this.moodTimer);
    const id = this.nextId++;
    this.mood.set({ kind, id });
    this.moodTimer = setTimeout(() => {
      if (this.mood()?.id === id) this.mood.set(null);
    }, ms);
  }

  /** Deja de sentirlo ahora. */
  calm(): void {
    clearTimeout(this.moodTimer);
    this.mood.set(null);
  }

  setCondition(condition: Condition, on: boolean): void {
    const current = this.conditions();
    const has = current.includes(condition);
    if (has === on) return;
    this.conditions.set(on ? [...current, condition] : current.filter((value) => value !== condition));
  }

  /** Dice algo. Devuelve su id, para retirarlo con `unsay`. */
  say(note: Omit<MascotNote, 'id'>): number {
    clearTimeout(this.noteTimer);
    const id = this.nextId++;
    this.note.set({ ...note, id });
    // Con `ms` manda `ms`, tenga acciones o no: quien lo pone sabe lo que hace.
    // Sin él, sólo se va sola la que no ofrece nada.
    if (note.ms !== undefined || !note.actions?.length) {
      this.noteTimer = setTimeout(() => {
        if (this.note()?.id === id) this.note.set(null);
      }, note.ms ?? NOTE_MS);
    }
    return id;
  }

  /** Retira la nota `id` (si sigue siendo la que se muestra), o cualquiera. */
  unsay(id?: number): void {
    if (id !== undefined && this.note()?.id !== id) return;
    clearTimeout(this.noteTimer);
    this.note.set(null);
  }
}
