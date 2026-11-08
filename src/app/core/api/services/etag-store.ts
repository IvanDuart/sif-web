import { Injectable } from '@angular/core';

/**
 * Helpers de concurrencia optimista reexportados aquí para que las pantallas
 * que ya trabajan con el `EtagStore` no tengan que importar dos módulos.
 */
export {
  isEtagFailure,
  isPreconditionRequired,
  isVersionConflict,
  ETAG_CONFLICT_STATUS,
  ETAG_PRECONDITION_REQUIRED_STATUS,
} from '../models/versioned.model';

/**
 * Caché en memoria de los `ETag` publicados por `GET` en recursos versionados
 * (menús y comidas).
 *
 * Vive en un servicio raíz porque el `GET` y el `PUT`/`PATCH` suelen ocurrir en
 * componentes distintos (lista → diálogo → detalle). Sin esta caché cada
 * guardado necesitaría un `GET` previo o el backend respondería `428`.
 */
@Injectable({ providedIn: 'root' })
export class EtagStore {
  private readonly etags = new Map<string, string>();

  get(key: string): string | null {
    return this.etags.get(key) ?? null;
  }

  set(key: string, etag: string | null): void {
    if (etag) {
      this.etags.set(key, etag);
    } else {
      this.etags.delete(key);
    }
  }

  clear(key: string): void {
    this.etags.delete(key);
  }
}
