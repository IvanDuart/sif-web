import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';

import { MascotLookService } from '../mascot/mascot-look.service';
import type { AccessoryId, SkinId } from '../mascot/skins/types';
import { MascotOrb } from './mascot-orb';

/**
 * El armario (diseño de alkimia, `core/copilot/mascot/Wardrobe.tsx`): una
 * tarjeta sobre la página atenuada con dos puertas que se abren sobre ella. En
 * el escenario está la mascota con el look que se está probando, debajo el
 * estante con todas y, al fondo, los accesorios.
 *
 * Lo que se elige aquí es un borrador: no se lleva puesto hasta confirmarlo,
 * así que cancelar o Esc dejan el look como estaba.
 */
@Component({
  selector: 'app-mascot-wardrobe',
  standalone: true,
  imports: [TranslocoDirective, TuiButton, MascotOrb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mascot-wardrobe.scss',
  template: `
    <ng-container *transloco="let t">
      <div class="wd-scrim" aria-hidden="true" (click)="cancel()"></div>

      <div class="wd-frame">
        <section
          class="wd-card"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="t('assistant.wardrobe_title')"
        >
          <header class="wd-head">
            <div>
              <p class="wd-eyebrow">{{ t('assistant.wardrobe_title') }}</p>
              <h2 class="wd-title">{{ t('assistant.wardrobe_subtitle') }}</h2>
            </div>
            <button
              type="button"
              tuiIconButton
              appearance="flat"
              size="s"
              [attr.aria-label]="t('common.close')"
              [attr.title]="t('common.close')"
              (click)="cancel()"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </header>

          <div class="wd-stage">
            <span class="wd-bar" aria-hidden="true"></span>
            <span class="wd-floor" aria-hidden="true"></span>

            <div class="wd-model">
              <app-mascot-orb [skin]="pick()" [accessories]="draft()" size="l" [decorative]="true" />
            </div>

            <button
              type="button"
              tuiIconButton
              appearance="secondary"
              size="s"
              tabindex="-1"
              class="wd-arrow wd-arrow--prev"
              [attr.aria-label]="t('assistant.wardrobe_prev')"
              (click)="move(-1)"
            >
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              tuiIconButton
              appearance="secondary"
              size="s"
              tabindex="-1"
              class="wd-arrow wd-arrow--next"
              [attr.aria-label]="t('assistant.wardrobe_next')"
              (click)="move(1)"
            >
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <div class="wd-info wd-rise" style="--d: 1.1s">
            <div class="wd-info__line" aria-live="polite">
              <strong>{{ t('assistant.skin_' + pick()) }}</strong>
              @if (pick() === look.skin()) {
                <em>{{ t('assistant.wardrobe_worn') }}</em>
              }
            </div>
            <p aria-live="polite">{{ t('assistant.skin_' + pick() + '_desc') }}</p>
          </div>

          <div class="wd-shelf" role="radiogroup" [attr.aria-label]="t('assistant.wardrobe_skins')">
            @for (id of skins(); track id; let i = $index) {
              <div class="wd-rise" [style.--d]="riseDelay(i)">
                <button
                  type="button"
                  role="radio"
                  class="wd-thumb"
                  [class.wd-thumb--on]="pick() === id"
                  [attr.aria-checked]="pick() === id"
                  [attr.aria-label]="t('assistant.skin_' + id)"
                  [tabIndex]="pick() === id ? 0 : -1"
                  (click)="pick.set(id)"
                  (keydown)="onShelfKey($event)"
                >
                  <span class="wd-thumb__box" aria-hidden="true">
                    <span class="wd-thumb__art">
                      <app-mascot-orb [skin]="id" [accessories]="draft()" size="m" [decorative]="true" [still]="true" />
                    </span>
                  </span>
                  <span class="wd-thumb__name">{{ t('assistant.skin_' + id) }}</span>
                  @if (id === look.skin()) {
                    <span class="wd-thumb__dot" aria-hidden="true"></span>
                  }
                </button>
              </div>
            }
          </div>

          @if (accessories().length > 0) {
            <div class="wd-extras wd-rise" style="--d: 1.45s">
              <p class="wd-extras__label">{{ t('assistant.wardrobe_accessories') }}</p>
              <div class="wd-chips">
                @for (accessory of accessories(); track accessory) {
                  <button
                    type="button"
                    class="wd-chip"
                    [class.wd-chip--on]="draft().includes(accessory)"
                    [attr.aria-pressed]="draft().includes(accessory)"
                    (click)="toggleAccessory(accessory)"
                  >
                    {{ labelFor(accessory, t) }}
                  </button>
                }
              </div>
            </div>
          }

          <footer class="wd-foot wd-rise" style="--d: 1.6s">
            <span class="wd-hint">{{ t('assistant.wardrobe_hint') }}</span>
            <button type="button" tuiButton appearance="flat" size="m" (click)="cancel()">
              {{ t('common.cancel') }}
            </button>
            <button type="button" tuiButton appearance="primary" size="m" (click)="confirm()">
              {{ t(changed() ? 'assistant.wardrobe_put' : 'assistant.wardrobe_keep') }}
            </button>
          </footer>

          <span class="wd-door wd-door--left" aria-hidden="true"><i></i></span>
          <span class="wd-door wd-door--right" aria-hidden="true"><i></i></span>
        </section>
      </div>
    </ng-container>
  `,
})
export class MascotWardrobe {
  readonly look = inject(MascotLookService);
  readonly closed = output<void>();

  /** Sólo las que el centro permite; el estante no enseña nada que no se pueda llevar. */
  readonly skins = this.look.allowedSkins;
  readonly accessories = this.look.allowedAccessories;

  /** El borrador: lo que se está probando mientras no se confirme. */
  readonly pick = signal<SkinId>(this.look.skin());
  readonly draft = signal<readonly AccessoryId[]>([...this.look.accessories()]);

  readonly changed = computed(
    () => this.pick() !== this.look.skin() || !this.sameAccessories(this.draft(), this.look.accessories())
  );

  constructor() {
    // Esc se atrapa antes que nadie: no debe cerrar el panel que hay debajo.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      this.cancel();
    };
    document.addEventListener('keydown', onKey, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', onKey, true));
  }

  /** Las flechas del escenario: la siguiente mascota, dando la vuelta. */
  move(by: number): void {
    const all = this.skins();
    if (all.length === 0) return;
    const at = all.indexOf(this.pick());
    this.pick.set(all[(at + by + all.length) % all.length]);
  }

  onShelfKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') this.move(1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') this.move(-1);
    else return;
    event.preventDefault();
  }

  toggleAccessory(accessory: AccessoryId): void {
    const current = this.draft();
    this.draft.set(
      current.includes(accessory) ? current.filter((id) => id !== accessory) : [...current, accessory]
    );
  }

  /** Lo que sube detrás de la ficha anterior, como en el diseño. */
  riseDelay(index: number): string {
    return `${(1.15 + index * 0.06).toFixed(2)}s`;
  }

  labelFor(accessory: AccessoryId, t: (key: string) => string): string {
    return accessory === 'orejas' ? t('assistant.wardrobe_ears') : accessory;
  }

  confirm(): void {
    this.look.setLook(this.pick(), this.draft());
    this.closed.emit();
  }

  cancel(): void {
    this.closed.emit();
  }

  private sameAccessories(a: readonly AccessoryId[], b: readonly AccessoryId[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id));
  }
}
