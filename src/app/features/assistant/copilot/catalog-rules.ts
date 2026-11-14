import type { AssistantClientToolDecl } from '../../../core/api/models/assistant.model';
import { FIXED_TOOLS, TOOL_NAME } from './tool-names';

/**
 * Las reglas del backend para lo que se declara (`assistant-contract` §3.2,
 * `ClientToolValidator`), repetidas aquí para enterarnos en desarrollo: el
 * backend descarta lo que no cumple **sin error ni aviso**, y la herramienta
 * simplemente no existe para el modelo.
 */
export const MAX_TOOLS = 40;
export const MAX_SCHEMA_BYTES = 2048;
export const MAX_DESCRIPTION = 300;
export const MAX_DEPTH = 3;
export const MAX_PROPERTIES = 60;

// Sin `save_`: la mascota rellena y guarda la persona (ver ClientToolValidator).
const PREFIXES = ['fill_', 'edit_', 'open_', 'action_'];
const TYPES = new Set(['object', 'string', 'number', 'integer', 'boolean', 'array']);

/**
 * Una descripción como la deja el backend: en una sola línea y recortada. Él
 * lo hace por su cuenta, pero declararla ya limpia evita depender de ello.
 */
export function cleanDescription(text: string): string {
  return text.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, MAX_DESCRIPTION);
}

/** El tamaño que cuenta el backend: el JSON del esquema, en bytes. */
export function schemaBytes(parameters: unknown): number {
  return new TextEncoder().encode(JSON.stringify(parameters)).length;
}

/** Por qué el backend rechazaría esta declaración, o `null` si la acepta. */
export function declProblem(decl: AssistantClientToolDecl): string | null {
  if (!TOOL_NAME.test(decl.name)) return `nombre no válido: ${decl.name}`;
  const known =
    (FIXED_TOOLS as readonly string[]).includes(decl.name) ||
    PREFIXES.some((prefix) => decl.name.startsWith(prefix) && decl.name.length > prefix.length);
  if (!known) return `familia no permitida: ${decl.name}`;
  const bytes = schemaBytes(decl.parameters);
  if (bytes > MAX_SCHEMA_BYTES) return `esquema de ${bytes} bytes`;
  return schemaProblem(decl.parameters, 1);
}

function schemaProblem(node: unknown, depth: number): string | null {
  if (depth > MAX_DEPTH) return 'esquema demasiado anidado';
  if (typeof node !== 'object' || node === null) return null;
  const schema = node as Record<string, unknown>;

  const type = typeof schema['type'] === 'string' ? schema['type'] : 'object';
  if (!TYPES.has(type)) return `tipo no soportado: ${type}`;

  if (type === 'object') {
    const props = schema['properties'];
    if (typeof props === 'object' && props !== null) {
      const entries = Object.entries(props);
      if (entries.length > MAX_PROPERTIES) return 'demasiadas propiedades';
      for (const [, child] of entries) {
        const problem = schemaProblem(child, depth + 1);
        if (problem) return problem;
      }
    }
  }
  if (type === 'array') {
    if (typeof schema['items'] !== 'object' || schema['items'] === null) return 'un array necesita items';
    return schemaProblem(schema['items'], depth + 1);
  }
  return null;
}
