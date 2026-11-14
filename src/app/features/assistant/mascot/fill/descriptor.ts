import type { FormGroup } from '@angular/forms';

import type { AssistantScreen } from '../../../../core/api/models/assistant.model';

/**
 * Lo que la mascota puede rellenar de un formulario (el `descriptor.ts` de
 * alkimia, `core/copilot/descriptor.ts`).
 *
 * Un formulario montado se declara una sola vez: qué campos tiene, cómo los
 * llama el asistente y cómo se escribe en ellos. De ahí sale todo lo demás, así
 * que lo que la mascota teclea no se puede desviar del formulario.
 *
 * La mascota NO guarda: deja el formulario relleno y guarda la persona con el
 * botón del propio formulario.
 */

/** Cómo se escribe un campo: lo que se teclea letra a letra y lo que se pone de golpe. */
export type FillKind = 'text' | 'number' | 'choice' | 'boolean' | 'date' | 'time';

export interface FillField {
  /** Cómo lo llama el formulario: su `formControlName` o su `data-mascot-field`. */
  key: string;
  kind: FillKind;
  /**
   * Las claves de `pendingAction.preview[].field` que caen en este campo. El
   * backend nombra las suyas y el formulario las suyas; esto es el único sitio
   * donde se tocan, así que una clave nueva del backend es una línea aquí.
   */
  from: readonly string[];
  /**
   * Qué hay que pulsar para que el campo esté en pantalla: un paso, una
   * pestaña. Si hace falta más de una pulsación van en orden, como en
   * `FillOpener.reveal` — las observaciones del paciente viven en otra pestaña
   * y además detrás del botón de editar.
   */
  reveal?: string | readonly string[];
  /** Un selector propio, para cuando no se encuentra solo. */
  anchor?: string;
  /**
   * Qué decirle al modelo de este campo, cuando «Número» o «Fecha» no basta.
   *
   * Es para el campo que no se explica solo: el buscador de ingredientes de una
   * receta no es un dato de la receta, es una casilla que hay que escribir y
   * luego pulsar un botón. Sin decirlo, el modelo lo rellena y se queda ahí.
   *
   * Se pierde cuando el esquema no cabe, como el resto de las pistas.
   */
  hint?: string;
  /** Del texto que manda el backend al valor que espera el formulario. */
  parse?: (raw: string) => unknown;
  /**
   * Las etiquetas entre las que se elige, para decírselas al modelo. Solo las
   * lleva un `choice` cuyas opciones se conocen al declarar el formulario.
   */
  options?: () => readonly string[];
  /**
   * Un texto que ya escribió alguien y que se edita por trozos: las
   * observaciones de un paciente, las notas de una cita. Es lo que hace que el
   * formulario ofrezca `edit_<id>` además de `fill_<id>`; sin esto, cambiar
   * una línea obligaría al modelo a reescribirlo entero.
   */
  long?: boolean;
  /**
   * Del valor que guarda el control (un id) a la etiqueta que ve la persona.
   * El modelo habla en etiquetas: sin esto, el contexto le diría `8f3c…` en
   * vez de a quién se refiere.
   */
  valueLabel?: (value: unknown) => string | null;
  /**
   * Elige a una persona. Sus opciones no se enumeran en la declaración de la
   * herramienta: son nombres, y en un buscador solo son los últimos resultados.
   */
  people?: boolean;
}

/**
 * Una lista de filas repetibles (los tramos de una jornada). El formulario
 * arranca sin filas, así que antes de escribir en la fila N hay que pulsar N
 * veces el botón de añadir: eso es lo que declara `add`, y es a las filas lo
 * que `reveal` es a un paso escondido.
 *
 * El backend las nombra `<key>[<i>].<campo>` (`details[0].startTime`); aquí se
 * traducen a la ruta que entiende el formulario (`details.0.startTime`) y al
 * ancla del DOM, que la plantilla marca con `data-mascot-row="<key>.<i>"`.
 */
export interface FillList {
  /** Cómo la nombran el backend y el formulario: `details`. */
  key: string;
  /** El botón que añade una fila más. */
  add: string;
  /** Cuántas filas hay ahora mismo en el formulario. */
  size(): number;
  /** Los campos de UNA fila, con su clave relativa (`startTime`). */
  fields: readonly FillField[];
  /** Tope de filas; lo que pase de ahí se descarta en vez de crecer sin fin. */
  max?: number;
}

export interface FillSurface {
  /** Identifica el formulario; sale en `data-mascot-field="<id>.<key>"`. */
  id: string;
  /** Las tools del asistente que rellenan este formulario. */
  tools: readonly string[];
  fields: readonly FillField[];
  /** Las listas de filas repetibles, si las tiene. */
  lists?: readonly FillList[];
  /**
   * Si el formulario ya tiene sus datos. Un formulario que carga lo suyo por
   * HTTP se apunta al montarse, pero escribir antes de que llegue la respuesta
   * no sirve de nada: la carga pisa lo escrito. Mientras esto sea `false`, la
   * mascota sigue esperando en vez de rellenar.
   */
  ready?(): boolean;
  /**
   * Si sus valores van al contexto del modelo en este momento. Una anamnesis
   * entera no debe viajar con cada mensaje mientras la persona mira otra
   * pestaña: sin esto el formulario se cuenta como abierto, sin valores.
   * Por defecto, siempre.
   */
  contextual?(): boolean;
  /**
   * Este formulario NO ofrece `save_`: lo guarda la persona y solo la persona.
   *
   * La mascota puede rellenarlo, pero el botón de guardar no se le ofrece ni
   * con un sí. Es para lo que no admite un «casi»: el estado clínico y la baja
   * de un paciente, y lo que toca dinero. Se marca aquí, en el descriptor,
   * para que la exclusión viaje con el formulario y no se olvide al mover el
   * botón de sitio.
   */
  noSave?: boolean;
  /**
   * Qué hay que pulsar para que el botón de guardar esté en pantalla.
   *
   * Lo mismo que `FillField.reveal`, pero para el Guardar. Un formulario por
   * pasos sólo monta el paso activo, así que tras rellenar los campos el botón
   * **no existe en el DOM**: la medición se queda en el paso 2 y `save_` no
   * encuentra nada que pulsar. Sin esto, el modelo da por imposible el
   * formulario y se va a escribir por detrás, que es justo lo que no queremos.
   */
  saveReveal?: string | readonly string[];
}

/**
 * Algo que una pantalla sabe hacer y que no es rellenar ni pulsar un botón
 * suelto: marcar una cita como realizada, duplicar un menú, activar los
 * recordatorios.
 *
 * Lo declara la propia pantalla porque es la única que sabe hacerlo. Si la
 * acción escribe en el backend, lleva `confirm: true` y se pregunta antes: la
 * regla de que nada se escribe sin un sí explícito no tiene excepciones.
 */
export interface MascotAction {
  /** Cómo se llama; de aquí sale `action_<id>`. */
  id: string;
  /** Qué hace, en una línea, para el modelo. */
  description: string;
  /** Se pregunta antes de ejecutarla. */
  confirm?: boolean;
  /** Lo que se pregunta, si `confirm`. Sin esto, la descripción. */
  confirmText?: string;
  run(): Promise<void> | void;
}

/** Cómo se lee y se escribe un campo, sea lo que sea el formulario por dentro. */
export interface FieldAccess {
  get(key: string): unknown;
  /** `silent` = un paso intermedio de la escritura, no el valor final. */
  set(key: string, value: unknown, options?: { silent?: boolean }): void;
  /**
   * Los campos obligatorios que siguen vacíos. Es lo que convierte «he escrito
   * el peso» en «he escrito el peso, pero falta la fecha para poder guardar»:
   * sin esto el modelo da por bueno un formulario que no se puede guardar.
   * Solo lo saben los formularios que declaran sus validadores.
   */
  missingRequired?(): readonly string[];
}

/**
 * `FieldAccess` sobre un formulario reactivo. Marca lo escrito como `dirty` y
 * `touched` para que el formulario se comporte igual que si lo hubiera tecleado
 * la persona: el botón de guardar se habilita y los errores salen.
 */
export function formAccess(form: FormGroup): FieldAccess {
  return {
    get: (key) => form.get(key)?.value,
    set: (key, value, options) => {
      const control = form.get(key);
      if (!control) return;
      control.setValue(value, { emitEvent: !options?.silent });
      control.markAsDirty();
      if (!options?.silent) control.markAsTouched();
    },
    // Solo el error `required`: los demás (un rango, un formato) ya los cuenta
    // el propio campo en pantalla, y aquí lo que importa es qué impide guardar
    // por estar vacío.
    missingRequired: () =>
      Object.entries(form.controls)
        .filter(([, control]) => control.enabled && control.hasError('required'))
        .map(([key]) => key),
  };
}

/** Un campo del formulario con lo que hay que escribir en él. */
export interface FillValue {
  field: FillField;
  raw: string;
  /** Filas que la lista debe tener antes de poder escribir aquí. */
  grow?: { list: FillList; rows: number };
}

/**
 * De `details[2].startTime` a `['details', 2, 'startTime']`. Se acepta también
 * la forma con punto (`details.2.startTime`) porque es como lo nombra el
 * formulario y es fácil que el backend la copie de ahí.
 */
function parseRowKey(name: string): { list: string; index: number; field: string } | null {
  const match = /^([A-Za-z_][\w-]*)(?:\[(\d+)\]|\.(\d+))\.(.+)$/.exec(name);
  if (!match) return null;
  return { list: match[1], index: Number(match[2] ?? match[3]), field: match[4] };
}

/**
 * `FieldAccess` sobre un objeto de señales o de propiedades sueltas, para los
 * formularios que no son reactivos (los `[(ngModel)]` de Ajustes, los `signal()`
 * de la nota de calendario).
 *
 * Cada campo se declara con cómo se lee y cómo se escribe. `after` es para los
 * campos que arrastran a otros: elegir país recarga la lista de provincias, y
 * sin eso el siguiente campo escribiría en una lista vacía.
 */
export interface FieldBinding {
  get(): unknown;
  set(value: unknown): void;
  /** Lo que hay que hacer tras una escritura definitiva (no las del tecleo). */
  after?(): void;
}

export function bindingAccess(bindings: Record<string, FieldBinding>): FieldAccess {
  return {
    get: (key) => bindings[key]?.get(),
    set: (key, value, options) => {
      const binding = bindings[key];
      if (!binding) return;
      binding.set(value);
      if (!options?.silent) binding.after?.();
    },
  };
}

/** Qué campos de este formulario cubre lo que manda el backend, en el orden del formulario. */
export function matchPreview(
  surface: FillSurface,
  preview: readonly { field: string; value: string }[],
): FillValue[] {
  const byKey = new Map(preview.map((item) => [item.field, item.value]));
  const flat = surface.fields.flatMap<FillValue>((field) => {
    const key = field.from.find((name) => byKey.has(name));
    const raw = key === undefined ? undefined : byKey.get(key);
    return raw === undefined || raw === '' ? [] : [{ field, raw }];
  });
  return [...flat, ...(surface.lists ?? []).flatMap((list) => matchList(list, preview))];
}

/**
 * Al revés que `matchPreview`: los nombres que manda el backend y este
 * formulario no reconoce.
 *
 * Es el aviso de que el contrato se ha movido. Si el backend renombra un campo
 * del `preview`, el relleno deja de encontrarlo y la acción cae a la tarjeta de
 * confirmar **sin dar ningún error**: sigue funcionando, pero la mascota deja
 * de escribir y nadie se entera. Esto lo hace visible
 * (`doc/contrato-api/assistant/assistant-frontend.md` §6).
 *
 * Los campos vacíos no cuentan: el backend los manda a propósito cuando no
 * sabe resolver un desplegable.
 */
export function unmatchedPreview(
  surface: FillSurface,
  preview: readonly { field: string; value: string }[],
): string[] {
  const known = new Set(surface.fields.flatMap((field) => field.from));
  const lists = new Map(
    (surface.lists ?? []).map((list) => [list.key, new Set(list.fields.flatMap((field) => field.from))]),
  );

  return preview
    .filter(({ field, value }) => {
      if (value === '' || known.has(field)) return false;
      const row = parseRowKey(field);
      return !row || !lists.get(row.list)?.has(row.field);
    })
    .map(({ field }) => field);
}

/**
 * Las filas que el backend manda para una lista, renumeradas a partir de 0 y en
 * orden: el formulario crece fila a fila, así que un `details[3]` suelto es la
 * primera fila, no la cuarta.
 */
function matchList(list: FillList, preview: readonly { field: string; value: string }[]): FillValue[] {
  const rows = new Map<number, Map<string, string>>();
  for (const { field, value } of preview) {
    const parsed = parseRowKey(field);
    if (!parsed || parsed.list !== list.key || value === '') continue;
    const row = rows.get(parsed.index) ?? new Map<string, string>();
    row.set(parsed.field, value);
    rows.set(parsed.index, row);
  }

  const ordered = [...rows.keys()].sort((a, b) => a - b);
  const capped = list.max === undefined ? ordered : ordered.slice(0, list.max);
  return capped.flatMap((source, index) => {
    const row = rows.get(source) as Map<string, string>;
    return list.fields.flatMap<FillValue>((field) => {
      const key = field.from.find((name) => row.has(name));
      const raw = key === undefined ? undefined : row.get(key);
      if (raw === undefined || raw === '') return [];
      return [{ field: rowField(list, field, index), raw, grow: { list, rows: index + 1 } }];
    });
  });
}

/**
 * El campo de una fila concreta: la clave pasa a ser la ruta del formulario
 * (`details.0.startTime`, que es lo que entiende `FormGroup.get`) y el ancla se
 * busca dentro de la fila, porque en el DOM todas las filas repiten el mismo
 * `formControlName`.
 */
export function rowField(list: FillList, field: FillField, index: number): FillField {
  const key = `${list.key}.${index}.${field.key}`;
  const row = `[data-mascot-row="${list.key}.${index}"]`;
  return {
    ...field,
    key,
    from: [key],
    anchor: field.anchor ? `${row} ${field.anchor}` : `${row} [formcontrolname="${field.key}"]`,
  };
}

/**
 * Cómo se ABRE un formulario que no está en pantalla (el `CopilotOpener` de
 * alkimia, `core/copilot/copilotStore.ts`).
 *
 * Sin esto, un `pendingAction` que llega con el diálogo cerrado no tiene nada
 * que rellenar y se queda en la tarjeta de confirmar. Con esto, la mascota va
 * hasta el botón que lo abre y lo pulsa como haría una persona: el formulario
 * monta, se apunta solo en `MascotFillService` y el relleno sigue como si
 * hubiera estado abierto desde el principio.
 *
 * Lo registra la PÁGINA que tiene el botón, y sólo mientras está viva: así
 * abrir un formulario sólo se ofrece donde la persona también podría abrirlo
 * (si no tiene el permiso, el botón no está y el `trigger` no se encuentra).
 */
export interface FillOpener {
  /** La superficie que abre: el mismo `id` que ella. */
  id: string;
  /**
   * En qué pantalla está este botón.
   *
   * Va aquí, pegado al opener, y no en una tabla aparte: una lista paralela
   * acaba prometiendo formularios en pantallas donde no hay nada que pulsar,
   * y entonces la mascota navega, no encuentra el botón y se rinde. De aquí
   * sale `pageContext.reachableForms`.
   */
  /**
   * **Sin pantalla** significa «sólo se llega estando ya aquí»: las comidas de
   * una plantilla viven en `/templates/:id`, y no se puede navegar hasta ahí
   * sin saber qué plantilla. El botón se sigue ofreciendo cuando se está en la
   * página, pero no se promete desde fuera: prometer un sitio al que no se
   * puede ir es lo que hace que la mascota navegue, no encuentre nada y se
   * rinda.
   */
  screen?: AssistantScreen;
  /** Hay que resolver el paciente antes de poder llegar. */
  needsPatient?: boolean;
  /** Las tools cuyo `pendingAction` se atiende abriendo este formulario. */
  tools: readonly string[];
  /**
   * El botón que lo abre. Se pulsa el primero VISIBLE que encaje: la misma
   * acción suele estar repetida en la página (cabecera, tarjeta, estado vacío).
   */
  trigger: string;
  /**
   * Lo que hay que pulsar ANTES para que el botón esté en pantalla, en orden:
   * las pestañas de ajustes, que sólo montan la sección activa. Pulsar una
   * pestaña ya activa no hace nada, así que no hace falta comprobarlo.
   */
  reveal?: readonly string[];
}
