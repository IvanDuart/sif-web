import type { FormGroup } from '@angular/forms';

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
  /** Qué hay que pulsar para que el campo esté en pantalla (un paso, una pestaña). */
  reveal?: string;
  /** Un selector propio, para cuando no se encuentra solo. */
  anchor?: string;
  /** Del texto que manda el backend al valor que espera el formulario. */
  parse?: (raw: string) => unknown;
}

export interface FillSurface {
  /** Identifica el formulario; sale en `data-mascot-field="<id>.<key>"`. */
  id: string;
  /** Las tools del asistente que rellenan este formulario. */
  tools: readonly string[];
  fields: readonly FillField[];
}

/** Cómo se lee y se escribe un campo, sea lo que sea el formulario por dentro. */
export interface FieldAccess {
  get(key: string): unknown;
  /** `silent` = un paso intermedio de la escritura, no el valor final. */
  set(key: string, value: unknown, options?: { silent?: boolean }): void;
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
  };
}

/** Qué campos de este formulario cubre lo que manda el backend, en el orden del formulario. */
export function matchPreview(
  surface: FillSurface,
  preview: readonly { field: string; value: string }[],
): { field: FillField; raw: string }[] {
  const byKey = new Map(preview.map((item) => [item.field, item.value]));
  return surface.fields.flatMap((field) => {
    const key = field.from.find((name) => byKey.has(name));
    const raw = key === undefined ? undefined : byKey.get(key);
    return raw === undefined || raw === '' ? [] : [{ field, raw }];
  });
}
