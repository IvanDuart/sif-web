import { slugOf, toolName } from './tool-names';

describe('nombres de herramienta', () => {
  it('cambia los guiones por guiones bajos', () => {
    expect(toolName('fill', 'patient-profile')).toBe('fill_patient_profile');
    expect(toolName('save', 'appointment-type')).toBe('save_appointment_type');
  });

  it('el id de pageContext sale igual que el de la herramienta', () => {
    // Fijado con literales: si cambia una de las dos reglas, cambia a la vez.
    expect(slugOf('menu-rename')).toBe('menu_rename');
    expect(toolName('fill', 'menu-rename')).toBe('fill_menu_rename');
  });

  it('limpia lo que no es del alfabeto', () => {
    expect(toolName('fill', 'Meal.Items')).toBe('fill_meal_items');
  });

  it('no declara lo que el backend descartaría', () => {
    expect(toolName('fill', '')).toBeNull();
    expect(toolName('fill', '---')).toBeNull();
    expect(toolName('fill', 'x'.repeat(60))).toBeNull();
  });
});
