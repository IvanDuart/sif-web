import { Injectable, inject } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import { AssistantMilestoneDto } from '../../../core/api/models/assistant.model';
import { AssistantService } from '../../../core/api/services/assistant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { MascotLifeService } from './mascot-life.service';
import { MascotMoodService } from './mascot-mood.service';
import { MascotPreferencesService } from './mascot-preferences.service';

/**
 * Las primeras veces, celebradas una sola vez (`doc/mascota-frontend.md` §5.2).
 *
 * Quién decide que algo es la primera vez: **el backend**, desde sus propios
 * datos. Es la diferencia entre celebrar una primera vez de verdad y celebrar
 * "la primera que te veo hacer en este navegador", que en una clínica con dos
 * años de uso le saltaría a un veterano delante de un paciente.
 *
 * Y por eso mismo, en una instalación con historia **casi no se verá ninguna**:
 * la migración V59 dejó marcado como celebrado a todo el personal que ya
 * existía, porque hasta entonces las tablas de menús, mediciones, plantillas y
 * listas no guardaban quién las creaba. Que no salte no es que esto no
 * funcione.
 */

export const MILESTONE_CODES = [
  'first_patient',
  'first_appointment',
  'first_measurement',
  'first_menu',
  'first_menu_template',
  'first_shopping_list',
] as const;

export type MilestoneCode = (typeof MILESTONE_CODES)[number];

/** Lo que dura una celebración en pantalla. */
export const CELEBRATION_MS = 8000;

/**
 * Cuántas se celebran de una lectura. Si alguien llega con cinco pendientes no
 * se le sueltan cinco seguidas: se celebran dos y las demás siguen pendientes
 * para la próxima. Una fiesta de cuarenta segundos no es una fiesta.
 */
export const MAX_PER_READ = 2;

/** Lo que se espera para reintentar cuando la mascota está diciendo otra cosa. */
const RETRY_MS = 4000;

/**
 * Lo que se deja pasar desde que algo se guarda hasta que se mira si era una
 * primera vez. No hay prisa —es una felicitación— y así una ráfaga de guardados
 * se resuelve en una sola lectura.
 */
export const REFRESH_DELAY_MS = 3000;

/**
 * Y lo mínimo entre dos lecturas, pase lo que pase. Rellenar un menú son veinte
 * guardados seguidos; preguntar veinte veces por los hitos sería absurdo.
 */
export const MIN_READ_GAP_MS = 30_000;

const isMilestoneCode = (value: string): value is MilestoneCode =>
  (MILESTONE_CODES as readonly string[]).includes(value);

/** Lo que está alcanzado y sin celebrar, en el orden del catálogo. */
export function pendingCelebrations(
  milestones: readonly AssistantMilestoneDto[] | null | undefined,
): MilestoneCode[] {
  // Un backend que no tenga el endpoint puede contestar cualquier cosa con un
  // 200: lo que no sea una lista no es que no haya hitos, es que no se sabe.
  if (!Array.isArray(milestones)) return [];
  return milestones
    .filter(
      (milestone): milestone is AssistantMilestoneDto & { code: MilestoneCode } =>
        isMilestoneCode(milestone.code) &&
        milestone.reachedAt !== null &&
        milestone.celebratedAt === null,
    )
    .map((milestone) => milestone.code)
    .sort((a, b) => MILESTONE_CODES.indexOf(a) - MILESTONE_CODES.indexOf(b));
}

@Injectable({ providedIn: 'root' })
export class MascotMilestonesService {
  private readonly api = inject(AssistantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly preferences = inject(MascotPreferencesService);
  private readonly mood = inject(MascotMoodService);
  private readonly life = inject(MascotLifeService);
  private readonly transloco = inject(TranslocoService);

  private tenantId: string | null = null;
  private loaded = false;
  private reading = false;
  private queue: MilestoneCode[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private lastReadAt = -Infinity;

  /** Lee los hitos la primera vez en este centro. */
  load(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    if (this.loaded && this.tenantId === tenantId) return;
    this.loaded = true;
    this.tenantId = tenantId;
    this.read();
  }

  /**
   * Vuelve a mirar si hay algo que celebrar. Para después de guardar algo que
   * pueda ser una primera vez: el backend los calcula al leer, así que basta
   * con volver a preguntar.
   */
  refresh(): void {
    if (!this.loaded) {
      this.load();
      return;
    }
    this.read();
  }

  /**
   * Algo se guardó en alguna parte de la aplicación y pudo ser una primera vez.
   *
   * No lee de inmediato: espera `REFRESH_DELAY_MS` y respeta `MIN_READ_GAP_MS`
   * desde la última lectura. Y si ya hay una mirada en camino, esta se suma a
   * ella en vez de aplazarla —aplazar siempre sería no mirar nunca mientras
   * alguien está guardando sin parar, que es justo cuando hay algo que ver—.
   */
  scheduleRefresh(now = Date.now()): void {
    // Sin haber leído una primera vez no se sabe ni el tenant ni si esto
    // importa: el arranque es quien abre la veda.
    if (!this.loaded || this.refreshTimer || !this.preferences.celebrations()) return;

    const delay = Math.max(REFRESH_DELAY_MS, this.lastReadAt + MIN_READ_GAP_MS - now);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this.read();
    }, delay);
  }

  private read(): void {
    const tenantId = this.tenantId ?? this.tenantCtx.currentTenantId();
    if (!tenantId || this.reading) return;
    // Apagadas las celebraciones, ni se pregunta.
    if (!this.preferences.celebrations()) return;

    this.lastReadAt = Date.now();
    this.reading = true;
    this.api.getMilestones(tenantId).subscribe({
      next: (milestones) => {
        this.reading = false;
        this.queue = pendingCelebrations(milestones).slice(0, MAX_PER_READ);
        this.next();
      },
      // Backend sin el endpoint, o red caída: no hay nada que celebrar y ya.
      error: () => (this.reading = false),
    });
  }

  private next(): void {
    clearTimeout(this.timer);
    const code = this.queue[0];
    if (!code) return;
    if (!this.preferences.celebrations()) {
      this.queue = [];
      return;
    }

    // No se pisa lo que la mascota esté diciendo: una oferta de ayuda a medias
    // importa más que una felicitación, y la felicitación puede esperar.
    if (this.mood.note()) {
      this.timer = setTimeout(() => this.next(), RETRY_MS);
      return;
    }

    this.queue = this.queue.slice(1);
    this.celebrate(code);
    this.timer = setTimeout(() => this.next(), CELEBRATION_MS);
  }

  private celebrate(code: MilestoneCode): void {
    // Que esté presente para celebrarlo: si estaba con el teléfono, lo deja.
    this.life.attend();
    this.mood.feel('cheer');
    this.mood.say({
      title: this.transloco.translate(`assistant.milestone.${code}.title`),
      text: this.transloco.translate(`assistant.milestone.${code}.text`),
      tone: 'celebrate',
      ms: CELEBRATION_MS,
    });

    const tenantId = this.tenantId ?? this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    // Que no vuelva a saltar en otro dispositivo. Si falla, saltará otra vez:
    // repetir una felicitación es mejor que tragarse la primera.
    this.api.markMilestoneCelebrated(tenantId, code).subscribe({ error: () => undefined });
  }
}
