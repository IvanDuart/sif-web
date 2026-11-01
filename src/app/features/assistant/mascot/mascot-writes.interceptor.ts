import { HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { MascotMilestonesService } from './mascot-milestones.service';
import { MascotTipsService } from './mascot-tips.service';

/**
 * Lo único que la mascota necesita saber de lo que pasa en la aplicación: que
 * alguien ha guardado algo, y dónde.
 *
 * Lo escuchan dos:
 *
 * - Los **hitos**, que ni miran el camino: cualquier escritura puede haber
 *   estrenado una primera vez, y quien lo calcula es el backend.
 * - Los **tips**, que sí lo miran: lo que se acaba de hacer a mano puede ser
 *   algo que ella sabe hacer, y entonces merece la pena decirlo.
 *
 * Que vivan aquí y no en cada pantalla evita cablear una llamada en quince
 * sitios y, sobre todo, evita que la primera cita creada a mano no se entere
 * nadie porque a esa pantalla se le olvidó avisar.
 */

/** Lo que cuenta como escribir. */
const WRITES = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Lo de la propia mascota no cuenta, y no es por ahorrar: marcar un hito como
 * celebrado es un `POST`, así que contarlo haría que celebrar provocara otra
 * lectura, y esa otra celebración, y así. Sus escrituras de verdad —las que
 * confirma la persona— ya avisan ellas mismas desde `MascotStateService`.
 *
 * Ojo: esto **no** cubre lo que ella rellena y la persona guarda, que sale por
 * el endpoint normal y llega aquí como cualquier otra escritura. De eso se
 * encarga el silencio de `MascotTipsService` tras usarla.
 */
const OWN = '/assistant/';

export const mascotWritesInterceptor: HttpInterceptorFn = (request, next) => {
  if (!WRITES.includes(request.method) || request.url.includes(OWN)) return next(request);

  const milestones = inject(MascotMilestonesService);
  const tips = inject(MascotTipsService);
  return next(request).pipe(
    tap((event) => {
      // Solo lo que acabó bien: un guardado que falló no estrenó nada, y
      // ofrecerse a repetir lo que no llegó a pasar es peor que callarse.
      if (event.type !== HttpEventType.Response || !event.ok) return;
      milestones.scheduleRefresh();
      tips.noticeWrite(request.method, request.url);
    }),
  );
};
