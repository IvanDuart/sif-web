/**
 * Las tools de ESCRITURA que el backend declara, agrupadas por dónde se
 * declaran. Son DOS sitios, y confundirlos sale caro:
 *
 * - El núcleo, `AssistantToolRegistry.WRITE_TOOLS` (paciente, cita, medición,
 *   menú desde plantilla).
 * - Cada módulo, `service/assistant/tools/*ToolModule.writeTools()`.
 *
 * El catálogo entero son 67 tools, 27 del núcleo y 40 de los módulos. Mirar
 * sólo los módulos y concluir que `create_appointment` no existe es un error
 * fácil de cometer y caro de deshacer: lleva a borrar coberturas que SÍ son
 * ciertas, y entonces el modelo deja de encontrar el formulario por la regla
 * del `cubre:` y escribe por detrás, que es justo lo que se quería evitar.
 *
 * **Generada, no escrita a mano: `npm run sync:assistant-tools`.** Antes se
 * copiaba a mano y se quedó atrás: le faltaban las seis que se añadieron
 * después (`create_recipe`, `clone_recipe`, `instantiate_recipe_in_meal`,
 * `log_diary_entry`, `update_meal_exchanges`, `mark_notification_as_read`).
 * Una lista corta no deja pasar un error: rechaza una cobertura legítima, que
 * es igual de molesto y más desconcertante.
 */
export const BACKEND_WRITE_TOOLS: readonly string[] = [
  // Núcleo
  'update_profile',
  'update_anamnesis',
  'create_measurement',
  'update_measurement',
  'reschedule_appointment',
  'create_appointment',
  'update_appointment_status',
  'create_menu_from_template',
  'create_menu_from_description',
  // Agenda
  'create_calendar_note',
  'create_appointment_type',
  'update_appointment_type',
  // Diario
  'log_diary_entry',
  // Intercambios
  'update_meal_exchanges',
  // Menús
  'rename_menu',
  'update_meal',
  'generate_shopping_list',
  // Notificaciones
  'mark_notification_as_read',
  // Ficha del paciente
  'update_clinical_status',
  'create_patient_event',
  'assign_nutritionist',
  // Recetas
  'create_recipe',
  'clone_recipe',
  'instantiate_recipe_in_meal',
  // Horarios y festivos
  'create_schedule',
  'update_schedule',
  'assign_schedule',
  'create_holiday',
  'import_holidays',
  // Centro
  'update_tenant_profile',
];
