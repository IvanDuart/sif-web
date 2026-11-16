import { NAVIGABLE_SCREENS, routeForScreen } from './screen-routes';

describe('routeForScreen', () => {
  it('todas las pantallas que se enumeran al modelo llevan a alguna parte', () => {
    for (const screen of NAVIGABLE_SCREENS) {
      expect(routeForScreen(screen, { patientId: 'p-1' })).withContext(screen).not.toBeNull();
    }
  });

  it('una pantalla que no está en la lista no navega', () => {
    expect(routeForScreen('ADMIN')).toBeNull();
    expect(routeForScreen(undefined)).toBeNull();
  });

  it('los listados se abren ya filtrados, como lo haría la persona', () => {
    expect(routeForScreen('PATIENTS', { query: ' Ana ' })).toEqual({ commands: ['/patients'], queryParams: { q: 'Ana' } });
    expect(routeForScreen('PATIENTS', { query: '  ' })).toEqual({ commands: ['/patients'] });
  });

  it('la ficha de un paciente necesita saber de quién es', () => {
    expect(routeForScreen('PATIENT_PROFILE', { patientId: 'p-1' }))
      .toEqual({ commands: ['/users', 'p-1'], queryParams: { tab: 'patient_profile' } });
    // Sin paciente NO se abre la ficha de nadie: se vuelve al inicio.
    expect(routeForScreen('PATIENT_PROFILE')).toEqual({ commands: ['/dashboard'] });
  });

  it('las secciones de ajustes van por query params, que es como están montadas', () => {
    expect(routeForScreen('SETTINGS_HOLIDAYS'))
      .toEqual({ commands: ['/settings'], queryParams: { tab: 'schedules', section: 'holidays' } });
  });

  it('MENU con menuId abre ese menú: donde se repasa uno recién generado', () => {
    expect(routeForScreen('MENU', { menuId: 'menu-1' })).toEqual({ commands: ['/menus', 'menu-1'] });
  });

  it('la agenda con fecha abre ese día, y una fecha mal escrita se ignora', () => {
    expect(routeForScreen('AGENDA', { date: '2026-11-20' })).toEqual({ commands: ['/appointments'], queryParams: { date: '2026-11-20' } });
    expect(routeForScreen('AGENDA', { date: 'el martes' })).toEqual({ commands: ['/appointments'] });
  });
});
