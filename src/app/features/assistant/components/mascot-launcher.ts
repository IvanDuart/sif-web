import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';

import { MascotLifeService } from '../mascot/mascot-life.service';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { ORB, gazeToward, lookSide, orbBeside, travelFrom, type Box, type Spot } from '../mascot/placement';
import { MascotLookService } from '../mascot/mascot-look.service';
import { MascotMoodService } from '../mascot/mascot-mood.service';
import { HERO_REST, HeroSecret, heroEnabled, heroSteps, heroTransform, type HeroPose } from '../mascot/mascot-hero';
import { MascotFollowService } from '../mascot/mascot-follow.service';
import { poseTransform } from '../mascot/mascot-follow';
import { SECRET_HELP, installSecrets } from '../mascot/mascot-secrets';
import type { SkinId } from '../mascot/skins/types';

export { ORB };
import type { NoteAction } from '../mascot/mascot-mood.service';
import { StuckFormOfferService } from '../stuck-form-offer.service';
import { MascotStateService } from '../mascot-state.service';
import { MascotBar } from '../bar/mascot-bar';
import { RouteVeil } from '../copilot/route-veil.component';
import { MascotOrb } from './mascot-orb';
import { MascotWardrobe } from './mascot-wardrobe';

/** Lo que deja de margen con lo que no debe tapar. */
const AVOID = '[tuiAlert], tui-alert, tui-toast, [role="dialog"]';

/**
 * Dónde se pone la mascota para atender a ese campo, respecto de su esquina.
 *
 * La geometría vive en `mascot/placement.ts`, que es pura y está probada
 * aparte; aquí sólo se leen del DOM el campo, la ventana y lo que no hay que
 * tapar.
 */
export function measureBeside(target: HTMLElement): {
  travel: { x: number; y: number };
  spot: Spot;
  field: Box;
} {
  const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
  const avoid = Array.from(document.querySelectorAll<HTMLElement>(AVOID))
    .filter((element) => !element.contains(target))
    .map((element) => element.getBoundingClientRect())
    .filter((box) => box.width > 0 && box.height > 0)
    .map((box) => ({ left: box.left, top: box.top, width: box.width, height: box.height }));

  const rect = target.getBoundingClientRect();
  const field: Box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  const spot = orbBeside(field, viewport, avoid);
  return { travel: travelFrom(spot, viewport), spot, field };
}

export function beside(target: HTMLElement): { x: number; y: number } {
  return measureBeside(target).travel;
}

/**
 * Punto de montaje global de la mascota, dentro del `Shell`. Sólo se pinta si
 * el tenant tiene el asistente habilitado (`/assistant/config.enabled`).
 */
@Component({
  selector: 'app-mascot-launcher',
  standalone: true,
  imports: [TranslocoDirective, TuiButton, MascotBar, MascotOrb, MascotWardrobe, RouteVeil],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.visible()) {
      <!-- El suelo que cambia cuando ella navega; ella se queda encima. -->
      <app-route-veil />

      <!-- La conversación entera. La mascota no va dentro: va aquí abajo, y se
           acopla a su borde izquierdo. -->
      <app-mascot-bar />

      @if (state.wardrobeOpen()) {
        <app-mascot-wardrobe (closed)="state.closeWardrobe()" />
      }

      @if (!state.open() && !fill.target() && state.note(); as note) {
        <div
          class="mascot-note"
          [attr.data-tone]="note.tone ?? 'neutral'"
          [attr.role]="note.actions?.length ? 'alertdialog' : 'status'"
          *transloco="let t"
        >
          @if (note.title) {
            <strong>{{ note.title }}</strong>
          }
          <p>{{ note.text }}</p>

          @if (note.actions?.length) {
            <div class="mascot-note__actions">
              @for (action of note.actions; track action.label) {
                <button
                  type="button"
                  tuiButton
                  size="xs"
                  [appearance]="action.primary ? 'primary' : 'flat'"
                  (click)="runAction(action)"
                >
                  {{ action.label }}
                </button>
              }
            </div>
          }

          <button type="button" class="mascot-note__close" [attr.aria-label]="t('common.close')" (click)="state.dismissNote()">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      }

      @if (fill.saying(); as saying) {
        <div
          class="mascot-doing"
          role="status"
          [class.mascot-doing--below]="doingBelow()"
          [class.mascot-doing--right]="doingRight()"
          [style.left.px]="doingRight() ? doingLeft() : null"
          [style.right]="doingRight() ? 'auto' : null"
          [style.transform]="doingTransform()"
          *transloco="let t"
        >
          {{ t(saying.key, saying.values ?? {}) }}
        </div>
      }

      @if (fill.target() !== null && state.questions.current(); as question) {
        <!-- La pregunta que espera, sobre la mascota cuando está fuera de su
             esquina: la barra la repite con sus botones, pero así se ve que la
             propone ella allí donde está trabajando. -->
        <div class="mascot-note mascot-speech" aria-hidden="true" [style.transform]="travelTransform()">
          <p>{{ question.text }}</p>
        </div>
      }

      <button
        type="button"
        class="mascot-fab"
        [class.mascot-fab--docked]="state.barOpen() && !fill.filling() && !flying()"
        [class.mascot-fab--open]="state.open() && !fill.filling()"
        [class.mascot-fab--travelling]="travelling()"
        [class.mascot-fab--passing]="passing()"
        [class.mascot-fab--settling]="settling()"
        [class.mascot-fab--catching]="catching()"
        [class.mascot-fab--file-near]="fileNear()"
        #fab
        (mouseenter)="hover.set(true)"
        (mouseleave)="hover.set(false)"
        (pointerdown)="onFabPointerDown($event)"
        (keydown)="onFabKeydown($event)"
        (blur)="onFabBlur($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="catching.set(false)"
        (drop)="onDrop($event)"
        [style.transform]="fabTransform()"
        [style.--mascot-pose]="fabEase()"
        [style.--mascot-hop]="fill.hopMs() + 'ms'"
        [attr.aria-expanded]="state.open()"
        aria-controls="mascot-bar"
        [attr.aria-label]="state.open() ? t('assistant.close') : t('assistant.open', { name: state.name() })"
        *transloco="let t"
      >
        @if (hero().cape > 0) {
          <!-- La capa es del color de su fruta: ni disfraz nuevo ni dibujo
               que mantener, que para un huevo de pascua sería mucho pedir. -->
          <span class="mascot-cape" aria-hidden="true" [style.opacity]="hero().cape"></span>
        }

        @for (press of pressRing(); track press) {
          <!-- El anillo de la pulsación: late una vez por cada toque que da. -->
          <span class="mascot-press-ring" aria-hidden="true"></span>
        }

        @if (hint(); as hint) {
          <span class="mascot-hint" aria-hidden="true">{{ hintLabel(hint) }}</span>
        }

        <app-mascot-orb
          [mode]="state.orbMode()"
          [skin]="state.skin()"
          [accessories]="state.accessories()"
          [lookX]="lookX()"
          [gaze]="gaze()"
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

    /* La cola romboidal apunta a la mascota. */
    .mascot-doing::after {
      content: '';
      position: absolute;
      right: 18px;
      bottom: -4.5px;
      width: 10px;
      height: 10px;
      background: var(--ink);
      transform: rotate(45deg);
    }

    .mascot-doing.mascot-doing--below {
      bottom: calc(var(--bottom-nav-h, 0px) + var(--mascot-gap, 24px) - 34px);
    }

    .mascot-doing.mascot-doing--below::after {
      top: -4.5px;
      bottom: auto;
    }

    /* A la izquierda del viewport, el bocadillo se abre a la derecha del orbe
       para que nunca se corte por el borde. */
    .mascot-doing.mascot-doing--right {
      right: auto;
    }

    .mascot-doing.mascot-doing--right::after {
      left: -4.5px;
      right: auto;
      top: 50%;
      bottom: auto;
      margin-top: -5px;
    }

    .mascot-fab {
      position: fixed;
      right: var(--mascot-gap, 24px);
      bottom: calc(var(--bottom-nav-h, 0px) + var(--mascot-gap, 24px));
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
      /* La coreografía manda su propia duración y curva; sin ella, el hover. */
      transition:
        right var(--mascot-travel, 800ms) cubic-bezier(0.45, 0, 0.2, 1),
        bottom var(--mascot-travel, 800ms) cubic-bezier(0.45, 0, 0.2, 1),
        transform var(--mascot-pose, var(--motion-duration-fast, 150ms) var(--motion-ease-out, ease-out));
      transform-origin: 50% 92%;

      &:hover {
        transform: translateY(-2px);
      }

      &:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 3px;
      }
    }

    /* Un clic no deja el anillo del teclado pegado a la mascota. */
    .mascot-fab[data-pointer-focus]:focus-visible {
      outline: none;
    }

    /* La píldora de reposo, a su izquierda. */
    .mascot-hint {
      position: absolute;
      right: 60px;
      top: 50%;
      transform: translateY(-50%);
      padding: 6px 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface, #fff);
      box-shadow: var(--shadow-float);
      color: var(--ink);
      font-size: 11.5px;
      font-weight: 500;
      line-height: 1.2;
      white-space: nowrap;
      pointer-events: none;
    }

    /* Con la tarjeta desplegada, la mascota se monta a caballo sobre su borde
       izquierdo, en la fila que importa. El punto lo MIDE la barra y lo deja
       en --mascot-dock-*: la tarjeta cambia de alto con lo que lleve dentro, y
       una posición deducida de constantes la dejaría flotando fuera.

       Va al mismo ritmo que la tarjeta se desenrolla (800ms, misma curva), que
       es lo que hace que parezca que la empuja ella. Viajando NO se acopla: se
       va al campo. */
    .mascot-fab.mascot-fab--docked:not(.mascot-fab--travelling) {
      right: var(--mascot-dock-right, var(--mascot-gap, 24px));
      bottom: var(--mascot-dock-bottom, calc(var(--bottom-nav-h, 0px) + var(--mascot-gap, 24px)));
      transition:
        right var(--mascot-travel, 800ms) cubic-bezier(0.45, 0, 0.2, 1),
        bottom var(--mascot-travel, 800ms) cubic-bezier(0.45, 0, 0.2, 1),
        transform var(--motion-duration-fast, 150ms) var(--motion-ease-out, ease-out);
    }

    /* En tránsito no intercepta clics (por debajo queda el botón de plegar). */
    .mascot-fab--passing {
      pointer-events: none;
    }

    /* Al aterrizar en su esquina, un micro-asentamiento físico. */
    .mascot-fab--settling app-mascot-orb {
      animation: mascot-settle 320ms cubic-bezier(0.34, 1.5, 0.6, 1);
    }

    @keyframes mascot-settle {
      from {
        transform: scale(1.12, 0.88);
      }

      to {
        transform: scale(1, 1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mascot-fab.mascot-fab--docked:not(.mascot-fab--travelling) {
        transition: none;
      }
    }

    /* La capa del héroe: el color de su fruta, detrás de ella. */
    .mascot-cape {
      position: absolute;
      left: 50%;
      top: 46%;
      z-index: -1;
      width: 46px;
      height: 42px;
      transform: translateX(-50%);
      border-radius: 0 0 50% 50% / 0 0 70% 70%;
      background: linear-gradient(180deg, var(--tui-primary, #2f5d4f), transparent);
      transition: opacity 240ms ease-out;
      pointer-events: none;
    }

    /* La nota que la mascota dice por su cuenta, sobre su cabeza. */
    .mascot-note {
      position: fixed;
      right: var(--mascot-gap, 24px);
      bottom: calc(var(--bottom-nav-h, 0px) + 96px);
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

    /* La cola de la nota también apunta a la mascota. */
    .mascot-note::after {
      content: '';
      position: absolute;
      right: 18px;
      bottom: -5.5px;
      width: 10px;
      height: 10px;
      background: var(--surface, #fff);
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      transform: rotate(45deg);
    }

    /* La pregunta sobre la mascota no intercepta clics: los botones están en
       la barra. */
    .mascot-speech {
      pointer-events: none;
      max-width: 260px;
    }

    /* El tono se ve en el filo de la izquierda: ni colorea el fondo ni compite
       con la mascota, que es quien lleva la emoción. */
    .mascot-note[data-tone='danger'] {
      border-left: 3px solid var(--tui-status-negative);
    }

    .mascot-note[data-tone='celebrate'] {
      border-left: 3px solid var(--tui-status-positive);
    }

    /* Con un archivo encima se agranda un poco: te está haciendo sitio. El
       escalado va en el orbe y no en el botón, porque el botón lleva su
       transform inline (viaje, pose) y un transform de clase lo perdería. */
    .mascot-fab--catching app-mascot-orb {
      transform: scale(1.14);
      transition: transform 180ms cubic-bezier(0.2, 0.8, 0.3, 1);
    }

    /* Un archivo anda por la ventana: se asoma para que se sepa dónde soltarlo. */
    .mascot-fab--file-near {
      outline: 2px dashed var(--primary);
      outline-offset: 4px;
      border-radius: 50%;
      animation: mascot-file-near 900ms ease-in-out infinite alternate;
    }

    /* El anillo de cada pulsación: se expande y se apaga, una vez. */
    .mascot-press-ring {
      position: absolute;
      inset: 3px;
      border: 2px solid var(--primary);
      border-radius: 50%;
      pointer-events: none;
      animation: mascot-press-ring 380ms ease-out forwards;
    }

    @keyframes mascot-press-ring {
      from {
        transform: scale(0.8);
        opacity: 0.7;
      }

      to {
        transform: scale(1.65);
        opacity: 0;
      }
    }

    @keyframes mascot-file-near {
      from { outline-color: transparent; }
      to { outline-color: var(--primary); }
    }

    .mascot-note__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .mascot-note__close {
      position: absolute;
      top: 4px;
      right: 4px;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink-3);
      cursor: pointer;
      font-size: 11.5px;
    }

    .mascot-note__close:hover {
      background: var(--sunken);
    }

    .mascot-note__close:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    @media (pointer: coarse) {
      .mascot-note__close {
        width: 36px;
        height: 36px;
      }
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

      .mascot-note {
        right: 16px;
        bottom: calc(var(--bottom-nav-h, 60px) + 84px + env(safe-area-inset-bottom, 0px));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mascot-fab.mascot-fab--travelling,
      .mascot-doing {
        transition: none;
      }

      .mascot-fab {
        transition: none;

        &:hover {
          transform: none;
        }
      }

      .mascot-fab--catching app-mascot-orb {
        transform: none;
        transition: none;
      }

      .mascot-fab--file-near,
      .mascot-press-ring {
        animation: none;
      }

      .mascot-fab--settling app-mascot-orb {
        animation: none;
      }

      .mascot-press-ring {
        opacity: 0.35;
      }

      .mascot-note {
        animation: none;
      }
    }
  `],
})
export class MascotLauncher implements OnInit {
  readonly state = inject(MascotStateService);
  private readonly look = inject(MascotLookService);
  private readonly mood = inject(MascotMoodService);
  private readonly transloco = inject(TranslocoService);
  /** Acompaña el cambio de sección: mira, se agacha y salta. */
  private readonly follow = inject(MascotFollowService);

  readonly fill = inject(MascotFillService);
  private readonly stuck = inject(StuckFormOfferService);
  private readonly life = inject(MascotLifeService);

  /** Dónde está la mascota ahora mismo respecto de su esquina, px. */
  private readonly travel = signal<{ x: number; y: number } | null>(null);
  /** Su sitio absoluto mientras atiende un campo: hace falta para mirar y para el bocadillo. */
  private readonly spot = signal<Spot | null>(null);
  /** El campo activo, para que la mirada lo siga. */
  private readonly field = signal<Box | null>(null);
  /** Hacia dónde mira mientras escribe o señala: -1 izquierda, 1 derecha. */
  protected readonly lookX = signal<-1 | 0 | 1>(0);
  /** La mirada 2D hacia el campo (0,0 cuando descansa). */
  protected readonly gaze = computed(() => {
    const spot = this.spot();
    const field = this.field();
    return spot && field ? gazeToward(spot, field) : { dx: 0, dy: 0 };
  });

  readonly travelTransform = computed(() => {
    const at = this.travel();
    return at ? `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)` : '';
  });

  /**
   * El bocadillo de lo que está haciendo. Cerca del techo no cabe encima de
   * ella, así que se pinta debajo. Su posición va con `bottom` en CSS: el
   * viaje ya lo aplica el `transform`.
   */
  protected readonly doingBelow = computed(() => (this.spot()?.top ?? Number.POSITIVE_INFINITY) < 88);
  /** A la izquierda de la ventana, el bocadillo se pinta a la derecha del orbe. */
  protected readonly doingRight = computed(() => (this.spot()?.left ?? Number.POSITIVE_INFINITY) < 220);
  protected readonly doingLeft = computed(() => {
    const spot = this.spot();
    return spot ? spot.left + ORB + 10 : null;
  });
  protected readonly doingTransform = computed(() => {
    const at = this.travel();
    if (!at) return '';
    return this.doingRight()
      ? `translateY(${at.y.toFixed(1)}px)`
      : `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
  });

  /** El anillo de pulsación: la clave es el contador, para que dos seguidas no se pisen. */
  protected readonly pressRing = computed(() => {
    const presses = this.fill.presses();
    return presses > 0 ? [presses] : [];
  });

  /**
   * Lo mismo, con la rutina de acompañar el cambio de sección encima.
   *
   * El viaje va primero y el gesto después, así que al mirar hacia el menú se
   * asoma desde donde esté, no desde su esquina. El bocadillo usa el viaje a
   * secas: lo que dice no da saltos.
   */
  /** Volando, el vuelo manda: ni acompaña secciones ni se acopla a la tarjeta. */
  protected readonly flying = computed(() => this.hero() !== HERO_REST);

  protected readonly fabTransform = computed(() => {
    const flight = this.hero();
    if (flight !== HERO_REST) return heroTransform(flight);
    return poseTransform(this.follow.pose(), this.travel());
  });

  /** Cómo llega a la pose: lo dice la propia coreografía, y el vuelo manda sobre ella. */
  protected readonly fabEase = computed(() =>
    this.hero() === HERO_REST ? this.follow.pose().ease : this.hero().ease,
  );

  /** Dónde va el vuelo del huevo de pascua. */
  protected readonly hero = signal<HeroPose>(HERO_REST);
  private readonly secret = new HeroSecret();
  private heroTimers: ReturnType<typeof setTimeout>[] = [];

  private readonly fab = viewChild<ElementRef<HTMLElement>>('fab');

  /**
   * Alt + tres clics seguidos y despega.
   *
   * Se escucha en CAPTURA y se corta el evento: con Alt, el clic no llega al
   * orbe y no abre la conversación. Si la abriera, la mascota se iría al borde
   * de la tarjeta en el primer clic y los otros dos caerían en el vacío — que
   * es justo por lo que el huevo de pascua no salía nunca.
   */
  private prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private watchHero(onCleanup: (fn: () => void) => void): void {
    const fab = this.fab()?.nativeElement;
    if (!fab) return;
    const onClick = (event: MouseEvent) => {
      if (!event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (!this.secret.press(event, Date.now())) return;
      if (!heroEnabled() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.flyHero();
    };
    fab.addEventListener('click', onClick, true);
    onCleanup(() => fab.removeEventListener('click', onClick, true));
  }

  private flyHero(): void {
    this.heroTimers.forEach(clearTimeout);
    const viewport = {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
    this.heroTimers = heroSteps(viewport).map(([ms, pose]) =>
      setTimeout(() => this.hero.set(pose ?? HERO_REST), ms),
    );
  }

  /** Viaja: también de vuelta, para que el regreso a su esquina sea el mismo viaje. */
  protected readonly travelling = signal(false);
  /** En tránsito no intercepta clics: debajo está el botón de plegar. */
  protected readonly passing = signal(false);
  /** Micro-rebote al aterrizar en su esquina. */
  protected readonly settling = signal(false);
  private passTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private wasBarOpen = this.state.barOpen();

  constructor() {
    // Sólo en desarrollo: poner una skin o abrir el armario desde la consola
    // cuesta una línea, en vez de cinco clics cada vez que se prueba algo.
    const forget = installSecrets({
      help: () => [...SECRET_HELP],
      wardrobe: () => this.state.openWardrobe(),
      skin: (id) => this.look.setSkin(id as SkinId),
      say: (text) => void this.mood.say({ text, tone: 'neutral' }),
      bar: (open) => (open ? this.state.openPanel() : this.state.closePanel()),
    });
    inject(DestroyRef).onDestroy(forget);

    // El botón no existe hasta que se pinta, y puede volver a crearse.
    afterRenderEffect((onCleanup) => this.watchHero(onCleanup));

    // El campo se mueve mientras llega (el scroll suave, la entrada del
    // diálogo), así que se le sigue cada frame en vez de medirlo una vez.
    effect((onCleanup) => {
      const target = this.fill.target();
      // Mientras el turno siga vivo NO se vuelve a la esquina: se queda donde
      // acabó y la siguiente herramienta sigue desde ahí.
      //
      // Cada herramienta de pantalla llama a `fill.end()` al terminar, y eso
      // deja el objetivo en null. Entre una y la siguiente hay ida y vuelta al
      // modelo —medido el 2026-11-13: entre 1,3 y 1,8 s—, y en ese hueco la
      // mascota se iba a casa y volvía a salir. Un viaje redondo de más por
      // herramienta: en una receta de cuatro ingredientes, ocho.
      //
      // `end()` no distinguía «he terminado esta herramienta» de «he terminado
      // el turno», y quien sabe lo segundo es `sending()`. Se lee siempre, no
      // sólo cuando hace falta, para que al acabar el turno este efecto vuelva
      // a correr y entonces sí se vaya. Si el turno muere, `sending()` cae
      // igual, así que no se queda clavada junto a un campo.
      const enTurno = this.state.sending();
      if (!target) {
        if (enTurno) return;
        this.travel.set(null);
        this.spot.set(null);
        this.field.set(null);
        this.lookX.set(0);
        const home = setTimeout(() => this.travelling.set(false), this.fill.hopMs());
        onCleanup(() => clearTimeout(home));
        return;
      }
      this.travelling.set(true);
      let frame = 0;
      const track = () => {
        const at = measureBeside(target);
        this.travel.set(at.travel);
        this.spot.set(at.spot);
        this.field.set(at.field);
        this.lookX.set(lookSide(at.spot, at.field));
        frame = requestAnimationFrame(track);
      };
      track();
      onCleanup(() => cancelAnimationFrame(frame));
    });

    // Al cerrar, el viaje de vuelta dura 800 ms y termina con un pequeño
    // asentamiento; mientras viaja, no intercepta clics. Al abrir, el mismo
    // viaje (sin asentamiento).
    effect((onCleanup) => {
      const open = this.state.barOpen();
      if (open === this.wasBarOpen) return;
      this.wasBarOpen = open;
      clearTimeout(this.passTimer);
      clearTimeout(this.settleTimer);
      if (this.prefersReducedMotion()) {
        this.passing.set(false);
        this.settling.set(false);
        return;
      }
      this.passing.set(true);
      this.passTimer = setTimeout(() => this.passing.set(false), 800);
      if (!open) {
        this.settleTimer = setTimeout(() => {
          this.settling.set(true);
          this.settleTimer = setTimeout(() => this.settling.set(false), 320);
        }, 760);
      }
      onCleanup(() => {
        clearTimeout(this.passTimer);
        clearTimeout(this.settleTimer);
      });
    });

    // Un archivo que cruza la ventana es una oportunidad de soltárselo: se
    // despierta y se ofrece. Se escucha en el documento porque el arrastre
    // puede venir de cualquier parte de la pantalla, no sólo de su botón.
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      this.dragDepth += 1;
      // Sólo se asoma: el agrandado es para cuando el archivo está ENCIMA del
      // botón, no para cualquier archivo que cruce la ventana.
      this.fileNear.set(true);
      this.life.attend();
    };
    const onDragLeave = () => {
      if (this.dragDepth === 0) return;
      this.dragDepth -= 1;
      if (this.dragDepth > 0) return;
      this.fileNear.set(false);
    };
    const onDragEnd = () => {
      this.dragDepth = 0;
      this.fileNear.set(false);
      // Cancelar con Escape también termina el arrastre aunque el archivo
      // siguiera encima del botón: el agrandado se retira con él.
      this.catching.set(false);
    };

    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDragEnd);
    document.addEventListener('dragend', onDragEnd);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDragEnd);
      document.removeEventListener('dragend', onDragEnd);
      clearTimeout(this.passTimer);
      clearTimeout(this.settleTimer);
    });
  }

  ngOnInit(): void {
    this.state.loadConfig();
    // Mira desde aquí, que es donde vive la mascota: si el centro la tiene
    // apagada, `isBusy` lo ve en `visible()` y no se ofrece nada.
    this.stuck.start();
  }

  /** Le están acercando un archivo: abre los brazos. */
  protected readonly catching = signal(false);
  /** Hay un archivo volando por la ventana: se ofrece a que se lo suelten. */
  protected readonly fileNear = signal(false);
  /** El puntero está sobre ella: en reposo enseña para qué sirve. */
  protected readonly hover = signal(false);
  private dragDepth = 0;

  /**
   * La píldora de reposo: sólo en su esquina, sin nota, sin barra y sin volar.
   * Con un archivo cerca pide que se lo suelten; con el puntero encima se
   * presenta. Nunca roba el sitio a una nota ni a una pregunta.
   */
  protected readonly hint = computed<{ key?: string; text?: string } | null>(() => {
    if (
      this.state.open() ||
      this.state.note() ||
      this.state.barOpen() ||
      this.flying() ||
      this.fill.target() !== null
    ) {
      return null;
    }
    // Qué se puede soltar y qué se hace con ello: un ticket de báscula, una
    // analítica o la dieta en PDF. Decirlo al acercar el archivo ahorra el
    // «¿esto lo entiende?» de probarlo a ciegas.
    if (this.fileNear() || this.catching()) return { key: 'assistant.drop_hint' };
    if (this.hover() && this.state.orbMode() === 'idle') return { text: this.state.name() };
    return null;
  });

  /**
   * La píldora mezcla una clave de i18n y un nombre propio: no todo es clave.
   *
   * Si el idioma todavía no trae la clave de la pista —los tests montan un
   * Transloco mínimo—, se usa la de siempre, que dice lo mismo con menos
   * detalle: mejor eso que una píldora en blanco.
   */
  protected hintLabel(hint: { key?: string; text?: string }): string {
    if (!hint.key) return hint.text ?? '';
    const label = this.transloco.translate(hint.key);
    return label === hint.key ? this.transloco.translate('assistant.attachment_drop') : label;
  }

  /**
   * Soltarle un archivo encima es dárselo: abre el panel con él adjunto, que
   * es donde se puede decir qué quieres que haga con eso.
   */
  protected onDragOver(event: DragEvent): void {
    if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return;
    // Sin esto el navegador abre el archivo y se lleva por delante la sesión.
    event.preventDefault();
    this.catching.set(true);
  }

  /** El anillo de foco es para quien llega con Tab, no para un clic. */
  protected onFabPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setAttribute('data-pointer-focus', '');
  }

  protected onFabKeydown(event: KeyboardEvent): void {
    (event.currentTarget as HTMLElement).removeAttribute('data-pointer-focus');
  }

  protected onFabBlur(event: FocusEvent): void {
    (event.currentTarget as HTMLElement).removeAttribute('data-pointer-focus');
    this.hover.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return;
    event.preventDefault();
    this.catching.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.state.openPanel();
    this.state.attach(file);
  }

  /**
   * Lo que ofrecía la nota. Se retira antes de hacerlo: si la acción abre el
   * panel, la nota ya no está ahí para parpadear por detrás.
   */
  protected runAction(action: NoteAction): void {
    this.state.dismissNote();
    action.run();
  }
}
