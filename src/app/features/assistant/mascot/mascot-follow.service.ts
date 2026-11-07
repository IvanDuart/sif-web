import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { MascotFillService } from './fill/mascot-fill.service';
import { REST_POSE, leanTowards, sectionSteps, type FollowPose } from './mascot-follow';
import { ORB, restingSpot } from './placement';

/** La entrada del menú que está activa: la que se acaba de pulsar. */
const ACTIVE_ENTRY = '.nav-item.active-link';

/**
 * Dispara la rutina de acompañar el cambio de sección.
 *
 * La coreografía está en `mascot-follow.ts`, que es pura; aquí sólo se decide
 * **cuándo** toca y se mira del DOM hacia dónde. Separarlo es lo que permite
 * probar los tiempos sin un router.
 *
 * No se mete cuando la mascota está trabajando: si está recorriendo un
 * formulario, ponerse a saltar sería abandonar lo que estaba haciendo.
 */
@Injectable({ providedIn: 'root' })
export class MascotFollowService {
  private readonly router = inject(Router);
  private readonly fill = inject(MascotFillService);

  readonly pose = signal<FollowPose>(REST_POSE);

  private timers: ReturnType<typeof setTimeout>[] = [];
  /**
   * La sección en la que estaba.
   *
   * Se siembra con dónde estamos AHORA, y no vacía: la mascota se monta
   * después de que la primera ruta ya haya ocurrido, así que esperar a ver dos
   * navegaciones se comía justo el primer cambio de sección de la sesión.
   */
  private lastSection = sectionOf(this.router.url ?? '');

  constructor() {
    const sub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.onNavigated(event.urlAfterRedirects));

    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      this.stop();
    });
  }

  private onNavigated(url: string): void {
    const section = sectionOf(url);
    const changed = section !== this.lastSection;
    this.lastSection = section;
    if (!changed || !this.canPlay()) return;
    this.play();
  }

  private canPlay(): boolean {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    // Trabajando no: está en el formulario, no mirando el menú.
    return !this.fill.filling() && this.fill.target() === null;
  }

  private play(): void {
    this.stop();
    for (const [ms, pose] of sectionSteps(this.lean())) {
      this.timers.push(setTimeout(() => this.pose.set(pose ?? REST_POSE), ms));
    }
  }

  /** Hacia dónde mirar: la entrada activa del menú, si se encuentra. */
  private lean(): number {
    const entry = document.querySelector<HTMLElement>(ACTIVE_ENTRY);
    if (!entry) return 0;
    const box = entry.getBoundingClientRect();
    if (box.width === 0) return 0;
    const rest = restingSpot({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    });
    return leanTowards(rest.left + ORB / 2, box.left + box.width / 2);
  }

  private stop(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.pose.set(REST_POSE);
  }
}

/**
 * La sección de una ruta: su primer tramo.
 *
 * Moverse DENTRO de una sección (de la lista de pacientes a una ficha, o entre
 * pestañas de la ficha) no es cambiar de sección, y saltar en cada clic
 * cansaría enseguida.
 */
export function sectionOf(url: string): string {
  return url.split(/[?#]/)[0].split('/').filter(Boolean)[0] ?? '';
}
