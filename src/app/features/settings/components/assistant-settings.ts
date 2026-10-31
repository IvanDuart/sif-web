import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiFiles, TuiSwitch, TuiTextarea } from '@taiga-ui/kit';

import { AssistantService } from '../../../core/api/services/assistant.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { AssistantConfigDto, AssistantPetDto } from '../../../core/api/models/assistant.model';
import { MascotStateService } from '../../assistant/mascot-state.service';

/** Slots de animación admitidos por el backend. */
const ANIMATION_SLOTS = ['idle', 'listening', 'thinking', 'happy', 'confused', 'sleeping'] as const;

/** Límites del backend, validados también en cliente para dar feedback rápido. */
const MAX_AVATAR_BYTES = 512 * 1024;
const MAX_ANIMATION_BYTES = 2 * 1024 * 1024;

/**
 * Configuración del asistente por tenant (`PUT /assistant/config`, avatar y
 * animaciones). Sólo la ve quien tiene `MANAGE_TENANT`.
 *
 * El avatar y las animaciones no viajan en el `PUT /config`: se suben por sus
 * endpoints dedicados, que devuelven el `AssistantConfigDto` actualizado.
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
    ...TuiFiles,
  ],
  templateUrl: './assistant-settings.html',
})
export class AssistantSettings implements OnInit {
  private readonly api = inject(AssistantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly mascot = inject(MascotStateService);

  readonly animationSlots = ANIMATION_SLOTS;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly saving = signal(false);

  readonly config = signal<AssistantConfigDto | null>(null);
  readonly pets = signal<AssistantPetDto[]>([]);

  readonly enabled = signal(false);
  readonly name = signal('');
  readonly persona = signal('');
  readonly tone = signal('');
  readonly consentText = signal('');

  /** Feedback por operación asíncrona (avatar o animación concreta). */
  readonly uploadingAvatar = signal(false);
  readonly uploadingAnimation = signal<string | null>(null);
  readonly deletingAnimation = signal<string | null>(null);

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

    // Las mascotas son opcionales: si fallan, el selector simplemente no aparece.
    this.api.listPets(tenantId).subscribe({
      next: (pets) => this.pets.set(pets),
      error: () => this.pets.set([]),
    });
  }

  save(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const name = this.name().trim();
    if (!tenantId || !name || this.saving()) return;

    this.saving.set(true);
    this.api
      .updateConfig(tenantId, {
        enabled: this.enabled(),
        name,
        persona: this.persona().trim() || undefined,
        tone: this.tone().trim() || undefined,
        consentText: this.consentText().trim() || undefined,
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

  selectPet(pet: AssistantPetDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.uploadingAvatar()) return;

    this.uploadingAvatar.set(true);
    this.api.selectPresetAvatar(tenantId, pet.id).subscribe({
      next: (config) => {
        this.uploadingAvatar.set(false);
        this.apply(config);
        this.notify.success(this.transloco.translate('assistant.settings_avatar_saved'));
        this.mascot.reloadConfig();
      },
      error: () => this.uploadingAvatar.set(false),
    });
  }

  onAvatarFile(file: File | null): void {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.svg')) {
      this.notify.error(this.transloco.translate('assistant.settings_avatar_invalid'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.notify.error(this.transloco.translate('assistant.settings_avatar_too_large'));
      return;
    }

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.uploadingAvatar()) return;

    this.uploadingAvatar.set(true);
    this.api.uploadAvatar(tenantId, file).subscribe({
      next: (config) => {
        this.uploadingAvatar.set(false);
        this.apply(config);
        this.notify.success(this.transloco.translate('assistant.settings_avatar_saved'));
        this.mascot.reloadConfig();
      },
      error: () => this.uploadingAvatar.set(false),
    });
  }

  onAnimationFile(animationName: string, file: File | null): void {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      this.notify.error(this.transloco.translate('assistant.settings_animation_invalid'));
      return;
    }
    if (file.size > MAX_ANIMATION_BYTES) {
      this.notify.error(this.transloco.translate('assistant.settings_animation_too_large'));
      return;
    }

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.uploadingAnimation()) return;

    this.uploadingAnimation.set(animationName);
    this.api.uploadAnimation(tenantId, animationName, file).subscribe({
      next: (config) => {
        this.uploadingAnimation.set(null);
        this.apply(config);
        this.notify.success(this.transloco.translate('assistant.settings_animation_saved'));
        this.mascot.reloadConfig();
      },
      error: () => this.uploadingAnimation.set(null),
    });
  }

  deleteAnimation(animationName: string): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.deletingAnimation()) return;

    this.deletingAnimation.set(animationName);
    this.api.deleteAnimation(tenantId, animationName).subscribe({
      next: (config) => {
        this.deletingAnimation.set(null);
        this.apply(config);
        this.notify.success(this.transloco.translate('assistant.settings_animation_deleted'));
        this.mascot.reloadConfig();
      },
      error: () => this.deletingAnimation.set(null),
    });
  }

  hasAnimation(animationName: string): boolean {
    return !!this.config()?.animations?.[animationName];
  }

  /** Vista previa de una mascota predefinida sin ejecutar HTML del backend. */
  petPreview(pet: AssistantPetDto): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pet.svgContent)}`;
  }

  animationLabelKey(animationName: string): string {
    return `assistant.settings_animation_${animationName}`;
  }

  private apply(config: AssistantConfigDto): void {
    this.config.set(config);
    this.enabled.set(config.enabled);
    this.name.set(config.name ?? '');
    this.persona.set(config.persona ?? '');
    this.tone.set(config.tone ?? '');
    this.consentText.set(config.consentText ?? '');
  }
}
