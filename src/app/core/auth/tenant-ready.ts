import { Observable, isObservable, of } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';

import { AuthService } from './auth.service';

/**
 * Retrasa la decisión de un guard hasta que `/users/me` haya aterrizado.
 *
 * Angular **no** encadena el array de `canActivate`: los lanza a la vez y
 * combina los resultados (`prioritizedGuardValue` usa `combineLatest`). Así que
 * un guard puesto detrás de `authGuard` no hereda su espera: se ejecuta en el
 * mismo instante, cuando en un refresco en frío todavía no hay usuario ni
 * centro. Si decide ahí, decide sobre un estado vacío, y su veredicto es
 * definitivo aunque `authGuard` acabe diciendo que sí.
 *
 * Los guards que leen usuario, centro o permisos tienen que pasar por aquí.
 */
export function afterTenantLoaded<T>(
  authService: AuthService,
  decide: () => Observable<T> | T
): Observable<T> {
  return authService.isTenantLoaded$.pipe(
    filter((loaded) => loaded),
    take(1),
    switchMap(() => {
      const decision = decide();
      return isObservable(decision) ? decision : of(decision);
    })
  );
}
