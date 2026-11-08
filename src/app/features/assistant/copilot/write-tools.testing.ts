/**
 * Las tools de ESCRITURA que el backend declara (`assistant-contract` §5.1).
 *
 * Está aquí copiada a mano, y es a propósito: es lo que permite que un test
 * avise cuando lo que nosotros decimos que cubre un formulario deja de existir
 * en su catálogo. Pasó con `update_schedule_assignment`, que arrastrábamos de
 * una versión anterior y ya no existe; el modelo lo buscaba y no lo encontraba
 * nunca.
 *
 * Al actualizar el contrato, actualizar esta lista.
 */
export const BACKEND_WRITE_TOOLS: readonly string[] = [
  // Paciente
  'update_profile',
  'update_anamnesis',
  'create_measurement',
  'update_measurement',
  'reschedule_appointment',
  'create_appointment',
  'update_appointment_status',
  'create_menu_from_template',
  'create_menu_from_description',
  'update_clinical_status',
  'create_patient_event',
  'assign_nutritionist',
  'rename_menu',
  'update_meal',
  'generate_shopping_list',
  // Centro
  'create_schedule',
  'update_schedule',
  'assign_schedule',
  'create_holiday',
  'import_holidays',
  'create_calendar_note',
  'create_appointment_type',
  'update_appointment_type',
  'update_tenant_profile',
];
