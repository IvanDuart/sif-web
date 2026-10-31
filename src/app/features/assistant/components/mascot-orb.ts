import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { startBlink, startMotion, type Condition, type MoodKind, type Scene } from '../mascot/agentMotion';
import { MascotLifeService, type MascotLife, type MascotMode } from '../mascot/mascot-life.service';
import { MascotMoodService } from '../mascot/mascot-mood.service';
import { ARCH, EYE_CX, EYE_CY, EYE_H, EYE_W, FACES, K, OPEN, SHUT, type EyeState } from '../mascot/skins/faces';
import { geometryOf, mixGeometry, outlinePath, type Geometry } from '../mascot/skins/outlines';
import { getSkin } from '../mascot/skins/registry';
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
export class MascotOrb {
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

  private readonly orb = viewChild<ElementRef<HTMLElement>>('orb');
  private current: Geometry | null = null;
  private morphFrame = 0;

  readonly sizePx = computed(() => (this.size() === 's' ? 40 : this.size() === 'l' ? 72 : 56));

  /** El orb se dibuja siempre en una caja de 48px y se escala al tamaño pedido. */
  readonly scale = computed(() => this.sizePx() / 48);

  readonly skinStyle = computed(() => getSkin(this.skin()).vars as unknown as Record<string, string>);

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
  readonly scene = computed<Scene | null>(() => {
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

    effect((onCleanup) => {
      const orb = this.orb()?.nativeElement;
      const scene = this.scene();
      if (!orb || !scene) return undefined;
      const stop = startMotion(orb, scene, this.skin(), this.still() || this.prefersReducedMotion());
      onCleanup(stop);
      return undefined;
    });

    effect((onCleanup) => {
      const orb = this.orb()?.nativeElement;
      const blink = this.blink();
      if (!orb || blink === null || this.still() || this.prefersReducedMotion()) return undefined;
      const stop = startBlink(orb, blink);
      onCleanup(stop);
      return undefined;
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

    const onVisibility = () => this.away.set(document.visibilityState === 'hidden');
    if (!this.decorative() && !this.mirror()) document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(this.morphFrame);
    });
  }

  onClick(): void {
    if (this.decorative() || this.mirror()) return;
    if (this.lifeService.press()) return;
    this.activated.emit();
  }

  onMove(event: PointerEvent): void {
    if (this.decorative() || this.mirror()) return;
    this.lifeService.move(event.clientX);
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
      case 'acting':
        return [pair(bar(1)), 1];
      case 'confirm':
        return [pair(bar(1, -3, 1)), 1];
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

  private moodEyes(mood: MoodKind): Eyes | null {
    switch (mood) {
      case 'worried':
        return pair(bar(0.75, -2, 2));
      case 'cheer':
      case 'highfive':
      case 'welcome':
      case 'proud':
        return pair(ARCH);
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

  /** Las cejas: sólo se ven con enojo. */
  showBrows(): boolean {
    return this.life()?.kind === 'angry';
  }

  showCheeks(): boolean {
    return this.life()?.kind === 'blush';
  }

  readonly spiralPath = 'M8 8m0 0a1 1 0 0 1 2 0a2.2 2.2 0 0 1-4.4 0a3.5 3.5 0 0 1 7 0a4.8 4.8 0 0 1-9.6 0';
  readonly archPath = `M${EYE_CX - 11} ${EYE_CY + 4} A11 10 0 0 1 ${EYE_CX + 11} ${EYE_CY + 4}`;

  private prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
