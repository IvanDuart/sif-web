/** Lo que marca una fila recién creada por la mascota. */
export const NEW_ROW_ATTR = 'data-mascot-new';
/** Lo que tarda cada fila en abrir su hueco. */
export const ROW_MS = 220;
/** Lo que se espera entre una fila y la siguiente. */
export const ROW_GAP_MS = 90;

/**
 * Las filas que la mascota añade a una lista entran **una a una**.
 *
 * Cuando rellena los tramos de un horario puede crear cinco filas seguidas.
 * Apareciendo de golpe, la tabla da un salto y no hay forma de ver qué se ha
 * añadido ni en qué orden; en cascada se lee lo que está pasando y, si está
 * mal, se para a tiempo.
 *
 * La marca se quita sola: es para la entrada, no un estado que mantener.
 */

export function markNewRow(row: HTMLElement, index: number): () => void {
  row.setAttribute(NEW_ROW_ATTR, '');
  row.style.setProperty('--mascot-row-delay', `${index * ROW_GAP_MS}ms`);
  const forget = setTimeout(
    () => {
      row.removeAttribute(NEW_ROW_ATTR);
      row.style.removeProperty('--mascot-row-delay');
    },
    index * ROW_GAP_MS + ROW_MS * 2,
  );
  return () => {
    clearTimeout(forget);
    row.removeAttribute(NEW_ROW_ATTR);
    row.style.removeProperty('--mascot-row-delay');
  };
}

/** La fila `index` de esa lista, si ya está en el DOM. */
export function rowOf(listKey: string, index: number, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-mascot-row="${listKey}.${index}"]`);
}

/** Marca en cascada las filas que acaban de aparecer. Devuelve cómo deshacerlo. */
export function revealRows(listKey: string, from: number, to: number, root: ParentNode = document): () => void {
  const undo: (() => void)[] = [];
  for (let index = from; index < to; index += 1) {
    const row = rowOf(listKey, index, root);
    if (row) undo.push(markNewRow(row, index - from));
  }
  return () => undo.forEach((stop) => stop());
}
