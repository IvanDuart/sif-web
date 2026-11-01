import { Injectable, computed, inject, signal } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import { AssistantConfigDto, AssistantLookPolicyDto } from '../../../core/api/models/assistant.model';
import { AssistantService } from '../../../core/api/services/assistant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { cleanAccessories, readStoredLook, writeLook } from './skins/storage';
import {
  ACCESSORY_IDS,
  DEFAULT_SKIN,
  SKIN_IDS,
  isSkinId,
  type AccessoryId,
  type SkinId,
} from './skins/types';

/**
 * El look de la mascota del usuario actual.
 *
 * Manda el backend (`GET/PUT /assistant/look`). Mientras ese endpoint no
 * exista —o falle— el look vive en `localStorage`, así que el wardrobe
 * funciona igual en desarrollo y con el backend v1.
 */
@Injectable({ providedIn: 'root' })
export class MascotLookService {
  private readonly api = inject(AssistantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notifications = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  private readonly stored = readStoredLook();
  readonly skin = signal<SkinId>(this.stored?.skin ?? DEFAULT_SKIN);
  readonly accessories = signal<AccessoryId[]>(this.stored?.accessories ?? []);
  /** Cuándo se eligió lo que se está usando: decide si manda esto o lo remoto. */
  private chosenAt = this.stored?.updatedAt ?? null;

  private readonly policySignal = signal<AssistantLookPolicyDto | null>(null);
  private loaded = false;
  private tenantId: string | null = null;
  /** Hubo eleccion: la guardada en este navegador, la remota o la de ahora mismo. */
  private hasUserLook = this.stored !== null;

  readonly allowUserLook = computed(() => this.policySignal()?.allowUserLook ?? true);

  readonly allowedSkins = computed<SkinId[]>(() => {
    const allowed = this.policySignal()?.allowedSkinIds;
    if (!allowed?.length) return [...SKIN_IDS];
    return SKIN_IDS.filter((id) => allowed.includes(id));
  });

  readonly allowedAccessories = computed<AccessoryId[]>(() => {
    const allowed = this.policySignal()?.allowedAccessories;
    if (!allowed?.length) return [...ACCESSORY_IDS];
    return ACCESSORY_IDS.filter((id) => allowed.includes(id));
  });

  /** Aplica el `defaultSkinId` del centro cuando el usuario no eligió nada. */
  applyConfig(config: AssistantConfigDto | null): void {
    this.policySignal.set(config?.lookPolicy ?? null);
    const defaultSkin = config?.defaultSkinId;
    if (!this.hasUserLook && defaultSkin && isSkinId(defaultSkin)) {
      this.skin.set(defaultSkin);
    }
  }

  /** Lee el look remoto una vez por tenant; si falla, deja el local. */
  load(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    // Al cambiar de tenant se vuelve a leer el look remoto.
    if (this.loaded && this.tenantId === tenantId) return;
    this.loaded = true;
    this.tenantId = tenantId;

    this.api.getLook(tenantId).subscribe({
      next: (look) => {
        // Sin skin remota no hay nada que aplicar: lo local no se toca.
        if (!look.skinId) return;
        this.hasUserLook = true;
        // Lo elegido aquí después manda: el centro puede no haber aceptado el
        // último guardado (skin fuera de su catálogo) y devolver uno viejo.
        if (this.isOlderThanLocal(look.updatedAt)) return;
        if (isSkinId(look.skinId)) this.skin.set(look.skinId);
        this.accessories.set(cleanAccessories(look.accessories));
        this.chosenAt = look.updatedAt ?? new Date().toISOString();
        this.remember();
      },
      // Backend v1 sin `/look`, o red caída: el local sigue mandando.
      error: () => undefined,
    });
  }

  setSkin(skin: SkinId): void {
    if (this.skin() === skin) return;
    this.skin.set(skin);
    this.persist();
  }

  toggleAccessory(accessory: AccessoryId): void {
    const current = this.accessories();
    const next = current.includes(accessory)
      ? current.filter((id) => id !== accessory)
      : [...current, accessory];
    this.accessories.set(cleanAccessories(next));
    this.persist();
  }

  /** Lo que confirma el armario: la skin y los accesorios, en una sola escritura. */
  setLook(skin: SkinId, accessories: readonly AccessoryId[]): void {
    const clean = cleanAccessories([...accessories]);
    const same =
      this.skin() === skin &&
      this.accessories().length === clean.length &&
      clean.every((id) => this.accessories().includes(id));
    if (same) return;
    this.skin.set(skin);
    this.accessories.set(clean);
    this.persist();
  }

  /** Un look remoto anterior a lo que se eligió aquí no tiene nada que decir. */
  private isOlderThanLocal(remoteAt: string | null | undefined): boolean {
    if (!this.chosenAt) return false;
    const remote = Date.parse(remoteAt ?? '');
    const local = Date.parse(this.chosenAt);
    if (Number.isNaN(remote) || Number.isNaN(local)) return false;
    return remote < local;
  }

  private persist(): void {
    this.chosenAt = new Date().toISOString();
    this.remember();
    const tenantId = this.tenantId ?? this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.api.updateLook(tenantId, { skinId: this.skin(), accessories: this.accessories() }).subscribe({
      // Se queda puesta en este navegador, pero no viaja a otros: hay que decirlo.
      error: () => this.notifications.warning(this.transloco.translate('assistant.wardrobe_not_saved')),
    });
  }

  private remember(): void {
    this.hasUserLook = true;
    writeLook({
      skin: this.skin(),
      accessories: this.accessories(),
      updatedAt: this.chosenAt ?? new Date().toISOString(),
    });
  }
}
