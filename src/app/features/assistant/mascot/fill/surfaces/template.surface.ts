import type { FillOpener, FillSurface } from '../descriptor';

/**
 * La plantilla de menú del centro (`templates/template-form.dialog`).
 *
 * Es la plantilla **global**, la que luego se asigna a quien haga falta, y no
 * el menú de un paciente concreto: eso es `menu-template`, que es el diálogo
 * de asignar. Se parecen en el nombre y no en lo que hacen, así que conviene
 * no confundirlos al leer un `fill_`.
 *
 * Hasta ahora no tenía superficie, y por eso pedir «créame una plantilla» sólo
 * conseguía que la mascota te explicara cómo hacerlo tú.
 */
export const TEMPLATE_SURFACE: FillSurface = {
  id: 'template',
  // No hay tool de escritura de servidor para esto: el catálogo del backend
  // tiene `get_menu_templates` y `create_menu_from_template`, pero ninguna que
  // cree la plantilla. Se rellena y se guarda, y punto.
  tools: [],
  fields: [
    { key: 'name', kind: 'text', from: ['name', 'nombre', 'templateName'] },
    {
      key: 'description',
      kind: 'text',
      from: ['description', 'descripcion', 'notas'],
      // Es donde van las indicaciones del menú: se edita por trozos.
      long: true,
    },
  ],
};

/** El botón de crear plantilla, en el listado y en su estado vacío. */
export const TEMPLATE_OPENER: FillOpener = {
  id: 'template',
  tools: [],
  screen: 'TEMPLATES',
  trigger: '[data-mascot-open="template"]',
};
