import type { FillSurface } from '../descriptor';

/**
 * Renombrar un menú (`menus/menu-rename.dialog`). Un solo campo, de señal.
 *
 * No tiene `FillOpener`: el botón de renombrar es por fila de la tabla
 * (`renameMenu(menu)`), así que no hay "el" botón que pulsar — cuál sea
 * depende de qué menú. La mascota solo lo rellena si el diálogo ya está
 * abierto; si no, la acción se queda en la tarjeta de confirmar.
 */
export const MENU_RENAME_SURFACE: FillSurface = {
  id: 'menu-rename',
  tools: ['rename_menu'],
  fields: [{ key: 'name', kind: 'text', from: ['name', 'nombre', 'menuName', 'title'] }],
};
