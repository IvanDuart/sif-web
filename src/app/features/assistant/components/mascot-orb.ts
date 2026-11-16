import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { startBlink, startMotion, type Condition, type MoodKind, type Scene } from '../mascot/agentMotion';
import { personalityOf } from '../mascot/skins/personalities';
import { MascotLifeService, type MascotLife, type MascotMode } from '../mascot/mascot-life.service';
import { AWAY_AFTER_MS, WELCOME_AFTER_MS } from '../mascot/mascot-life.service';
import { MascotMoodService } from '../mascot/mascot-mood.service';
import { ARCH, EYE_CX, EYE_CY, EYE_H, EYE_W, FACES, K, OPEN, SHUT, type EyeState } from '../mascot/skins/faces';
import { earsOf, geometryOf, mixGeometry, outlinePath, type Ear, type Geometry } from '../mascot/skins/outlines';
import { DEFAULT_SKIN, type AccessoryId, type SkinId } from '../mascot/skins/types';

type Eyes = readonly [EyeState, EyeState];
const pair = (eye: EyeState): Eyes => [eye, eye];
const bar = (s: number, x = 0, y = 0): EyeState => ({ s, x, y, look: 'bar' });

/** Cuánto tarda una skin en convertirse en otra. */
const MORPH_MS = 480;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

let nextId = 0;

/**
 * El orb de la mascota: el agente con dos ojos cuya forma dice lo que hace el
 * asistente, más su vida propia (mirar de reojo, girar, marearse, sonrojarse,
 * enojarse, mirar el teléfono, dormirse) y lo que siente.
 *
 * Es puramente visual. El estado del chat vive en `MascotStateService`; la
 * vida propia en `MascotLifeService`; los moods en `MascotMoodService`.
 */
@Component({
  selector: 'app-mascot-orb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mascot-orb.html',
  styleUrl: './mascot-orb.scss',
  host: {
    '[style.width.px]': 'sizePx()',
    '[style.height.px]': 'sizePx()',
    '[class.is-decorative]': 'decorative() || mirror()',
    '[class.is-still]': 'still()',
    '[attr.aria-hidden]': 'decorative() || mirror() ? "true" : null',
    '(pointerenter)': 'awake.set(true)',
    '(pointerleave)': 'onLeave()',
    '(pointermove)': 'onMove($event)',
    '(click)': 'onClick()',
  },
})
export class MascotOrb implements OnInit {
  private readonly lifeService = inject(MascotLifeService);
  private readonly moodService = inject(MascotMoodService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input<MascotMode>('idle');
  readonly skin = input<SkinId>(DEFAULT_SKIN);
  readonly accessories = input<readonly AccessoryId[]>([]);
  readonly size = input<'s' | 'm' | 'l'>('m');
  readonly still = input(false);
  /** Sin vida propia ni interacción: para avatares de mensajes. */
  readonly decorative = input(false);
  /**
   * Refleja la vida del orb principal (el del launcher) sin controlarla:
   * para el orb del header del panel, que así se marea, se duerme o saca el
   * teléfono igual que el FAB.
   */
  readonly mirror = input(false);

  /** La persona pulsó el orb y no estaba mareada: el launcher decide qué hacer. */
  readonly activated = output<void>();

  /**
   * Escena de vista previa (el armario): manda sobre la vida y el humor, y se
   * pinta también en un orb decorativo, que no tiene vida propia.
   */
  readonly previewScene = input<Scene | null>(null);

  /** Hacia dónde mirar mientras escribe o señala: -1 izquierda, 1 derecha. */
  readonly lookX = input<-1 | 0 | 1>(0);

  /** Mirada 2D hacia el campo que atiende (px, vector corto). */
  readonly gaze = input<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  /** Sube cada vez que cambia la skin: reinicia el destello radial. */
  readonly skinPulse = signal(0);
  protected readonly bursts = computed(() => (this.skinPulse() > 0 ? [this.skinPulse()] : []));
  private lastSkin: SkinId | null = null;

  readonly awake = signal(false);
  private readonly away = signal(false);

  /** Id único para el `clipPath` (dos orbs en el DOM no deben compartir id). */
  readonly clipId = `mascot-agent-${nextId++}`;
  readonly clipUrl = computed(() => `url(#${this.clipId})`);

  readonly bodyD = signal('');
  readonly litD = signal('');
  readonly dark = signal('#2f6b3a');
  readonly light = signal('#3f8a4d');
  readonly spot = signal<readonly number[]>([56, 38, -30, 50, 62, 0.9]);
  readonly halo = signal(0);
  /** Las orejas, medidas sobre el contorno de la skin que se esté dibujando. */
  readonly ears = signal<readonly Ear[]>([]);

  private readonly orb = viewChild<ElementRef<HTMLElement>>('orb');
  private current: Geometry | null = null;
  private morphFrame = 0;
  private awaySince = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  readonly sizePx = computed(() => (this.size() === 's' ? 40 : this.size() === 'l' ? 72 : 56));

  /** El orb se dibuja siempre en una caja de 48px y se escala al tamaño pedido. */
  readonly scale = computed(() => this.sizePx() / 48);

  // Constantes de la cara expuestas al template.
  readonly eyeCx = EYE_CX;
  readonly eyeCy = EYE_CY;
  readonly eyeW = EYE_W;
  readonly eyeH = EYE_H;

  readonly hasEars = computed(() => this.accessories().includes('orejas'));

  readonly life = computed(() => (this.decorative() ? null : this.lifeService.life()));
  readonly mood = computed<MoodKind | null>(() => this.moodService.mood()?.kind ?? null);
  readonly conditions = this.moodService.conditions;

  /** Lo que se anima: primero lo que hace por su cuenta, luego lo que siente, luego una condición. */
  /** Quién es esta fruta: decide qué le flota alrededor (`skins/personalities.ts`). */
  private readonly who = computed(() => personalityOf(this.skin()));

  protected readonly wantsHearts = computed(
    () => this.who().happy.bits === 'heart' || this.who().happy.bits === 'both',
  );
  protected readonly wantsStars = computed(
    () => this.who().happy.bits === 'star' || this.who().happy.bits === 'both',
  );
  protected readonly wantsMark = computed(() => this.who().angry.mark);

  readonly scene = computed<Scene | null>(() => {
    const preview = this.previewScene();
    if (preview) return preview;
    const life = this.life();
    // `peek` sólo cambia los ojos; no tiene animación propia.
    if (life && life.kind !== 'peek') return life.kind;
    const mood = this.mood();
    if (mood) return mood;
    const [condition] = this.conditions();
    if (condition && (this.mode() === 'idle' || this.mode() === 'listening')) return condition;
    return null;
  });

  readonly eyes = computed<[Eyes, number | null]>(() => {
    const preview = this.previewScene();
    if (preview) return this.previewEyes(preview);
    const life = this.life();
    const mood = this.mood();
    const [condition] = this.conditions();
    const mode = this.mode();

    if (life) return this.withLife(this.eyesOf(mode), life, this.skin());
    if (mood) {
      const moodEyes = this.moodEyes(mood);
      if (moodEyes) return [moodEyes, null];
    }
    if (condition && (mode === 'idle' || mode === 'listening')) return [this.conditionEyes(condition), null];
    return this.eyesOf(mode);
  });

  readonly blink = computed(() => this.eyes()[1]);

  constructor() {
    effect(() => {
      if (this.decorative() || this.mirror()) return;
      this.lifeService.mode.set(this.mode());
      this.lifeService.awake.set(this.awake());
      this.lifeService.still.set(this.still());
      this.lifeService.away.set(this.away());
    });

    // Después de pintar, no antes: el teléfono, las zetas o los humos los crea
    // el `@if` de la plantilla, y la animación tiene que encontrarlos ya en el
    // DOM para encenderlos (si no, se quedan en `opacity: 0`).
    afterRenderEffect((onCleanup) => {
      const orb = this.orb()?.nativeElement;
      const scene = this.scene();
      if (!orb || !scene) return;
      onCleanup(startMotion(orb, scene, this.skin(), this.still() || this.prefersReducedMotion()));
    });

    afterRenderEffect((onCleanup) => {
      const orb = this.orb()?.nativeElement;
      const blink = this.blink();
      if (!orb || blink === null || this.still() || this.prefersReducedMotion()) return;
      onCleanup(startBlink(orb, blink));
    });

    // Morphing entre skins: RAF sobre los paths, sin disparar CD por frame si
    // el sistema pide menos movimiento.
    effect(() => {
      const target = geometryOf(this.skin());
      if (this.still() || this.prefersReducedMotion()) {
        this.current = target;
        this.draw(target);
        return;
      }
      this.morphTo(target);
    });

    // Al cambiar de fruta, un destello radial cálido (sólo si el orbe vive).
    effect(() => {
      const skin = this.skin();
      if (this.lastSkin === null) {
        this.lastSkin = skin;
        return;
      }
      if (skin === this.lastSkin) return;
      this.lastSkin = skin;
      if (this.still() || this.prefersReducedMotion()) return;
      this.skinPulse.update((pulse) => pulse + 1);
    });

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.morphFrame);
    });
  }

  ngOnInit(): void {
    // Un orbe quieto (armario, avatares) no necesita reloj de ausencia: y un
    // temporizador de 120 s en un test deja `whenStable()` esperando.
    if (this.decorative() || this.mirror() || this.still()) return;

    const markAway = () => {
      if (this.away()) return;
      this.awaySince = Date.now();
      this.away.set(true);
      clearTimeout(this.idleTimer);
    };
    const schedule = () => {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(markAway, AWAY_AFTER_MS);
    };
    const activity = () => {
      if (document.hidden) return;
      if (this.away()) {
        const since = this.awaySince;
        this.away.set(false);
        this.lifeService.attend();
        if (
          Date.now() - since >= WELCOME_AFTER_MS &&
          (this.mode() === 'idle' || this.mode() === 'listening')
        ) {
          this.moodService.feel('welcome');
        }
      }
      schedule();
    };
    const onVisibility = () => {
      if (document.hidden) markAway();
      else activity();
    };
    const activityEvents = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const type of activityEvents) window.addEventListener(type, activity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    this.destroyRef.onDestroy(() => {
      for (const type of activityEvents) window.removeEventListener(type, activity);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(this.idleTimer);
    });
  }

  onClick(): void {
    if (this.decorative() || this.mirror()) return;
    if (this.lifeService.press()) return;
    this.activated.emit();
  }

  onMove(event: PointerEvent): void {
    if (this.decorative() || this.mirror()) return;
    this.lifeService.move(event.clientX, event.clientY);
  }

  onLeave(): void {
    this.awake.set(false);
    if (this.decorative() || this.mirror()) return;
    this.lifeService.leave();
  }

  // ── Dibujo ───────────────────────────────────────────────────────────

  private morphTo(target: Geometry): void {
    cancelAnimationFrame(this.morphFrame);
    const from = this.current;
    if (!from) {
      this.current = target;
      this.draw(target);
      return;
    }
    if (from === target) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / MORPH_MS);
      const geometry = progress < 1 ? mixGeometry(from, target, easeInOut(progress)) : target;
      this.current = geometry;
      this.draw(geometry);
      if (progress < 1) this.morphFrame = requestAnimationFrame(tick);
    };
    this.morphFrame = requestAnimationFrame(tick);
  }

  private draw(geometry: Geometry): void {
    this.bodyD.set(outlinePath(geometry.cx, geometry.cy, geometry.body));
    this.litD.set(outlinePath(geometry.cx, geometry.cy, geometry.lit));
    this.dark.set(geometry.dark);
    this.light.set(geometry.light);
    this.spot.set(geometry.spot);
    this.halo.set(geometry.halo);
    this.ears.set(earsOf(geometry));
  }

  // ── Ojos ─────────────────────────────────────────────────────────────

  private eyesOf(mode: MascotMode): [Eyes, number | null] {
    switch (mode) {
      case 'idle':
        return this.awake() ? [pair(OPEN), 1] : [pair(SHUT), null];
      case 'listening':
        return [pair(bar(13 / 12)), 13 / 12];
      case 'thinking':
        return [pair(bar(10 / 12, 2, -6)), null];
      case 'acting': {
        const gaze = this.gaze();
        const looking = gaze.dx !== 0 || gaze.dy !== 0;
        return [pair(bar(1, looking ? gaze.dx : this.lookX() * 2.5, looking ? gaze.dy : 0)), 1];
      }
      case 'confirm': {
        const gaze = this.gaze();
        const looking = gaze.dx !== 0 || gaze.dy !== 0;
        return [pair(bar(1, looking ? gaze.dx : -3, looking ? gaze.dy : 1)), 1];
      }
      case 'paused':
      case 'sleeping':
        return [pair(SHUT), null];
      case 'done':
      case 'happy':
        return [pair(ARCH), null];
      case 'confused':
        return [pair(bar(0.75, -2, 2)), 1];
      case 'reading':
        return [pair(bar(1, 2, -4)), 1];
      case 'wardrobe':
        return [pair(bar(1, 0, 1)), 1];
      default:
        return [pair(SHUT), null];
    }
  }

  private withLife([eyes, blink]: [Eyes, number | null], life: MascotLife, skin: SkinId): [Eyes, number | null] {
    switch (life.kind) {
      case 'peek':
        return [
          [0, 1].map((index) =>
            index === life.eye ? bar(1, life.dx, life.dy) : bar(SHUT.s, life.dx, SHUT.y + life.dy),
          ) as unknown as Eyes,
          null,
        ];
      case 'spin':
        return [pair(OPEN), null];
      case 'dizzy':
        return [pair({ s: 1, x: 0, y: 0, look: 'spiral' }), null];
      case 'blush':
        return [pair(this.personaEyes(skin, 'blush')), null];
      case 'angry':
        return [pair(this.personaEyes(skin, 'angry')), null];
      case 'sleep':
        return [pair(bar(2 / 12, 0, 3)), null];
      case 'phone':
        return life.glance ? [pair(bar(1, -3, -3)), null] : [pair(bar(9 / 12, 3, 4)), 9 / 12];
      default:
        return [eyes, blink];
    }
  }

  /** Los ojos de una escena de vista previa: cada fruta enseña su reacción. */
  private previewEyes(scene: Scene): [Eyes, number | null] {
    switch (scene) {
      case 'blush':
        return [pair(this.personaEyes(this.skin(), 'blush')), null];
      case 'angry':
        return [pair(this.personaEyes(this.skin(), 'angry')), null];
      case 'sleep':
        return [pair(bar(2 / 12, 0, 3)), null];
      case 'cheer':
      case 'proud':
      case 'water':
      case 'highfive':
      case 'welcome':
        return [pair(ARCH), null];
      case 'dizzy':
        return [pair({ s: 1, x: 0, y: 0, look: 'spiral' }), null];
      case 'worried':
        return [pair(bar(0.75, -2, 2)), null];
      case 'phone':
        return [pair(bar(9 / 12, 3, 4)), 9 / 12];
      case 'notes':
        return [pair(bar(0.9, -2.5, 2.5)), 0.9];
      default:
        return [pair(bar(1, 0, 1)), 1];
    }
  }

  private moodEyes(mood: MoodKind): Eyes | null {
    switch (mood) {
      case 'worried':
        return pair(bar(0.75, -2, 2));
      case 'cheer':
      case 'highfive':
      case 'welcome':
      case 'proud':
        return pair(ARCH);
      case 'notes':
        return pair(bar(0.9, -2.5, 2.5));
      default:
        return null;
    }
  }

  private conditionEyes(condition: Condition): Eyes {
    return condition === 'offline' ? pair(bar(0.5, 0, 1)) : pair(bar(0.35, 0, 2));
  }

  /** Cada skin reacciona a su manera: aquí basta con distinguir sonrojo de enojo. */
  private personaEyes(skin: SkinId, kind: 'blush' | 'angry'): EyeState {
    if (kind === 'angry') return bar(0.5, 0, 1);
    return skin === 'pina' ? bar(0.9, 2, 1) : bar(0.85, 0, 2);
  }

  // ── Helpers de la cara ───────────────────────────────────────────────

  readonly eyePositions = computed(() => FACES[this.skin()].eyes);
  readonly eyeColour = computed(() => FACES[this.skin()].colour);

  /**
   * Las gafas siguen la altura de los ojos de cada fruta (`FACES[skin]`) y una
   * fracción de hacia dónde miran, para que ni en la semilla ni en la naranja
   * ni en las miniaturas del estante se queden desencajadas.
   */
  readonly glassesTransform = computed(() => {
    const [, top] = this.eyePositions()[0];
    const [eye] = this.eyes()[0];
    const dx = (eye.x * K * 0.4).toFixed(2);
    const dy = (top + EYE_CY + eye.y * K).toFixed(2);
    return `translate(${dx}px, ${dy}px)`;
  });

  eyeTransform(index: number): string {
    const [left, top] = this.eyePositions()[index];
    return `translate(${left}px, ${top}px)`;
  }

  lookTransform(eye: EyeState): string {
    return `translate(${eye.x * K}px, ${eye.y * K}px)`;
  }

  barTransform(eye: EyeState): string {
    return `scaleY(${eye.s})`;
  }

  barOpacity(eye: EyeState): number {
    return eye.look === 'bar' ? 1 : 0;
  }

  archOpacity(eye: EyeState): number {
    return eye.look === 'arch' ? 1 : 0;
  }

  spiralOpacity(eye: EyeState): number {
    return eye.look === 'spiral' ? 1 : 0;
  }

  /** Las cejas: enfado o preocupación. */
  showBrows(): boolean {
    return this.life()?.kind === 'angry' || this.mood() === 'worried';
  }

  /** Preocupada inclina las cejas hacia arriba en el centro; enfadada, hacia abajo. */
  browKind(): 'angry' | 'sorry' {
    return this.life()?.kind === 'angry' ? 'angry' : 'sorry';
  }

  browOpacity(): number {
    return this.life()?.kind === 'angry' ? 1 : 0.8;
  }

  browPath(index: number): string {
    const x = EYE_CX;
    const y = EYE_CY;
    if (this.browKind() === 'sorry') {
      return index === 0
        ? `M${x - 12} ${y - 21} L${x + 10} ${y - 29}`
        : `M${x - 10} ${y - 29} L${x + 12} ${y - 21}`;
    }
    return index === 0
      ? `M${x - 12} ${y - 29} L${x + 10} ${y - 21}`
      : `M${x - 10} ${y - 21} L${x + 12} ${y - 29}`;
  }

  showCheeks(): boolean {
    return this.life()?.kind === 'blush' || this.previewScene() === 'blush';
  }

  readonly spiralPath = 'M8 8m0 0a1 1 0 0 1 2 0a2.2 2.2 0 0 1-4.4 0a3.5 3.5 0 0 1 7 0a4.8 4.8 0 0 1-9.6 0';
  readonly archPath = `M${EYE_CX - 11} ${EYE_CY + 4} A11 10 0 0 1 ${EYE_CX + 11} ${EYE_CY + 4}`;

  private prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
