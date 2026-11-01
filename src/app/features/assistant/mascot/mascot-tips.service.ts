import { Injectable, effect, inject } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import { MascotFillService } from './fill/mascot-fill.service';
import { MascotLifeService } from './mascot-life.service';
import { MascotMoodService, type NoteAction } from './mascot-mood.service';
import { MascotPreferencesService } from './mascot-preferences.service';
import { MascotStateService } from '../mascot-state.service';

/**
 * "¿Sabías que puedo hacerlo yo?", dicho con cuentagotas.
 *
 * Cuándo se dice: cuando la persona acaba de hacer **a mano** algo que la
 * mascota sabe hacer. Lo primero lo cuenta el interceptor de escrituras; lo
 * segundo sale del catálogo de abajo, y cada entrada apunta a una tool que
 * existe de verdad en `fill/surfaces/`. Esa es toda la gracia: no se ofrece
 * ayuda para algo que luego no sabría hacer, y no hay que tocar ninguna
 * pantalla para añadir un tip.
 *
 * Cuándo **no** se dice, que es la parte que decide si esto ayuda o estorba:
 *
 * - Nunca dos seguidos: `TIP_GAP_MS` entre uno y otro, sea cual sea.
 * - Nunca justo después de usarla: si acaba de rellenar ella el formulario,
 *   ofrecerse a rellenarlo es de besugo (`QUIET_AFTER_USE_MS`).
 * - Nunca el mismo dos veces en la misma sesión, y como mucho `MAX_SHOWS`
 *   veces en este navegador.
 * - Nunca mientras está ocupada, ni pisando lo que ya esté diciendo.
 * - Nunca uno que la persona haya silenciado, lo cual viaja con ella en las
 *   preferencias del centro.
 */

/** Entre un tip y el siguiente. */
export const TIP_GAP_MS = 180_000;
/** Desde la última vez que se usó la mascota hasta que se le permite opinar. */
export const QUIET_AFTER_USE_MS = 120_000;
/** Veces que se insiste con el mismo tip, como mucho, en este navegador. */
export const MAX_SHOWS = 3;
/** Lo que se queda en pantalla. Tiene acciones, pero tampoco se eterniza. */
export const TIP_MS = 14_000;

export const TIPS_SEEN_KEY = 'mascota-tips-vistos';

export interface MascotTip {
  /** `<dominio>.<acción>`. Es lo que se guarda en `silencedTips`. */
  id: string;
  /** La tool que lo haría, y que tiene que existir en `fill/surfaces/`. */
  tool: string;
  /** Qué escritura delata que se hizo a mano. */
  method: string;
  /** Trozo del camino de esa escritura (sin tenant: cambia por centro). */
  path: RegExp;
}

/**
 * Lo que sabe hacer y merece contarse. El `path` se comprueba contra el camino
 * de la petición, así que un endpoint nuevo no se cuela por parecido.
 */
export const TIPS: readonly MascotTip[] = [
  {
    id: 'appointment.create',
    tool: 'create_appointment',
    method: 'POST',
    path: /\/tenant\/[^/]+\/appointments$/,
  },
  {
    id: 'measurement.create',
    tool: 'create_measurement',
    method: 'POST',
    path: /\/tenant\/[^/]+\/users\/[^/]+\/measurements$/,
  },
  {
    id: 'calendar-note.create',
    tool: 'create_calendar_note',
    method: 'POST',
    path: /\/tenant\/[^/]+\/calendar-notes$/,
  },
  {
    id: 'patient-event.create',
    tool: 'create_patient_event',
    method: 'POST',
    path: /\/tenant\/[^/]+\/patients\/[^/]+\/events$/,
  },
];

/** El tip que corresponde a esa escritura, si es que hay alguno. */
export function tipFor(method: string, url: string): MascotTip | null {
  const path = url.split('?')[0];
  return TIPS.find((tip) => tip.method === method && tip.path.test(path)) ?? null;
}

/** Cuántas veces se dijo cada tip en este navegador. */
type Seen = Record<string, number>;

function readSeen(): Seen {
  try {
    const raw = window.localStorage.getItem(TIPS_SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Seen) : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: Seen): void {
  try {
    window.localStorage.setItem(TIPS_SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Sin almacenamiento se insistirá alguna vez de más. No es grave: el
    // silencio de verdad —el que pide la persona— vive en el centro.
  }
}

@Injectable({ providedIn: 'root' })
export class MascotTipsService {
  private readonly mood = inject(MascotMoodService);
  private readonly life = inject(MascotLifeService);
  private readonly state = inject(MascotStateService);
  private readonly fill = inject(MascotFillService);
  private readonly preferences = inject(MascotPreferencesService);
  private readonly transloco = inject(TranslocoService);

  private lastTipAt = -Infinity;
  private lastUseAt = -Infinity;
  /** Los dichos en esta sesión: no se repiten aunque pase el rato. */
  private readonly saidNow = new Set<string>();

  constructor() {
    // Usarla cuenta como usarla: hablarle, verla trabajar o verla rellenar. Lo
    // de rellenar importa más que nada, porque el formulario que ella rellena
    // lo guarda la persona, y esa escritura llega aquí como si fuera a mano.
    effect(() => {
      if (this.state.open() || this.state.sending() || this.fill.filling()) {
        this.lastUseAt = Date.now();
      }
    });
  }

  /** Alguien guardó algo. Si fue a mano y ella sabía hacerlo, se ofrece. */
  noticeWrite(method: string, url: string, now = Date.now()): void {
    const tip = tipFor(method, url);
    if (tip) this.offer(tip, now);
  }

  private offer(tip: MascotTip, now: number): void {
    if (!this.canSpeak(tip, now)) return;

    const seen = readSeen();
    const shown = seen[tip.id] ?? 0;
    if (shown >= MAX_SHOWS) return;

    this.lastTipAt = now;
    this.saidNow.add(tip.id);
    writeSeen({ ...seen, [tip.id]: shown + 1 });

    const t = (key: string) => this.transloco.translate(`assistant.tip.${tip.id}.${key}`);
    const actions: NoteAction[] = [
      {
        label: this.transloco.translate('assistant.tip_try'),
        primary: true,
        run: () => {
          // Silenciado al probarlo: ya lo sabe, decírselo otra vez sobra.
          this.preferences.silenceTip(tip.id);
          this.state.openPanelWithDraft(t('prompt'));
        },
      },
      {
        label: this.transloco.translate('assistant.tip_never'),
        run: () => this.preferences.silenceTip(tip.id),
      },
    ];

    this.life.attend();
    this.mood.say({ title: t('title'), text: t('text'), ms: TIP_MS, actions });
  }

  private canSpeak(tip: MascotTip, now: number): boolean {
    return (
      this.state.visible() &&
      !this.preferences.tipSilenced(tip.id) &&
      !this.saidNow.has(tip.id) &&
      now - this.lastTipAt >= TIP_GAP_MS &&
      now - this.lastUseAt >= QUIET_AFTER_USE_MS &&
      !this.busy()
    );
  }

  /** Ocupada, o diciendo ya algo que importa más que esto. */
  private busy(): boolean {
    return (
      this.state.open() ||
      this.state.wardrobeOpen() ||
      this.state.sending() ||
      this.state.resolvingAction() ||
      this.state.pendingAction() !== null ||
      this.fill.filling() ||
      this.mood.note() !== null
    );
  }
}
