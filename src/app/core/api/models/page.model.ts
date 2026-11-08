/**
 * Forma `PagedModel` de Spring Data que devuelven los listados paginados.
 *
 * El backend aplica `size = 50` por defecto cuando el cliente no envía `page`
 * ni `size`, así que ese es el tamaño que usan los servicios como valor por
 * defecto y el que refleja `DEFAULT_PAGE_SIZE`.
 */
export interface PageMetadata {
  size: number;
  number: number;
  totalElements: number;
  totalPages: number;
}

export interface Page<T> {
  content: T[];
  page: PageMetadata;
}

/** Tamaño de página implícito del backend en los endpoints paginados. */
export const DEFAULT_PAGE_SIZE = 50;

/** Página vacía, útil para degradar sin romper el tipo cuando una petición falla. */
export function emptyPage<T>(): Page<T> {
  return {
    content: [],
    page: { size: 0, number: 0, totalElements: 0, totalPages: 0 },
  };
}
