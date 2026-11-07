import type { ClientTool } from '../client-tool.model';

/** La clave de `localStorage` que ofrece `echo` al modelo. */
export const ECHO_DEBUG_KEY = 'mascot-debug-echo';

/**
 * La sonda del contrato: devuelve lo que se le pasa. Sirve para comprobar el
 * viaje de ida y vuelta sin montar ninguna pantalla.
 *
 * Solo se declara con `localStorage['mascot-debug-echo'] = '1'`: es una
 * herramienta para el equipo, no algo que el modelo deba usar con la gente.
 */
export const ECHO_TOOL: ClientTool = {
  decl: {
    name: 'echo',
    description: 'Prueba técnica: devuelve el texto que recibe. Úsala solo si te lo piden expresamente.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'El texto a devolver' } },
      required: ['text'],
    },
  },
  offered: () => {
    try {
      return globalThis.localStorage?.getItem(ECHO_DEBUG_KEY) === '1';
    } catch {
      return false;
    }
  },
  run: async (args) => ({ ok: true, echo: args['text'] ?? null }),
};
