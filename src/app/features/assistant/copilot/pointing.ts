/**
 * Los controles que la mascota puede señalar y pulsar.
 *
 * La regla es que **solo se pulsa lo que está marcado**: un selector libre
 * sobre el DOM dejaría a la mascota pulsando cualquier cosa que el modelo
 * acierte a nombrar, incluido lo que borra. Marcar un botón es decir «este se
 * puede automatizar», y es una decisión de quien escribe la pantalla.
 */

/** Un control que la mascota puede señalar: `data-mascot-point="<id>"`. */
export const POINT_ATTR = 'data-mascot-point';
/** Lo marca quien escribe la pantalla cuando la acción no se deshace. */
export const DANGER_ATTR = 'data-mascot-danger';

export interface Pointable {
  id: string;
  element: HTMLElement;
  /** Cómo se llama para quien mira: lo que se le dice al modelo y se lee en voz alta. */
  label: string;
  dangerous: boolean;
}

/** Por qué no se pudo usar un control. */
export type PointProblem = 'control_gone' | 'control_disabled';

/**
 * Las palabras que hacen peligrosa una acción aunque nadie la haya marcado.
 * Es una red de seguridad, no el mecanismo: lo que se quiera marcar en serio
 * lleva `data-mascot-danger`.
 */
const DANGER_WORDS = [
  'borrar', 'eliminar', 'descartar', 'cancelar', 'anular', 'dar de baja',
  'desactivar', 'archivar', 'revocar', 'quitar', 'vaciar',
];

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isDisabled(element: HTMLElement): boolean {
  if (element.getAttribute('aria-disabled') === 'true') return true;
  return 'disabled' in element && (element as HTMLButtonElement).disabled === true;
}

/** Cómo se llama el control para quien mira. */
export function labelOf(element: HTMLElement): string {
  const explicit = element.getAttribute('aria-label') ?? element.getAttribute('title') ?? '';
  const text = explicit.trim() !== '' ? explicit : (element.textContent ?? '');
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Si pulsarlo es algo que no se deshace. Dos fuentes: lo que la pantalla
 * declara (`data-mascot-danger`, o el aspecto destructivo de Taiga) y lo que
 * dice el propio botón.
 */
export function isDangerous(element: HTMLElement): boolean {
  if (element.hasAttribute(DANGER_ATTR)) return true;
  if (element.closest(`[${DANGER_ATTR}]`)) return true;
  const appearance = element.getAttribute('data-appearance') ?? element.getAttribute('appearance') ?? '';
  if (appearance === 'destructive' || appearance === 'negative') return true;
  const label = labelOf(element).toLowerCase();
  return DANGER_WORDS.some((word) => label.includes(word));
}

/**
 * Dónde se busca: el diálogo de más arriba si lo hay, y si no toda la página.
 *
 * Con un diálogo abierto, lo de debajo está tapado: pulsar ahí sería pulsar lo
 * que la persona no puede ni ver.
 */
function scope(root: ParentNode): ParentNode {
  const dialogs = Array.from(root.querySelectorAll('[role="dialog"]')).filter((dialog) =>
    isVisible(dialog as HTMLElement),
  );
  return dialogs.length > 0 ? (dialogs[dialogs.length - 1] as ParentNode) : root;
}

/** Lo que se puede señalar ahora mismo, en el orden en que está en pantalla. */
export function pointables(root: ParentNode = document): Pointable[] {
  const seen = new Set<string>();
  return Array.from(scope(root).querySelectorAll<HTMLElement>(`[${POINT_ATTR}]`))
    .filter(isVisible)
    .flatMap((element) => {
      const id = element.getAttribute(POINT_ATTR)?.trim() ?? '';
      // El mismo control suele estar repetido (cabecera, tarjeta, estado
      // vacío): vale el primero que se vea.
      if (id === '' || seen.has(id)) return [];
      seen.add(id);
      return [{ id, element, label: labelOf(element) || id, dangerous: isDangerous(element) }];
    });
}

/**
 * El control de ese id, esté como esté. Lo usa `point_at`: señalar un botón
 * gris es útil, porque enseña justo por qué no se puede pulsar.
 */
export function findPointable(id: string, root: ParentNode = document): Pointable | null {
  return pointables(root).find((candidate) => candidate.id === id) ?? null;
}

/** El control de ese id listo para pulsar, o por qué no se puede. */
export function resolvePointable(id: string, root: ParentNode = document): Pointable | PointProblem {
  const found = findPointable(id, root);
  if (!found) return 'control_gone';
  return isDisabled(found.element) ? 'control_disabled' : found;
}

/** Los diálogos que hay abiertos, para saber si pulsar abrió uno nuevo. */
export function openDialogs(root: ParentNode = document): Element[] {
  return Array.from(root.querySelectorAll('[role="dialog"]')).filter((dialog) =>
    isVisible(dialog as HTMLElement),
  );
}
