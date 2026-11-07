/** Las familias que el backend acepta por prefijo (`ClientToolValidator`). */
export type ToolFamily = 'fill' | 'edit' | 'open' | 'save' | 'action';

/** Los nombres sueltos que acepta el backend, sin prefijo de familia. */
export const FIXED_TOOLS = ['point_at', 'show_around', 'press', 'ask_user', 'navigate'] as const;

/** Lo que el backend exige de un nombre; lo que no cumpla se descarta **sin aviso**. */
export const TOOL_NAME = /^[a-z][a-z0-9_]{2,48}$/;

/** El id de un formulario como lo ve el backend: sin guiones, igual en la herramienta y en `pageContext`. */
export function slugOf(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * El nombre de una herramienta de pantalla a partir del id de su formulario.
 *
 * Los ids de las surfaces llevan guiones (`patient-profile`) y el backend no
 * los admite, así que se traducen aquí, en el único sitio. Devuelve `null` si
 * ni así cumple: mejor no declararla que declararla y que desaparezca.
 */
export function toolName(family: ToolFamily, id: string): string | null {
  const slug = slugOf(id);
  const name = `${family}_${slug}`;
  return slug !== '' && TOOL_NAME.test(name) ? name : null;
}
