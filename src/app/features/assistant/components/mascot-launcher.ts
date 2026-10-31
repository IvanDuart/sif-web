import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { MascotStateService } from '../mascot-state.service';
import { MascotOrb } from './mascot-orb';
import { MascotPanel } from './mascot-panel';
import { MascotWardrobe } from './mascot-wardrobe';

/** Lo que mide el FAB y lo que guarda de su esquina (lo mismo que su CSS). */
export const ORB = 62;
const REST_RIGHT = 24;
const REST_BOTTOM = 24;
/** Lo que deja entre ella y el campo. */
const GAP = 14;

/**
 * Dónde se pone la mascota para atender a ese campo, respecto de su esquina.
 * A su izquierda si cabe —es donde menos tapa— y si no, a su derecha; siempre
 * dentro de la pantalla.
 */
export function beside(target: HTMLElement): { x: number; y: number } {
  const rect = target.getBoundingClientRect();
  const restLeft = window.innerWidth - REST_RIGHT - ORB;
  const restTop = window.innerHeight - REST_BOTTOM - ORB;

  const left = rect.left - GAP - ORB;
  const wanted = left >= 8 ? left : rect.right + GAP;
  const x = Math.min(Math.max(wanted, 8), window.innerWidth - ORB - 8);
  const y = Math.min(Math.max(rect.top + rect.height / 2 - ORB / 2, 8), window.innerHeight - ORB - 8);
  return { x: x - restLeft, y: y - restTop };
}

/**
 * Punto de montaje global de la mascota, dentro del `Shell`. Sólo se pinta si
 * el tenant tiene el asistente habilitado (`/assistant/config.enabled`).
 */
@Component({
  selector: 'app-mascot-launcher',
  standalone: true,
  imports: [TranslocoDirective, MascotOrb, MascotPanel, MascotWardrobe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.visible()) {
      @if (state.open()) {
        <div class="mascot-backdrop" aria-hidden="true" (click)="state.closePanel()"></div>
        <app-mascot-panel />
      }

      @if (state.wardrobeOpen()) {
        <app-mascot-wardrobe (closed)="state.closeWardrobe()" />
      }

      @if (!state.open() && state.note(); as note) {
        <div class="mascot-note" role="status" *transloco="let t">
          @if (note.title) {
            <strong>{{ note.title }}</strong>
          }
          <p>{{ note.text }}</p>
          <button type="button" class="mascot-note__close" [attr.aria-label]="t('common.close')" (click)="state.dismissNote()">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      }

      @if (fill.saying(); as saying) {
        <div class="mascot-doing" role="status" [style.transform]="travelTransform()" *transloco="let t">
          {{ t(saying.key, saying.values ?? {}) }}
        </div>
      }

      <button
        type="button"
        class="mascot-fab"
        [class.mascot-fab--open]="state.open() && !fill.filling()"
        [class.mascot-fab--travelling]="travelling()"
        [style.transform]="travelTransform()"
        [style.--mascot-hop]="fill.hopMs() + 'ms'"
        [attr.aria-expanded]="state.open()"
        aria-controls="mascot-panel"
        [attr.aria-label]="state.open() ? t('assistant.close') : t('assistant.open', { name: state.name() })"
        *transloco="let t"
      >
        <app-mascot-orb
          [mode]="state.orbMode()"
          [skin]="state.skin()"
          [accessories]="state.accessories()"
          size="m"
          (activated)="state.toggle()"
        />
      </button>
    }
  `,
  styles: [`
    :host { display: contents; }

    /* Viajando: va al campo con la duración que le pasa el relleno, y deja de
       responder al hover para que el salto no se le sume. */
    .mascot-fab.mascot-fab--travelling {
      z-index: 1100;
      transition: transform var(--mascot-hop, 450ms) cubic-bezier(0.45, 0, 0.2, 1);
    }

    /* Lo que va diciendo mientras rellena, junto a ella. */
    .mascot-doing {
      position: fixed;
      right: 24px;
      bottom: 94px;
      z-index: 1100;
      max-width: 240px;
      padding: 7px 12px;
      border-radius: 12px;
      background: var(--ink);
      color: var(--surface);
      font-size: 12px;
      line-height: 1.4;
      pointer-events: none;
      transition: transform var(--mascot-hop, 450ms) cubic-bezier(0.45, 0, 0.2, 1);
    }

    .mascot-fab {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 300;
      display: grid;
      place-items: center;
      width: 62px;
      height: 62px;
      padding: 3px;
      /* Sin plato: sólo la mascota. El botón es el área de toque, y la sombra
         es la de la propia mascota, lo que la despega de lo que haya debajo. */
      border: 0;
      border-radius: 50%;
      background: none;
      filter: drop-shadow(0 4px 8px rgb(31 29 26 / 0.22)) drop-shadow(0 1px 2px rgb(31 29 26 / 0.14));
      cursor: pointer;
      transition: transform var(--motion-duration-fast, 150ms) var(--motion-ease-out, ease-out);

      &:hover {
        transform: translateY(-2px);
      }

      &:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 3px;
      }
    }

    .mascot-backdrop {
      display: none;
    }

    /* La nota que la mascota dice por su cuenta, sobre su cabeza. */
    .mascot-note {
      position: fixed;
      right: 24px;
      bottom: 96px;
      z-index: 301;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-width: 240px;
      padding: 10px 28px 10px 12px;
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      background: var(--surface, #fff);
      box-shadow: var(--shadow-float);
      animation: mascot-note-in 180ms var(--motion-ease-out, ease-out);
    }

    .mascot-note strong {
      font-size: 12.5px;
      color: var(--ink);
    }

    .mascot-note p {
      margin: 0;
      font-size: 12px;
      line-height: 1.4;
      color: var(--ink-2);
    }

    .mascot-note__close {
      position: absolute;
      top: 4px;
      right: 4px;
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink-3);
      cursor: pointer;
      font-size: 10px;
    }

    .mascot-note__close:hover {
      background: var(--sunken);
    }

    @keyframes mascot-note-in {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to { opacity: 1; transform: none; }
    }

    @media (max-width: 640px) {
      .mascot-fab {
        right: 16px;
        bottom: calc(var(--bottom-nav-h, 60px) + 14px + env(safe-area-inset-bottom, 0px));
      }

      .mascot-fab--open {
        opacity: 0;
        pointer-events: none;
      }

      .mascot-note {
        right: 16px;
        bottom: calc(var(--bottom-nav-h, 60px) + 84px + env(safe-area-inset-bottom, 0px));
      }

      .mascot-backdrop {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 299;
        background: rgb(31 29 26 / 0.35);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mascot-fab {
        transition: none;

        &:hover {
          transform: none;
        }
      }

      .mascot-note {
        animation: none;
      }
    }
  `],
})
export class MascotLauncher implements OnInit {
  readonly state = inject(MascotStateService);
  readonly fill = inject(MascotFillService);

  /** Dónde está la mascota ahora mismo respecto de su esquina, px. */
  private readonly travel = signal<{ x: number; y: number } | null>(null);

  readonly travelTransform = computed(() => {
    const at = this.travel();
    return at ? `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)` : '';
  });

  /** Viaja: también de vuelta, para que el regreso a su esquina sea el mismo viaje. */
  protected readonly travelling = signal(false);

  constructor() {
    // El campo se mueve mientras llega (el scroll suave, la entrada del
    // diálogo), así que se le sigue cada frame en vez de medirlo una vez.
    effect((onCleanup) => {
      const target = this.fill.target();
      if (!target) {
        this.travel.set(null);
        const home = setTimeout(() => this.travelling.set(false), this.fill.hopMs());
        onCleanup(() => clearTimeout(home));
        return;
      }
      this.travelling.set(true);
      let frame = 0;
      const track = () => {
        this.travel.set(beside(target));
        frame = requestAnimationFrame(track);
      };
      track();
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }

  ngOnInit(): void {
    this.state.loadConfig();
  }
}
