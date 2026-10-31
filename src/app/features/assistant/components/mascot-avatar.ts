import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { AnimationItem, LottiePlayer } from 'lottie-web';

export type MascotMood = 'idle' | 'thinking';

const DEFAULT_FALLBACK = 'pets/brocoli.svg';

/**
 * Avatar de la mascota.
 *
 * - Si el tenant configuró animaciones Lottie (`animations.idle` /
 *   `animations.thinking`), se reproducen con `lottie-web` (cargado bajo
 *   demanda, en su propio chunk).
 * - Si no, se usa el SVG de mascota, que ya trae pestañeo y respiración
 *   propios (`public/pets/*.svg`).
 * - Si la URL configurada falla, cae al SVG por defecto sin romper el panel.
 * - `prefers-reduced-motion` detiene el Lottie y los puntos de "pensando".
 */
@Component({
  selector: 'app-mascot-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width.px]': 'sizePx()',
    '[style.height.px]': 'sizePx()',
  },
  template: `
    <span class="media">
      <img
        [src]="resolvedSrc()"
        [alt]="alt()"
        [class.is-hidden]="lottieReady()"
        (error)="onError()"
        draggable="false"
      />
      <span
        #lottieHost
        class="lottie"
        [class.is-visible]="lottieReady()"
        aria-hidden="true"
      ></span>
    </span>

    @if (mood() === 'thinking') {
      <span class="thought" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
    }
  `,
  styles: [`
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      flex: none;
    }

    .media {
      position: relative;
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 50%;
      background: var(--primary-soft);
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      animation: mascot-float 4.5s ease-in-out infinite;
      user-select: none;
    }

    img.is-hidden {
      visibility: hidden;
    }

    .lottie {
      position: absolute;
      inset: 0;
      display: none;
    }

    .lottie.is-visible {
      display: block;
    }

    .thought {
      position: absolute;
      top: -5px;
      right: -7px;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px 5px;
      border: 1px solid var(--line);
      border-radius: var(--r-pill);
      background: var(--surface, #fff);
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.08);
      pointer-events: none;
    }

    .thought span {
      width: 3.5px;
      height: 3.5px;
      border-radius: 50%;
      background: var(--ink-3);
      animation: mascot-thought 1.15s ease-in-out infinite;
    }

    .thought span:nth-child(2) { animation-delay: 0.14s; }
    .thought span:nth-child(3) { animation-delay: 0.28s; }

    @media (hover: hover) and (prefers-reduced-motion: no-preference) {
      .media:hover {
        animation: mascot-tilt 480ms var(--motion-ease-out, ease-out);
      }
    }

    @keyframes mascot-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    @keyframes mascot-tilt {
      0%, 100% { transform: rotate(0); }
      30% { transform: rotate(-5deg); }
      65% { transform: rotate(4deg); }
    }

    @keyframes mascot-thought {
      0%, 100% { opacity: 0.3; transform: translateY(0); }
      50% { opacity: 1; transform: translateY(-2px); }
    }

    @media (prefers-reduced-motion: reduce) {
      img { animation: none; }

      .thought span {
        animation: none;
        opacity: 0.6;
      }
    }
  `],
})
export class MascotAvatar {
  src = input.required<string>();
  fallback = input(DEFAULT_FALLBACK);
  alt = input('');
  size = input<'s' | 'm' | 'l'>('m');
  mood = input<MascotMood>('idle');

  /** Animaciones Lottie opcionales del tenant. Tienen prioridad sobre el SVG. */
  idleAnimation = input<string | null>(null);
  thinkingAnimation = input<string | null>(null);

  readonly sizePx = computed(() => (this.size() === 's' ? 40 : this.size() === 'l' ? 72 : 56));
  readonly lottieReady = signal(false);

  /** Guarda la URL que falló, no un booleano: al cambiar `src` se reintenta. */
  private readonly failedSrc = signal<string | null>(null);

  /** Igual para Lottie: si cambia la URL configurada, se vuelve a intentar. */
  private readonly failedLottieUrl = signal<string | null>(null);

  private readonly lottieHost = viewChild<ElementRef<HTMLElement>>('lottieHost');
  private readonly destroyRef = inject(DestroyRef);
  private animation: AnimationItem | null = null;

  readonly resolvedSrc = computed(() =>
    this.failedSrc() === this.src() ? this.fallback() : this.src()
  );

  /** La animación que toca según el estado; `null` si no hay o ya falló. */
  readonly animationUrl = computed(() => {
    const candidate = this.mood() === 'thinking'
      ? (this.thinkingAnimation() || this.idleAnimation())
      : this.idleAnimation();

    if (!candidate || this.failedLottieUrl() === candidate) return null;
    return candidate;
  });

  constructor() {
    effect((onCleanup) => {
      const url = this.animationUrl();
      const host = this.lottieHost()?.nativeElement;

      this.destroyAnimation();
      this.lottieReady.set(false);
      if (!url || !host) return;

      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
        this.destroyAnimation();
      });

      void import('lottie-web').then((module) => {
        if (cancelled) return;

        // `lottie-web` es CJS: según el interop, el player puede venir en
        // `default` o como el propio namespace.
        const lottie: Pick<LottiePlayer, 'loadAnimation'> | undefined =
          module.default ?? (module as unknown as Pick<LottiePlayer, 'loadAnimation'>);
        if (!lottie?.loadAnimation || !host.isConnected) return;

        const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        const animation = lottie.loadAnimation({
          container: host,
          renderer: 'svg',
          loop: true,
          autoplay: !reduced,
          path: url,
        });
        this.animation = animation;

        animation.addEventListener('DOMLoaded', () => {
          if (cancelled) return;
          this.lottieReady.set(true);
          if (reduced) animation.goToAndStop(0, true);
        });
        animation.addEventListener('data_failed', () => this.onLottieError(url, cancelled));
        animation.addEventListener('error', () => this.onLottieError(url, cancelled));
      }).catch(() => {
        if (!cancelled) this.failedLottieUrl.set(url);
      });
    });

    this.destroyRef.onDestroy(() => this.destroyAnimation());
  }

  onError(): void {
    this.failedSrc.set(this.src());
  }

  private onLottieError(url: string, cancelled: boolean): void {
    if (cancelled) return;
    this.lottieReady.set(false);
    this.failedLottieUrl.set(url);
    this.destroyAnimation();
  }

  private destroyAnimation(): void {
    this.animation?.destroy();
    this.animation = null;
  }
}
