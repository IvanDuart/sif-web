import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import {
  AssistantConfigDto,
  AssistantLookPolicyDto,
  AssistantPetDto,
} from '../../../core/api/models/assistant.model';
import { AssistantService } from '../../../core/api/services/assistant.api';
import { problemDetailCode } from '../../../core/http/error.interceptor';
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
/**
 * Por qué no se guardó, en las palabras de quien lo sufre.
 *
 * No es lo mismo "esa mascota ya no existe" que "tu centro no te deja esa":
 * la primera no tiene arreglo desde aquí y la segunda la arregla quien
 * administre el centro. Todas acaban igual —se queda puesta solo en este
 * navegador—, pero saber cuál es cambia a quién preguntar.
 */
export function whyNotSaved(error: HttpErrorResponse | null | undefined): string {
  switch (problemDetailCode(error)) {
    case 'error.assistant_look_not_allowed':
      return 'assistant.wardrobe_not_allowed';
    case 'error.assistant_look_disabled':
      return 'assistant.wardrobe_look_disabled';
    case 'error.assistant_pet_not_found':
      return 'assistant.wardrobe_unknown_pet';
    case 'error.assistant_invalid_accessory':
      return 'assistant.wardrobe_invalid_accessory';
    default:
      return 'assistant.wardrobe_not_saved';
  }
}

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
  /**
   * El catálogo del centro (`GET /assistant/pets`). `null` mientras no se sabe
   * —no ha contestado todavía, o es un backend sin el endpoint—, y entonces no
   * se filtra por él: un armario vacío por no haber preguntado sería peor que
   * uno de más.
   */
  private readonly pets = signal<readonly AssistantPetDto[] | null>(null);
  private readonly catalogue = computed<readonly string[] | null>(
    () => this.pets()?.map((pet) => pet.id) ?? null,
  );
  private loaded = false;
  private tenantId: string | null = null;
  /** Hubo eleccion: la guardada en este navegador, la remota o la de ahora mismo. */
  private hasUserLook = this.stored !== null;

  readonly allowUserLook = computed(() => this.policySignal()?.allowUserLook ?? true);

  /**
   * Lo que el armario puede ofrecer: la intersección de tres listas, y hacen
   * falta las tres (`doc/mascota-frontend.md` §2.4).
   *
   * 1. `SKIN_IDS`  — lo que este frontend sabe dibujar.
   * 2. `/pets`     — el catálogo del producto; fuera de él, `PUT /look` da 422.
   * 3. `lookPolicy.allowedSkinIds` — lo que **este centro** permite; dentro del
   *    catálogo pero fuera de aquí, `PUT /look` da 422 igualmente.
   *
   * Ofrecer algo que no está en las tres es prometer una mascota que al
   * recargar vuelve a ser otra.
   */
  readonly allowedSkins = computed<SkinId[]>(() => {
    const policy = this.policySignal()?.allowedSkinIds;
    const catalogue = this.catalogue();
    const offered = SKIN_IDS.filter(
      (id) => (!catalogue || catalogue.includes(id)) && (!policy?.length || policy.includes(id)),
    );
    // Si no queda nada que ofrecer (un centro que permite solo mascotas que
    // este frontend no dibuja), al menos la puesta: un armario vacío no deja
    // ni volver atrás.
    return offered.length ? offered : [this.skin()];
  });

  readonly allowedAccessories = computed<AccessoryId[]>(() => {
    const allowed = this.policySignal()?.allowedAccessories;
    const supported = this.supportedAccessories();
    return ACCESSORY_IDS.filter(
      (id) => (!allowed?.length || allowed.includes(id)) && (!supported || supported.includes(id)),
    );
  });

  /** Lo que admite la mascota puesta, según el catálogo. `null` = no se sabe. */
  private readonly supportedAccessories = computed<readonly string[] | null>(
    () => this.pets()?.find((pet) => pet.id === this.skin())?.supports?.accessories ?? null,
  );

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

    // El catálogo del centro: sin él el armario ofrecería mascotas que el
    // `PUT /look` rechaza. Si no contesta, se sigue sin filtrar por él.
    this.api.listPets(tenantId).subscribe({
      next: (pets) => this.pets.set(pets),
      error: () => this.pets.set(null),
    });

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
      error: (error: HttpErrorResponse) =>
        this.notifications.warning(this.transloco.translate(whyNotSaved(error))),
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
