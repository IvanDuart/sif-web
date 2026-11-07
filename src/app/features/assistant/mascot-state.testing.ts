import type { HttpTestingController } from '@angular/common/http/testing';

/** El primer envío de cada sesión mira si quedó un turno colgado; aquí no hay ninguno. */
export function noHungRun(http: HttpTestingController): void {
  for (const latest of http.match((r) => r.url.endsWith('/sessions/latest'))) {
    latest.flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
  }
}
