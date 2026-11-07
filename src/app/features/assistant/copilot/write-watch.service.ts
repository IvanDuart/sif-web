import { Injectable, signal } from '@angular/core';

/** Cómo acabó una escritura. */
export interface WriteOutcome {
  ok: boolean;
  status: number;
}

/**
 * Cómo acabó la escritura que provocó la herramienta en curso.
 *
 * Es lo que permite a `save_` decir si se guardó **de verdad**, en vez de
 * deducirlo de que el diálogo se cerrara: los ajustes del centro guardan sin
 * cerrarse, y un guardado que el servidor rechaza tampoco cierra nada.
 *
 * Vive en su propio servicio, y no dentro de `ToolRunnerService`, porque lo
 * escribe el interceptor y lo lee el despacho de herramientas: tenerlo en el
 * runner cerraría un círculo de inyección (runner → registro → pantalla →
 * runner).
 */
@Injectable({ providedIn: 'root' })
export class WriteWatchService {
  readonly last = signal<WriteOutcome | null>(null);

  /** Empieza a vigilar de cero: lo de la herramienta anterior no cuenta. */
  reset(): void {
    this.last.set(null);
  }
}
