import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickLabel } from './parse';

/**
 * Asignar una plantilla de menú al paciente
 * (`users/assign-menu-template.dialog`). Es el formulario de
 * `create_menu_from_template`.
 *
 * `patientId` no se rellena: el diálogo se abre desde la ficha del paciente,
 * así que ya sabe de quién es. Si el asistente lo manda, se ignora.
 */

interface MenuTemplateOptions {
  /** Las plantillas que ofrece el desplegable, por nombre. */
  templates(): readonly PickOption[];
}

/** "sí", "true", "1" y sus variantes; cualquier otra cosa es que no. */
export function toActive(raw: string): boolean {
  const plain = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return ['si', 'true', '1', 'yes', 'y', 'activo', 'active'].includes(plain);
}

export function menuTemplateSurface(options: MenuTemplateOptions): FillSurface {
  return {
    id: 'menu-template',
    tools: ['create_menu_from_template'],
    fields: [
      {
        key: 'templateId',
        kind: 'choice',
        from: ['templateId', 'template', 'plantilla', 'templateName'],
        // El combobox guarda el nombre de la plantilla, no su id.
        parse: (raw) => pickLabel(options.templates(), raw),
      },
      { key: 'name', kind: 'text', from: ['name', 'nombre', 'menuName'] },
      { key: 'isActive', kind: 'boolean', from: ['isActive', 'activo', 'active'], parse: toActive },
    ],
  };
}

/** El botón está en la pestaña de menús de la ficha. */
export const MENU_TEMPLATE_OPENER: FillOpener = {
  id: 'menu-template',
  tools: ['create_menu_from_template'],
  reveal: ['[data-mascot-reveal="tab-menus"]'],
  trigger: '[data-mascot-open="menu-template"]',
};
