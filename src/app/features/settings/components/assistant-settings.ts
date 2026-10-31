import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiSwitch, TuiTextarea } from '@taiga-ui/kit';

import { AssistantService } from '../../../core/api/services/assistant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { AssistantConfigDto } from '../../../core/api/models/assistant.model';
import { MascotStateService } from '../../assistant/mascot-state.service';
import { MascotOrb } from '../../assistant/components/mascot-orb';
import { SKINS } from '../../assistant/mascot/skins/registry';
import {
  ACCESSORY_IDS,
  DEFAULT_SKIN,
  isSkinId,
  type AccessoryId,
  type SkinId,
} from '../../assistant/mascot/skins/types';

/**
 * Configuración del asistente por tenant (`PUT /assistant/config`).
 *
 * Contrato v2: las mascotas son procedurales y las define el producto. El
 * centro elige la skin por defecto y qué personalización permite a sus
 * usuarios; no sube avatares ni animaciones.
 */
@Component({
  selector: 'app-assistant-settings',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
    TuiButton,
    TuiInput,
    TuiTextfield,
    TuiSwitch,
    TuiTextarea,
    MascotOrb,
  ],
  templateUrl: './assistant-settings.html',
})
export class AssistantSettings implements OnInit {
  private readonly api = inject(AssistantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotStateService);

  readonly skins = SKINS;
  readonly accessories = ACCESSORY_IDS;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly saving = signal(false);

  readonly config = signal<AssistantConfigDto | null>(null);

  readonly enabled = signal(false);
  readonly name = signal('');
  readonly persona = signal('');
  readonly tone = signal('');
  readonly consentText = signal('');

  readonly defaultSkinId = signal<SkinId>(DEFAULT_SKIN);
  readonly allowUserLook = signal(true);
  readonly allowedSkinIds = signal<string[]>([]);
  readonly allowedAccessories = signal<string[]>([]);

  readonly apiKeyConfigured = computed(() => this.config()?.apiKeyConfigured === true);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) {
      this.loading.set(false);
      this.loadError.set(true);
      return;
    }

    this.loading.set(true);
    this.loadError.set(false);

    this.api.getConfig(tenantId).subscribe({
      next: (config) => {
        this.apply(config);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  save(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const name = this.name().trim();
    if (!tenantId || !name || this.saving()) return;

    // Con un backend v1 los campos del contrato v2 no viajan: no romper el
    // guardado mientras el otro equipo despliega `/look`.
    const supportsLook =
      this.config()?.lookPolicy !== undefined || this.config()?.defaultSkinId !== undefined;

    this.saving.set(true);
    this.api
      .updateConfig(tenantId, {
        enabled: this.enabled(),
        name,
        persona: this.persona().trim() || undefined,
        tone: this.tone().trim() || undefined,
        consentText: this.consentText().trim() || undefined,
        ...(supportsLook
          ? {
              defaultSkinId: this.defaultSkinId(),
              lookPolicy: {
                allowUserLook: this.allowUserLook(),
                allowedSkinIds: this.allowedSkinIds(),
                allowedAccessories: this.allowedAccessories(),
              },
            }
          : {}),
      })
      .subscribe({
        next: (config) => {
          this.saving.set(false);
          this.apply(config);
          this.notify.success(this.transloco.translate('assistant.settings_saved'));
          // El panel global debe reflejar los cambios sin recargar la página.
          this.mascot.reloadConfig();
        },
        error: () => this.saving.set(false),
      });
  }

  selectDefaultSkin(skin: SkinId): void {
    this.defaultSkinId.set(skin);
  }

  isSkinAllowed(skin: SkinId): boolean {
    // Sin restricciones = todas permitidas.
    return this.allowedSkinIds().length === 0 || this.allowedSkinIds().includes(skin);
  }

  toggleAllowedSkin(skin: SkinId): void {
    const current = this.allowedSkinIds();
    // Lista vacía = todas permitidas: el primer click desmarca esa skin.
    if (current.length === 0) {
      this.allowedSkinIds.set(this.skins.map((entry) => entry.id).filter((id) => id !== skin));
      return;
    }
    this.allowedSkinIds.set(
      current.includes(skin) ? current.filter((id) => id !== skin) : [...current, skin],
    );
  }

  isAccessoryAllowed(accessory: AccessoryId): boolean {
    return this.allowedAccessories().length === 0 || this.allowedAccessories().includes(accessory);
  }

  toggleAllowedAccessory(accessory: AccessoryId): void {
    const current = this.allowedAccessories();
    // Lista vacía = todos permitidos: el primer click desmarca ese accesorio.
    if (current.length === 0) {
      this.allowedAccessories.set(this.accessories.filter((id) => id !== accessory));
      return;
    }
    this.allowedAccessories.set(
      current.includes(accessory) ? current.filter((id) => id !== accessory) : [...current, accessory],
    );
  }

  private apply(config: AssistantConfigDto): void {
    this.config.set(config);
    this.enabled.set(config.enabled);
    this.name.set(config.name ?? '');
    this.persona.set(config.persona ?? '');
    this.tone.set(config.tone ?? '');
    this.consentText.set(config.consentText ?? '');
    this.defaultSkinId.set(isSkinId(config.defaultSkinId) ? config.defaultSkinId : DEFAULT_SKIN);

    const policy = config.lookPolicy;
    this.allowUserLook.set(policy?.allowUserLook ?? true);
    this.allowedSkinIds.set(policy?.allowedSkinIds ?? []);
    this.allowedAccessories.set(policy?.allowedAccessories ?? []);
  }
}
