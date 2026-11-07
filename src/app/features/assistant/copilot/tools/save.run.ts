import { goToElement, preferredTiming, pressFirstVisible } from '../../mascot/fill/animated-fill';
import type { FieldAccess, FillSurface } from '../../mascot/fill/descriptor';
import type { MascotFillService } from '../../mascot/fill/mascot-fill.service';
import type { CursorService } from '../cursor.service';
import type { ToolResult } from '../client-tool.model';
import { openDialogs } from '../pointing';
import type { QuestionService } from '../question.service';
import { YES } from '../question.service';
import type { WriteWatchService } from '../write-watch.service';

/** El botón de guardar de un formulario: `data-mascot-submit="<id del formulario>"`. */
export const SUBMIT_ATTR = 'data-mascot-submit';

/** Lo que se vigila tras pulsar antes de decir si se guardó. */
const WATCH_MS = 4000;
const POLL_MS = 120;

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isDisabled(element: HTMLElement): boolean {
  if (element.getAttribute('aria-disabled') === 'true') return true;
  return 'disabled' in element && (element as HTMLButtonElement).disabled === true;
}

/**
 * El botón de guardar de este formulario.
 *
 * Primero el marcado, que es el contrato. Y si no lo hay, el `submit` del
 * formulario donde está el campo: una heurística acotada al formulario, nunca
 * «el primer botón primario de la página», que podría ser cualquier cosa.
 */
function findSubmit(surfaceId: string, root: ParentNode = document): HTMLElement | null {
  const marked = Array.from(root.querySelectorAll<HTMLElement>(`[${SUBMIT_ATTR}="${surfaceId}"]`));
  const visible = marked.find(isVisible);
  if (visible) return visible;
  if (marked.length > 0) return null;

  // Sin marcar: el diálogo de más arriba es el que la persona está mirando.
  const dialogs = openDialogs(root);
  const scope = dialogs.length > 0 ? (dialogs[dialogs.length - 1] as ParentNode) : root;
  return Array.from(scope.querySelectorAll<HTMLElement>('button[type="submit"]')).find(isVisible) ?? null;
}

/** Lo que el formulario está enseñando como error ahora mismo. */
function errorsOf(root: ParentNode = document): string[] {
  const dialogs = openDialogs(root);
  const scope = dialogs.length > 0 ? (dialogs[dialogs.length - 1] as ParentNode) : root;
  return Array.from(scope.querySelectorAll<HTMLElement>('[tuiError], .t-error, [role="alert"]'))
    .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter((text) => text !== '')
    .slice(0, 5);
}

/**
 * `save_<id>`: pulsa el botón de guardar del formulario, y **solo** tras un sí
 * explícito.
 *
 * Esta es la herramienta que de verdad escribe, y por eso es la más estricta:
 *
 * 1. El formulario tiene que seguir en pantalla y seguir siendo el mismo.
 * 2. Se señala el botón y se pregunta, con el resumen de lo que se va a guardar.
 * 3. Si la persona pulsa Guardar ella misma mientras se le pregunta, eso ya es
 *    un sí ejecutado: no se vuelve a pulsar.
 * 4. Tras pulsar se vigila qué pasó de verdad, en vez de dar el guardado por
 *    hecho: lo que importa es si se guardó, no si se hizo clic.
 *
 * La petición HTTP es la de la pantalla, con sus permisos y sus guards. La
 * mascota nunca llama a un endpoint de escritura por su cuenta.
 */
export async function runSave(
  surface: FillSurface,
  access: FieldAccess,
  {
    fill,
    questions,
    writes,
    cursor,
    signal,
  }: {
    fill: MascotFillService;
    questions: QuestionService;
    cursor: CursorService;
    /** Para saber cómo acabó la escritura que provoque el botón. */
    writes: Pick<WriteWatchService, 'last'>;
    signal: AbortSignal;
  },
): Promise<ToolResult> {
  if (signal.aborted) return { ok: false, reason: 'user_declined' };
  // Cinturón además del tirante: `save_` no se declara para estos formularios.
  if (surface.noSave) return { ok: false, reason: 'unknown_tool' };

  // Un formulario por pasos sólo monta el activo: tras rellenar, el Guardar
  // puede no estar en el DOM todavía. Se va a buscar antes de darlo por
  // imposible, porque rendirse aquí manda al modelo a escribir por detrás.
  if (!findSubmit(surface.id) && surface.saveReveal) {
    const steps = typeof surface.saveReveal === 'string' ? [surface.saveReveal] : surface.saveReveal;
    fill.begin();
    try {
      for (const step of steps) {
        if (!(await pressFirstVisible(step, preferredTiming(), fill))) break;
      }
    } finally {
      fill.end();
    }
  }

  const button = findSubmit(surface.id);
  if (!button) return { ok: false, reason: 'control_gone' };
  if (isDisabled(button)) {
    return { ok: false, reason: 'control_disabled', missingRequired: [...(access.missingRequired?.() ?? [])] };
  }

  const timing = preferredTiming();
  fill.begin();
  try {
    if (!(await goToElement(button, timing, fill))) return { ok: false, reason: 'control_gone' };
  } finally {
    fill.end();
  }

  // La persona puede guardar ella mientras se le pregunta: eso es el sí, ya
  // ejecutado. Sin esto la mascota volvería a pulsar y guardaría dos veces.
  let pressedByPerson = false;
  const watchPerson = () => {
    pressedByPerson = true;
    questions.answer(YES);
  };
  button.addEventListener('click', watchPerson, { once: true });

  const dialogsBefore = openDialogs().length;
  try {
    const answer = await questions.ask({ kind: 'confirm', text: summarize(surface, access) }, signal);
    if (!answer.ok || answer.value !== YES) return { ok: false, reason: 'user_declined' };
  } finally {
    button.removeEventListener('click', watchPerson);
  }

  await cursor.whenResumed();
  if (signal.aborted) return { ok: false, reason: 'user_declined' };

  if (!pressedByPerson) {
    // Entre la pregunta y el sí el formulario ha podido cerrarse o invalidarse.
    const again = findSubmit(surface.id);
    if (!again) return { ok: false, reason: 'control_gone' };
    if (isDisabled(again)) return { ok: false, reason: 'control_disabled' };
    fill.presses.update((count) => count + 1);
    again.click();
  }

  return watchOutcome(surface.id, dialogsBefore, fill, writes);
}

/** Qué se va a guardar, en una línea, para que el sí sea un sí informado. */
function summarize(surface: FillSurface, access: FieldAccess): string {
  const parts = surface.fields
    .flatMap((field) => {
      const value = access.get(field.key);
      if (value === null || value === undefined || value === '') return [];
      const shown = field.valueLabel?.(value) ?? String(value);
      return shown === '' ? [] : [`${field.key}: ${shown}`];
    })
    .slice(0, 6);
  return parts.join(', ');
}

/**
 * Qué pasó tras pulsar.
 *
 * La prueba buena es la petición: si salió una escritura y el servidor la
 * aceptó, se guardó, y da igual que el formulario siga en pantalla —los
 * ajustes del centro guardan sin cerrarse—. Lo demás son indicios: que el
 * formulario se vaya, o que salga un error escrito.
 */
async function watchOutcome(
  surfaceId: string,
  dialogsBefore: number,
  fill: MascotFillService,
  writes: Pick<WriteWatchService, 'last'>,
): Promise<ToolResult> {
  const deadline = Date.now() + WATCH_MS;
  while (Date.now() < deadline) {
    const write = writes.last();
    if (write?.ok === true) return { ok: true, saved: true };
    if (write?.ok === false) {
      return { ok: false, saved: false, reason: 'tool_error', status: write.status, errors: errorsOf() };
    }

    const errors = errorsOf();
    if (errors.length > 0) return { ok: false, reason: 'tool_error', saved: false, errors };

    // El formulario ya no está: se guardó y la pantalla siguió.
    if (!fill.forId(surfaceId) || openDialogs().length < dialogsBefore) {
      return { ok: true, saved: true };
    }
    await fill.wait(POLL_MS);
  }

  const button = findSubmit(surfaceId);
  const stuck = button !== null && isDisabled(button) && button.getAttribute('aria-busy') !== 'true';
  return {
    ok: false,
    saved: false,
    reason: 'tool_error',
    errors: stuck ? ['El botón quedó deshabilitado sin guardar'] : errorsOf(),
  };
}
