import { Injectable, Type, signal } from '@angular/core';

/**
 * La capa que va POR ENCIMA de los diálogos de Taiga.
 *
 * `tui-root` envuelve el contenido de la app en `div.t-root-content` con
 * `isolation: isolate`, que crea un contexto de apilamiento: desde dentro,
 * ningún `z-index` —por alto que sea— puede ponerse sobre un `tui-modal`.
 * Lo que tiene que trabajar sobre un diálogo abierto (hoy, la mascota: va
 * campo a campo de un formulario que vive en uno) se pinta en `app.html`
 * fuera de `tui-root`, no aquí dentro.
 *
 * Quién lo monta y quién lo pinta están separados a propósito: lo decide el
 * `Shell`, que es quien sabe que la sesión está lista, pero se pinta en la
 * raíz. Este servicio es sólo el hilo entre los dos, y por eso no sabe nada
 * del asistente: así su código sigue en su propio chunk.
 */
@Injectable({ providedIn: 'root' })
export class OverlayLayerService {
  readonly component = signal<Type<unknown> | null>(null);
}
