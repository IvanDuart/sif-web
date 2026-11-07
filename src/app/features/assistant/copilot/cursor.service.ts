import { Injectable, signal } from '@angular/core';

/**
 * Parar a la mascota a mitad, sin cancelar el turno.
 *
 * Detener (`stop()`) tira el turno entero: lo que llevaba hecho se queda y el
 * modelo no sigue. Pausar es otra cosa y hace falta igual: la mascota está
 * rellenando un formulario, la persona quiere mirar un campo antes de que siga,
 * y al soltar continúa por donde iba. Sin esto, la única manera de ganar un
 * segundo es cargarse el turno.
 *
 * Los runners esperan aquí entre pasos —entre campos, entre paradas de un
 * recorrido, antes de pulsar—, nunca a mitad de una escritura: una pausa que
 * deja un campo escrito a medias sería peor que no poder pausar.
 */
@Injectable({ providedIn: 'root' })
export class CursorService {
  readonly paused = signal(false);

  private waiting: (() => void)[] = [];

  pause(): void {
    this.paused.set(true);
  }

  resume(): void {
    if (!this.paused()) return;
    this.paused.set(false);
    const waiting = this.waiting;
    this.waiting = [];
    for (const wake of waiting) wake();
  }

  toggle(): void {
    if (this.paused()) this.resume();
    else this.pause();
  }

  /**
   * Espera a que se reanude. Si no hay pausa, no espera nada: se llama entre
   * cada paso, así que tiene que costar cero cuando nadie ha pausado.
   */
  whenResumed(): Promise<void> {
    if (!this.paused()) return Promise.resolve();
    return new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  /** El turno terminó o se detuvo: lo que esperaba sigue, no se queda colgado. */
  release(): void {
    this.paused.set(false);
    const waiting = this.waiting;
    this.waiting = [];
    for (const wake of waiting) wake();
  }
}
