import { HttpEventType, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { ToolRunnerService } from './tool-runner.service';
import { WriteWatchService } from './write-watch.service';

/** La cabecera que marca una escritura salida de una herramienta de la mascota. */
export const ASSISTANT_WRITE_HEADER = 'X-Assistant-Write';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Marca las escrituras que empezó la mascota, **solo para poder seguirles la
 * pista** (`assistant-contract` §3.2).
 *
 * No cambia nada de la petición: los permisos, los guards y la validación del
 * backend son los de siempre, porque la petición es la de la pantalla. Lo
 * único que añade es poder responder a «¿esto lo guardó una persona o lo
 * guardó la mascota?» cuando alguien lo pregunte dentro de tres meses.
 *
 * La ventana es la de `ToolRunnerService.running`: mientras una herramienta se
 * está ejecutando. Lo que la persona haga fuera de esa ventana no se marca,
 * aunque la mascota esté abierta.
 */
export const assistantWriteInterceptor: HttpInterceptorFn = (req, next) => {
  if (!WRITE_METHODS.includes(req.method)) return next(req);

  const running = inject(ToolRunnerService).running();
  if (!running) return next(req);

  // Las del propio asistente no se marcan: marcar la entrega del resultado de
  // una herramienta como «escritura de la mascota» sería ruido.
  if (req.url.includes('/assistant/')) return next(req);

  const writes = inject(WriteWatchService);
  const marked = running.sessionId === ''
    ? req
    : req.clone({ setHeaders: { [ASSISTANT_WRITE_HEADER]: running.sessionId } });

  // Y de paso se apunta cómo acabó: `save_` necesita saber si la escritura
  // llegó a hacerse, no si el botón se pudo pulsar.
  return next(marked).pipe(
    tap({
      next: (event) => {
        if (event.type === HttpEventType.Response) writes.last.set({ ok: event.ok, status: event.status });
      },
      error: (error: { status?: number }) => writes.last.set({ ok: false, status: error?.status ?? 0 }),
    }),
  );
};
