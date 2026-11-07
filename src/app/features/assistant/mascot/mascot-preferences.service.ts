import { Injectable, computed, inject, signal } from '@angular/core';

import {
  AssistantPreferencesDto,
  UpdateAssistantPreferencesRequest,
} from '../../../core/api/models/assistant.model';
import { AssistantService } from '../../../core/api/services/assistant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Lo que la mascota recuerda de cada persona: qué le has dicho que no vuelva a
 * decirte (`doc/contrato-api/mascot/mascota-frontend.md` §5.1).
 *
 * Manda el backend, pero el navegador guarda copia. No es un capricho: la
 * decisión de "no me lo digas más" tiene que valer **ahora**, aunque el `PUT`
 * tarde o falle, y tiene que seguir valiendo en el arranque siguiente antes de
 * que el `GET` conteste. El servidor es quien lo hace viajar entre navegadores;
 * la copia local es quien lo hace inmediato.
 */

export const PREFERENCES_KEY = 'mascota-preferencias';

/**
 * La clave del opt-out de cuando esto solo vivía aquí. Se lee una vez, se
 * convierte en preferencia de verdad y se borra: quien ya dijo que no, no
 * tiene que volver a decirlo porque hayamos cambiado de sitio dónde se guarda.
 */
export const LEGACY_STUCK_KEY = 'mascota-oferta-formulario';

export const DEFAULT_PREFERENCES: AssistantPreferencesDto = {
  proactiveEnabled: true,
  silencedTips: [],
  stuckFormOfferEnabled: true,
  celebrationsEnabled: true,
  updatedAt: null,
};

/**
 * Cada campo comprobado. Vale igual para lo guardado en el navegador y para lo
 * que llegue del centro: un backend sin el endpoint puede contestar cualquier
 * cosa con un 200, y lo que no se entiende se trata como "encendido", que es
 * el valor por defecto. Solo un `false` explícito apaga algo.
 */
function sanitise(value: Partial<AssistantPreferencesDto> | null | undefined): AssistantPreferencesDto {
  const parsed = (value ?? {}) as Partial<AssistantPreferencesDto>;
  return {
    proactiveEnabled: parsed.proactiveEnabled !== false,
    silencedTips: Array.isArray(parsed.silencedTips)
      ? parsed.silencedTips.filter((id): id is string => typeof id === 'string')
      : [],
    stuckFormOfferEnabled: parsed.stuckFormOfferEnabled !== false,
    celebrationsEnabled: parsed.celebrationsEnabled !== false,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
  };
}

/** Lo guardado en este navegador, o `null` si no hay nada que valga. */
function readLocal(): AssistantPreferencesDto | null {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return null;
    return sanitise(JSON.parse(raw) as Partial<AssistantPreferencesDto>);
  } catch {
    return null;
  }
}

function writeLocal(preferences: AssistantPreferencesDto): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Sin almacenamiento la decisión dura lo que dure la pestaña.
  }
}

/** `true` si quedó dicho, en la clave vieja, que no se ofreciera más ayuda. */
function readLegacyOptOut(): boolean {
  try {
    return window.localStorage.getItem(LEGACY_STUCK_KEY) === '1';
  } catch {
    return false;
  }
}

function forgetLegacyOptOut(): void {
  try {
    window.localStorage.removeItem(LEGACY_STUCK_KEY);
  } catch {
    // Da igual: la migración ya está en el servidor y en la copia local.
  }
}

@Injectable({ providedIn: 'root' })
export class MascotPreferencesService {
  private readonly api = inject(AssistantService);
  private readonly tenantCtx = inject(TenantContextService);

  private readonly preferences = signal<AssistantPreferencesDto>(readLocal() ?? DEFAULT_PREFERENCES);

  private loaded = false;
  private tenantId: string | null = null;

  /** El interruptor único: apaga tips, oferta de ayuda y celebraciones. */
  readonly proactive = computed(() => this.preferences().proactiveEnabled);

  /** Las tres cosas, ya cruzadas con el interruptor general. */
  readonly stuckOffer = computed(
    () => this.proactive() && this.preferences().stuckFormOfferEnabled,
  );
  readonly celebrations = computed(() => this.proactive() && this.preferences().celebrationsEnabled);

  readonly silencedTips = computed(() => this.preferences().silencedTips);

  tipSilenced(tipId: string): boolean {
    return !this.proactive() || this.silencedTips().includes(tipId);
  }

  /**
   * Lee las preferencias del centro una vez. Si falla —backend viejo, red
   * caída— se sigue con lo que diga el navegador, que para esto basta.
   */
  load(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    if (this.loaded && this.tenantId === tenantId) return;
    this.loaded = true;
    this.tenantId = tenantId;

    this.api.getPreferences(tenantId).subscribe({
      next: (remote) => this.adopt(remote),
      error: () => undefined,
    });
  }

  /**
   * Lo remoto manda, salvo por el "no me lo digas más" que quedó dicho aquí
   * antes de que esto existiera: eso se sube y se olvida la clave vieja.
   */
  private adopt(response: AssistantPreferencesDto): void {
    const remote = sanitise(response);
    if (readLegacyOptOut() && remote.stuckFormOfferEnabled) {
      this.preferences.set(remote);
      this.save({ stuckFormOfferEnabled: false });
      forgetLegacyOptOut();
      return;
    }

    forgetLegacyOptOut();
    this.preferences.set(remote);
    writeLocal(remote);
  }

  /** Deja de ofrecer ayuda con los formularios. */
  disableStuckOffer(): void {
    this.save({ stuckFormOfferEnabled: false });
  }

  /** No volver a decir ese tip. Repetirlo no lo duplica. */
  silenceTip(tipId: string): void {
    const current = this.preferences().silencedTips;
    if (current.includes(tipId)) return;
    this.save({ silencedTips: [...current, tipId] });
  }

  /** El interruptor general, para los ajustes. */
  setProactive(on: boolean): void {
    this.save({ proactiveEnabled: on });
  }

  setCelebrations(on: boolean): void {
    this.save({ celebrationsEnabled: on });
  }

  /**
   * Guarda el cambio. Primero aquí —la decisión vale ya—, después en el centro.
   *
   * El `PUT` **reemplaza el objeto entero**, así que se manda siempre lo que
   * hay y no solo lo que cambia: mandar un campo suelto devolvería los otros
   * tres a su valor por defecto.
   */
  private save(change: Partial<UpdateAssistantPreferencesRequest>): void {
    const next: AssistantPreferencesDto = { ...this.preferences(), ...change };
    this.preferences.set(next);
    writeLocal(next);

    const tenantId = this.tenantId ?? this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.api
      .updatePreferences(tenantId, {
        proactiveEnabled: next.proactiveEnabled,
        silencedTips: next.silencedTips,
        stuckFormOfferEnabled: next.stuckFormOfferEnabled,
        celebrationsEnabled: next.celebrationsEnabled,
      })
      .subscribe({
        next: (saved) => {
          this.preferences.set(saved);
          writeLocal(saved);
        },
        // Se queda en este navegador. No se avisa: nadie pidió guardar nada,
        // solo dijo que no quería que le hablaran.
        error: () => undefined,
      });
  }
}
