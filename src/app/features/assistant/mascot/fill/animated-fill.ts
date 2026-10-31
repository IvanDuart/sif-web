import type { FieldAccess, FillField, FillList, FillOpener, FillSurface, FillValue } from './descriptor';
import type { MascotFillService } from './mascot-fill.service';

/**
 * El relleno animado (`animatedFill.ts` de alkimia). La mascota recorre el
 * formulario campo a campo: abre el paso que lo esconda, va hasta él, lo pulsa
 * y escribe. No guarda nada: al terminar, el formulario queda relleno y guarda
 * la persona.
 */

/** Un campo que la mascota puede señalar: `data-mascot-field="<formulario>.<campo>"`. */
export const FIELD_ATTR = 'data-mascot-field';
/** Lo que ha escrito la mascota, hasta que la persona lo toca (se pinta en `styles.less`). */
export const WRITTEN_ATTR = 'data-mascot-written';

export interface FillTiming {
  /** Viaje de un campo al siguiente. */
  hopMs: number;
  /** Lo que tarda la pulsación antes de que el valor empiece a cambiar. */
  clickMs: number;
  /** Pausa al terminar un campo, para que la vista lo siga. */
  pauseMs: number;
  /** Un paso de tecleo. */
  tickMs: number;
  /** Lo más que un campo puede tardar tecleando; un texto largo teclea a trozos. */
  typeBudgetMs: number;
  /** Lo que se le da a la pantalla para asentarse tras abrir un paso. */
  settleMs: number;
}

/** Un formulario de tres o cuatro campos tarda entre 3 y 5 s. */
export const DEFAULT_FILL_TIMING: FillTiming = {
  hopMs: 450,
  clickMs: 180,
  pauseMs: 260,
  tickMs: 28,
  typeBudgetMs: 2200,
  settleMs: 220,
};

/** Sin movimiento: va campo a campo igual, pero sin viaje ni tecleo. */
export const STILL_TIMING: FillTiming = {
  hopMs: 0,
  clickMs: 0,
  pauseMs: 0,
  tickMs: 0,
  typeBudgetMs: 0,
  settleMs: 60,
};

export interface FillReport {
  /** Los campos escritos, por su clave del formulario. */
  written: string[];
  /** Los que venían del asistente y no se encontraron en pantalla. */
  missing: string[];
}

function quote(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Dónde está el campo en la pantalla. Se busca por su ancla propia, por el
 * `data-mascot-field` del formulario y por el `formControlName`, que en los
 * diálogos de esta app ya nombra cada control: así un formulario reactivo no
 * necesita marcar nada.
 */
export function findAnchor(
  surfaceId: string,
  field: FillField,
  root: ParentNode = document,
): HTMLElement | null {
  const selectors = [
    ...(field.anchor ? [field.anchor] : []),
    `[${FIELD_ATTR}=${quote(`${surfaceId}.${field.key}`)}]`,
    `[formcontrolname=${quote(field.key)}]`,
    `[name=${quote(field.key)}]`,
  ];
  // El diálogo de más arriba primero: un desplegable abierto dentro de un
  // formulario es a su vez un diálogo encima, y el campo puede estar debajo.
  const dialogs = Array.from(root.querySelectorAll('[role="dialog"]')).reverse();
  for (const scope of [...dialogs, root]) {
    for (const selector of selectors) {
      const matches = Array.from(scope.querySelectorAll<HTMLElement>(selector));
      if (matches.length === 0) continue;
      return matches.find(isVisible) ?? matches[0];
    }
  }
  return null;
}

/** Lo que se teclea letra a letra; lo demás se pone de golpe. */
function isTypeable(field: FillField, anchor: HTMLElement): boolean {
  if (field.kind !== 'text' && field.kind !== 'number') return false;
  if (anchor instanceof HTMLTextAreaElement) return true;
  return anchor instanceof HTMLInputElement && ['text', 'search', 'number', ''].includes(anchor.type);
}

/** Lo que el campo tiene escrito ahora, como texto. */
function currentText(field: FillField, access: FieldAccess): string {
  const value = access.get(field.key);
  return value === null || value === undefined ? '' : String(value);
}

/** El elemento que SE VE como campo: el `tui-textfield` que envuelve al input, si lo hay. */
export function visualTarget(anchor: HTMLElement): HTMLElement {
  return anchor.closest<HTMLElement>('tui-textfield, [tuiTextfield], label') ?? anchor;
}

function markWritten(anchor: HTMLElement): void {
  const box = visualTarget(anchor);
  box.setAttribute(WRITTEN_ATTR, '');
  const forget = () => {
    box.removeAttribute(WRITTEN_ATTR);
    box.removeEventListener('input', forget);
    box.removeEventListener('focusin', forget);
  };
  // Se borra en cuanto la persona lo toca: deja de ser lo que escribió la mascota.
  setTimeout(() => {
    box.addEventListener('input', forget);
    box.addEventListener('focusin', forget);
  }, 0);
}

/**
 * Cambia el campo de `from` a `to` como lo edita una persona, no como lo
 * imprime una impresora: lo que los dos textos comparten al principio y al
 * final se queda en pantalla, se borra sólo el trozo viejo que se va y se
 * teclea el nuevo en su sitio. Teclear el valor entero desde cero borraría un
 * campo que ya tiene contenido para reescribirlo, que es justo lo que una
 * edición no debe parecer.
 */
export async function typeChange(
  field: FillField,
  access: FieldAccess,
  from: string,
  to: string,
  timing: FillTiming,
  fill: MascotFillService,
): Promise<void> {
  const shared = Math.min(from.length, to.length);
  let head = 0;
  while (head < shared && from[head] === to[head]) head += 1;
  let tail = 0;
  while (tail < shared - head && from[from.length - 1 - tail] === to[to.length - 1 - tail]) tail += 1;

  const prefix = to.slice(0, head);
  const suffix = tail > 0 ? to.slice(to.length - tail) : '';
  const oldMiddle = from.slice(head, from.length - tail);
  const newMiddle = to.slice(head, to.length - tail);

  const write = (middle: string) => {
    const text = prefix + middle + suffix;
    access.set(field.key, field.parse ? field.parse(text) : text, { silent: true });
  };

  const steps = oldMiddle.length + newMiddle.length;
  if (steps === 0 || timing.tickMs === 0) return;
  // Un texto largo va a trozos en vez de tardar más: el presupuesto manda.
  const chunk = Math.max(1, Math.ceil((steps * timing.tickMs) / timing.typeBudgetMs));

  for (let at = oldMiddle.length; at > 0 && !fill.skipRequested; at -= chunk) {
    write(oldMiddle.slice(0, Math.max(0, at - chunk)));
    await fill.wait(timing.tickMs);
  }
  for (let at = 0; at < newMiddle.length && !fill.skipRequested; at += chunk) {
    write(newMiddle.slice(0, Math.min(newMiddle.length, at + chunk)));
    await fill.wait(timing.tickMs);
  }
}

/** Lleva la mascota hasta el elemento y espera a que llegue. */
async function goToElement(element: HTMLElement, timing: FillTiming, fill: MascotFillService): Promise<boolean> {
  if (fill.skipRequested) return false;
  element.scrollIntoView({ block: 'center', behavior: timing.hopMs > 0 ? 'smooth' : 'auto' });
  fill.hopMs.set(timing.hopMs);
  fill.target.set(element);
  await fill.wait(timing.hopMs);
  return !fill.skipRequested;
}

/** Abre lo que esconda el campo (un paso, una pestaña), pulsándolo como haría una persona. */
async function reveal(
  surfaceId: string,
  field: FillField,
  timing: FillTiming,
  fill: MascotFillService,
): Promise<void> {
  if (!field.reveal) return;
  // Si el campo ya está en pantalla no hace falta abrir nada.
  const showing = findAnchor(surfaceId, field);
  if (showing && isVisible(showing)) return;
  const trigger = document.querySelector<HTMLElement>(field.reveal);
  if (!trigger || !isVisible(trigger)) return;
  if (!(await goToElement(trigger, timing, fill))) return;
  fill.presses.update((count) => count + 1);
  trigger.click();
  await fill.wait(timing.settleMs);
}

/** Va hasta el primer botón visible que encaje y lo pulsa. */
async function pressFirstVisible(
  selector: string,
  timing: FillTiming,
  fill: MascotFillService,
): Promise<boolean> {
  const target = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible);
  if (!target) return false;
  if (!(await goToElement(target, timing, fill))) return false;
  fill.presses.update((count) => count + 1);
  target.click();
  await fill.wait(timing.settleMs);
  return !fill.skipRequested;
}

/**
 * Añade filas hasta que la lista tenga las que hacen falta: la mascota va al
 * botón de añadir y lo pulsa una vez por fila, como haría una persona. Si el
 * botón no está (o deja de crecer) se para, y el campo de esa fila se dará por
 * no encontrado como cualquier otro.
 */
async function growList(
  grow: { list: FillList; rows: number },
  timing: FillTiming,
  fill: MascotFillService,
): Promise<boolean> {
  const { list, rows } = grow;
  while (list.size() < rows) {
    if (fill.skipRequested) return false;
    const before = list.size();
    fill.saying.set({ key: 'assistant.fill_adding' });
    if (!(await pressFirstVisible(list.add, timing, fill))) return false;
    // Si pulsar no añadió nada, seguir sería un bucle infinito.
    if (list.size() <= before) return false;
  }
  return true;
}

/**
 * Abre un formulario que no está en pantalla: la mascota va hasta el botón y
 * lo pulsa, como haría una persona (el `open()` del `CopilotOpener` de
 * alkimia, aquí siempre conduciendo los controles de la propia página).
 *
 * Devuelve si llegó a pulsar. No espera a que el formulario monte: de eso se
 * encarga quien llama, con `waitForTool`.
 */
export async function playOpen(
  opener: FillOpener,
  timing: FillTiming,
  fill: MascotFillService,
): Promise<boolean> {
  if (fill.skipRequested) return false;

  // El botón puede vivir detrás de una pestaña que ni siquiera está montada
  // (los ajustes montan sólo la sección activa): primero las pestañas, en
  // orden, y sólo después se busca el botón.
  for (const step of opener.reveal ?? []) {
    fill.saying.set({ key: 'assistant.fill_opening' });
    if (!(await pressFirstVisible(step, timing, fill))) return false;
  }

  // La misma acción suele estar repetida en la página (cabecera, tarjeta,
  // estado vacío): vale la primera que se vea de verdad.
  const triggers = Array.from(document.querySelectorAll<HTMLElement>(opener.trigger));
  const trigger = triggers.find(isVisible);
  if (!trigger) return false;

  fill.saying.set({ key: 'assistant.fill_opening' });
  if (!(await goToElement(trigger, timing, fill))) return false;
  fill.presses.update((count) => count + 1);
  trigger.click();
  await fill.wait(timing.settleMs);
  return !fill.skipRequested;
}

/** Escribe un campo: va hasta él, lo pulsa y pone el valor. */
async function playField(
  surface: FillSurface,
  field: FillField,
  raw: string,
  access: FieldAccess,
  timing: FillTiming,
  fill: MascotFillService,
): Promise<boolean> {
  await reveal(surface.id, field, timing, fill);
  const anchor = findAnchor(surface.id, field);
  if (!anchor || fill.skipRequested) return false;

  fill.saying.set({ key: 'assistant.fill_writing', values: { field: fieldLabel(anchor, field) } });
  if (!(await goToElement(visualTarget(anchor), timing, fill))) return false;

  fill.presses.update((count) => count + 1);
  anchor.focus?.({ preventScroll: true });
  await fill.wait(timing.clickMs);
  if (fill.skipRequested) return false;

  const parsed = field.parse ? field.parse(raw) : raw;
  if (isTypeable(field, anchor)) {
    await typeChange(field, access, currentText(field, access), raw, timing, fill);
  }
  // Siempre la escritura final y validada, teclee o no: lo tecleado son pasos
  // intermedios y silenciosos.
  access.set(field.key, parsed);
  markWritten(anchor);
  await fill.wait(timing.pauseMs);
  return true;
}

/** Cómo se llama el campo para quien mira: su etiqueta, o su clave si no tiene. */
export function fieldLabel(anchor: HTMLElement | null, field: FillField): string {
  if (!anchor) return field.key;
  const id = anchor.getAttribute('id');
  const label = id ? document.querySelector<HTMLElement>(`label[for=${quote(id)}]`) : null;
  const text = (label ?? anchor.closest('label'))?.textContent?.trim();
  return text && text.length > 0 ? text : field.key;
}

/**
 * Recorre el formulario y lo rellena. Devuelve qué escribió y qué no encontró,
 * para que el asistente lo cuente.
 */
export async function playFill(
  surface: FillSurface,
  access: FieldAccess,
  values: readonly FillValue[],
  fill: MascotFillService,
  timing: FillTiming = DEFAULT_FILL_TIMING,
): Promise<FillReport> {
  const report: FillReport = { written: [], missing: [] };
  fill.begin();
  const stop = watchForTakeover(fill);
  try {
    for (const { field, raw, grow } of values) {
      if (fill.skipRequested) {
        report.missing.push(field.key);
        continue;
      }
      // La fila donde va este campo puede no existir todavía: se crea antes.
      if (grow && !(await growList(grow, timing, fill))) {
        report.missing.push(field.key);
        continue;
      }
      const done = await playField(surface, field, raw, access, timing, fill);
      (done ? report.written : report.missing).push(field.key);
    }
  } finally {
    stop();
    fill.end();
  }
  return report;
}

/** Si la persona se pone a escribir o pulsa Esc, la mascota se aparta y termina de golpe. */
function watchForTakeover(fill: MascotFillService): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') fill.requestSkip();
  };
  const onPointer = (event: PointerEvent) => {
    const at = event.target as HTMLElement | null;
    if (at?.closest('input, textarea, select, button')) fill.requestSkip();
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onPointer, true);
  return () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onPointer, true);
  };
}
