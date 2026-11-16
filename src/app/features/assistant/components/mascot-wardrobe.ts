import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { TranslocoDirective, TranslocoPipe } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';

import type { Scene } from '../mascot/agentMotion';
import { MascotLookService } from '../mascot/mascot-look.service';
import { MascotMoodService } from '../mascot/mascot-mood.service';
import type { AccessoryId, SkinId } from '../mascot/skins/types';
import { MascotOrb } from './mascot-orb';

/** Lo que recibe el foco dentro del diálogo, en orden de tabulación. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  imports: [TranslocoDirective, TranslocoPipe, TuiButton, MascotOrb],
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
              class="wd-close"
              [attr.aria-label]="t('common.close')"
              [attr.title]="t('common.close')"
              (click)="cancel()"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </header>

          <div class="wd-stage">
            <span class="wd-pedestal" aria-hidden="true"></span>

            <div class="wd-model" [class.wd-model--dip]="dip()">
              <app-mascot-orb
                [skin]="pick()"
                [accessories]="draft()"
                [mode]="stageMode()"
                [previewScene]="previewScene()"
                size="l"
                [decorative]="true"
              />
            </div>

            <!-- Probar un gesto sin cambiarse de fruta: siete atajos que sólo
                 enseñan su reacción un momento. El botón que está en escena se
                 queda encendido; volver a pulsarlo la apaga. Fuera del ciclo de
                 Tab: el diálogo se recorre por lo que de verdad se elige. -->
            <div class="wd-moods" role="group" [attr.aria-label]="t('assistant.wardrobe_moods')">
              <button
                type="button"
                tabindex="-1"
                class="wd-mood"
                [class.wd-mood--on]="previewScene() === 'blush'"
                [attr.aria-label]="t('assistant.wardrobe.moods.blush')"
                [attr.title]="t('assistant.wardrobe.moods.blush')"
                (click)="previewMood('blush')"
              >
                <span aria-hidden="true">✨</span>
              </button>
              <button
                type="button"
                tabindex="-1"
                class="wd-mood"
                [class.wd-mood--on]="previewScene() === 'cheer'"
                [attr.aria-label]="t('assistant.wardrobe.moods.happy')"
                [attr.title]="t('assistant.wardrobe.moods.happy')"
                (click)="previewMood('cheer')"
              >
                <span aria-hidden="true">😊</span>
              </button>
              <button
                type="button"
                tabindex="-1"
                class="wd-mood"
                [class.wd-mood--on]="previewScene() === 'water'"
                [attr.aria-label]="t('assistant.wardrobe.moods.water')"
                [attr.title]="t('assistant.wardrobe.moods.water')"
                (click)="previewMood('water')"
              >
                <span aria-hidden="true">💧</span>
              </button>
              <button
                type="button"
                tabindex="-1"
                class="wd-mood"
                [class.wd-mood--on]="previewScene() === 'proud'"
                [attr.aria-label]="t('assistant.wardrobe.moods.proud')"
                [attr.title]="t('assistant.wardrobe.moods.proud')"
                (click)="previewMood('proud')"
              >
                <span aria-hidden="true">💪</span>
              </button>
              <button
                type="button"
                tabindex="-1"
                class="wd-mood"
                [class.wd-mood--on]="previewScene() === $any('notes')"
                [attr.aria-label]="t('assistant.wardrobe.moods.notes')"
                [attr.title]="t('assistant.wardrobe.moods.notes')"
                (click)="previewMood($any('notes'))"
              >
                <span aria-hidden="true">📋</span>
              </button>
              <button
                type="button"
                tabindex="-1"
                class="wd-mood"
                [class.wd-mood--on]="previewScene() === 'phone'"
                [attr.aria-label]="t('assistant.wardrobe.moods.phone')"
                [attr.title]="t('assistant.wardrobe.moods.phone')"
                (click)="previewMood('phone')"
              >
                <span aria-hidden="true">📱</span>
              </button>
              <button
                type="button"
                tabindex="-1"
                class="wd-mood"
                [class.wd-mood--on]="previewScene() === 'sleep'"
                [attr.aria-label]="t('assistant.wardrobe.moods.sleeping')"
                [attr.title]="t('assistant.wardrobe.moods.sleeping')"
                (click)="previewMood('sleep')"
              >
                <span aria-hidden="true">💤</span>
              </button>
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

          <div class="wd-info wd-about wd-rise" style="--d: 0.15s">
            <div class="wd-info__line" aria-live="polite">
              <strong>{{ t('assistant.skin_' + pick()) }}</strong>
              @if (pick() === look.skin()) {
                <em>{{ t('assistant.wardrobe_worn') }}</em>
              }
            </div>
            <p class="wd-trait" aria-live="polite">
              {{ ('assistant.wardrobe.skins.' + pick() + '.trait') | transloco }}
            </p>
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
                  (click)="choose(id)"
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
            <div class="wd-extras wd-rise" style="--d: 0.25s">
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

          <footer class="wd-foot wd-rise" style="--d: 0.35s">
            <span class="wd-hint">{{ t('assistant.wardrobe_hint') }}</span>
            <button type="button" tuiButton appearance="flat" size="m" class="wd-cancel" (click)="cancel()">
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
  /** La reacción de la fruta al probarla, durante un momento. */
  readonly previewScene = signal<Scene | null>(null);
  /** La fruta se hunde un instante al probarla: peso físico, no sólo un destello. */
  readonly dip = signal(false);
  /** El orbe del escenario celebra el look confirmado antes de que se cierre. */
  readonly stageMode = signal<'wardrobe' | 'done'>('wardrobe');

  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private dipTimer: ReturnType<typeof setTimeout> | undefined;
  private doneTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly mood = inject(MascotMoodService);

  readonly changed = computed(
    () => this.pick() !== this.look.skin() || !this.sameAccessories(this.draft(), this.look.accessories())
  );

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    let previousFocus: HTMLElement | null = null;

    // Al abrirse, el foco entra en el diálogo: la fruta elegida es el punto
    // natural, porque es lo que se viene a probar.
    afterNextRender(() => {
      previousFocus = document.activeElement as HTMLElement | null;
      host.querySelector<HTMLElement>('.wd-thumb--on')?.focus();
    });

    // Esc se atrapa antes que nadie: no debe cerrar el panel que hay debajo.
    // Tab no sale de la tarjeta: es un diálogo modal.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        event.preventDefault();
        this.cancel();
        return;
      }
      if (event.key === 'Tab') this.trapTab(host, event);
    };
    document.addEventListener('keydown', onKey, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('keydown', onKey, true);
      clearTimeout(this.previewTimer);
      clearTimeout(this.dipTimer);
      clearTimeout(this.doneTimer);
      if (previousFocus?.isConnected) previousFocus.focus();
    });
  }

  /** Mantiene Tab y Shift+Tab dentro de la tarjeta mientras el armario está abierto. */
  private trapTab(host: HTMLElement, event: KeyboardEvent): void {
    const card = host.querySelector<HTMLElement>('.wd-card');
    if (!card) return;
    const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.tabIndex >= 0,
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = active !== null && card.contains(active);

    event.preventDefault();
    if (!inside) {
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && active === first) {
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      first.focus();
      return;
    }
    const at = focusable.indexOf(active as HTMLElement);
    const next = (at + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
    focusable[next].focus();
  }

  /**
   * Probarse una fruta es elegirla: además de cambiarla en el escenario, enseña
   * un momento su carácter (`happyMove` y `happyBits` de `personalities.ts`).
   */
  choose(id: SkinId): void {
    if (id === this.pick()) return;
    this.pick.set(id);
    // Elegir fruta no es un interruptor: aunque su gesto estuviera en escena,
    // el saludo se enseña igual al cambiarla.
    this.previewScene.set(null);
    this.flashPreview();
    this.flashDip();
  }

  private flashDip(): void {
    clearTimeout(this.dipTimer);
    this.dip.set(true);
    this.dipTimer = setTimeout(() => this.dip.set(false), 160);
  }

  /**
   * Probar un gesto sin cambiarse de fruta: el escenario enseña la reacción
   * unos instantes y vuelve a la calma. No toca el borrador.
   *
   * Los atajos del escenario son un interruptor: pulsar el gesto que ya está
   * en escena lo apaga en vez de volver a empezar la cuenta.
   */
  previewMood(scene: Scene, durationMs = 2800): void {
    clearTimeout(this.previewTimer);
    if (this.previewScene() === scene) {
      this.previewScene.set(null);
      return;
    }
    this.previewScene.set(scene);
    this.previewTimer = setTimeout(() => this.previewScene.set(null), durationMs);
  }

  private flashPreview(): void {
    this.previewMood('blush', 1800);
  }

  /** Las flechas del escenario: la siguiente mascota, dando la vuelta. */
  move(by: number): void {
    const all = this.skins();
    if (all.length === 0) return;
    const at = all.indexOf(this.pick());
    this.choose(all[(at + by + all.length) % all.length]);
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
    return `${(0.15 + index * 0.02).toFixed(2)}s`;
  }

  labelFor(accessory: AccessoryId, t: (key: string) => string): string {
    return accessory === 'orejas'
      ? t('assistant.wardrobe_ears')
      : t('assistant.wardrobe.accessories.' + accessory);
  }

  confirm(): void {
    if (this.stageMode() === 'done') return;
    this.look.setLook(this.pick(), this.draft());
    this.stageMode.set('done');
    this.mood.feel('cheer', 1400);
    clearTimeout(this.doneTimer);
    this.doneTimer = setTimeout(
      () => this.closed.emit(),
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
    );
  }

  cancel(): void {
    if (this.stageMode() === 'done') return;
    clearTimeout(this.doneTimer);
    this.closed.emit();
  }

  private sameAccessories(a: readonly AccessoryId[], b: readonly AccessoryId[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id));
  }
}
