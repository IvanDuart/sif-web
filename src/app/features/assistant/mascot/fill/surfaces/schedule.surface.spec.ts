import { TuiDay, TuiTime } from '@taiga-ui/cdk';

import { matchPreview } from '../descriptor';
import { holidaySurface } from './holiday.surface';
import { pickLabel, toHexColor, toYear } from './parse';
import { scheduleAssignmentSurface } from './schedule-assignment.surface';
import { scheduleSurface } from './schedule.surface';
import { resolveFillRoute, routeForTool } from './routes';

/**
 * Lo que la mascota entiende de los formularios del centro. Lo que se prueba
 * aquí es la traducción: el asistente habla en texto ("Lunes", "9:00") y el
 * formulario quiere la etiqueta del desplegable o un `TuiTime`.
 */

const DAYS = [
  { label: 'Lunes', value: '1' },
  { label: 'Martes', value: '2' },
  { label: 'Miércoles', value: '3' },
];

describe('formularios del centro', () => {
  describe('jornada', () => {
    const surface = (blocks = 0) => scheduleSurface({ days: () => DAYS, blocks: () => blocks });

    it('reparte los tramos en filas y los traduce a lo que quiere el formulario', () => {
      const matched = matchPreview(surface(), [
        { field: 'name', value: 'Horario de invierno' },
        { field: 'details[0].dayOfWeek', value: 'lunes' },
        { field: 'details[0].startTime', value: '09:00' },
        { field: 'details[0].endTime', value: '14:00' },
        { field: 'details[1].dayOfWeek', value: '2' },
        { field: 'details[1].startTime', value: '16:30' },
      ]);

      const value = (key: string) => {
        const item = matched.find((candidate) => candidate.field.key === key);
        return item?.field.parse ? item.field.parse(item.raw) : item?.raw;
      };

      expect(value('name')).toBe('Horario de invierno');
      // El desplegable guarda la etiqueta, venga "lunes" o el número del día.
      expect(value('details.0.dayOfWeek')).toBe('Lunes');
      expect(value('details.1.dayOfWeek')).toBe('Martes');
      expect(value('details.0.startTime')).toEqual(new TuiTime(9, 0));
      expect(value('details.1.startTime')).toEqual(new TuiTime(16, 30));
    });

    it('busca cada campo dentro de SU fila', () => {
      const matched = matchPreview(surface(), [{ field: 'details[1].endTime', value: '20:00' }]);

      // Renumerado a la fila 0, porque es el único tramo que manda.
      expect(matched[0].field.anchor).toBe('[data-mascot-row="details.0"] [formcontrolname="endTime"]');
    });

    it('cuenta las filas que ya tiene el formulario', () => {
      expect(surface(3).lists![0].size()).toBe(3);
    });

    it('deja el día en blanco antes que elegir uno que no es', () => {
      const day = surface().lists![0].fields[0];
      expect(day.parse!('jueves')).toBeNull();
    });
  });

  describe('asignación de jornada', () => {
    const surface = scheduleAssignmentSurface({
      schedules: () => [
        { label: 'Horario de invierno', value: 'id-invierno' },
        { label: 'Horario de verano', value: 'id-verano' },
      ],
    });

    it('elige la jornada por su nombre y guarda el nombre, no el id', () => {
      const field = surface.fields.find((candidate) => candidate.key === 'scheduleId')!;
      expect(field.parse!('invierno')).toBeNull();
      expect(field.parse!('Horario de verano')).toBe('Horario de verano');
      expect(field.parse!('id-invierno')).toBe('Horario de invierno');
    });

    it('la fecha de fin se pide desmarcando "sin fecha de fin"', () => {
      const field = surface.fields.find((candidate) => candidate.key === 'validTo')!;
      expect(field.reveal).toBe('[data-mascot-reveal="assignment-dated"]');
      expect(field.parse!('2027-01-31')).toEqual(new TuiDay(2027, 0, 31));
    });
  });

  describe('festivo', () => {
    const surface = holidaySurface({
      types: () => [
        { label: 'Nacional', value: 'NATIONAL' },
        { label: 'Local', value: 'LOCAL' },
      ],
    });

    it('traduce el enum del backend a la etiqueta del desplegable', () => {
      const field = surface.fields.find((candidate) => candidate.key === 'type')!;
      expect(field.parse!('NATIONAL')).toBe('Nacional');
      expect(field.parse!('local')).toBe('Local');
    });

    it('acepta la fecha en ISO y en formato de aquí', () => {
      const field = surface.fields.find((candidate) => candidate.key === 'holidayDate')!;
      expect(field.parse!('2026-12-25')).toEqual(new TuiDay(2026, 11, 25));
      expect(field.parse!('25/12/2026')).toEqual(new TuiDay(2026, 11, 25));
    });
  });

  describe('traducciones sueltas', () => {
    it('normaliza el color a hex de seis cifras', () => {
      expect(toHexColor('#1a7f5a')).toBe('#1A7F5A');
      expect(toHexColor('0f0')).toBe('#00FF00');
      expect(toHexColor('verde')).toBeNull();
    });

    it('sólo acepta años que puedan ser de un centro', () => {
      expect(toYear('festivos de 2027')).toBe(2027);
      expect(toYear('1800')).toBeNull();
      expect(toYear('el año que viene')).toBeNull();
    });

    it('no elige cuando dos opciones empiezan igual', () => {
      const options = [
        { label: 'Horario de invierno', value: 'a' },
        { label: 'Horario de verano', value: 'b' },
      ];
      expect(pickLabel(options, 'Horario')).toBeNull();
    });
  });
});

describe('dónde vive cada formulario', () => {
  it('lleva a Ajustes con la pestaña y la sub-pestaña puestas', () => {
    const route = routeForTool('create_schedule');
    expect(resolveFillRoute(route!, null)).toEqual({
      commands: ['/settings'],
      queryParams: { tab: 'schedules', section: 'schedules' },
    });
  });

  it('las tres secciones de horarios van a sub-pestañas distintas', () => {
    const section = (tool: string) => resolveFillRoute(routeForTool(tool)!, null)?.queryParams?.['section'];
    expect(section('create_schedule')).toBe('schedules');
    expect(section('assign_schedule')).toBe('assignments');
    expect(section('create_holiday')).toBe('holidays');
  });

  it('la ficha del paciente necesita saber de quién es', () => {
    const route = routeForTool('create_measurement');
    expect(route!.needsPatient).toBeTrue();
    expect(resolveFillRoute(route!, null)).toBeNull();
    expect(resolveFillRoute(route!, 'uuid-paciente')).toEqual({
      commands: ['/users', 'uuid-paciente'],
      queryParams: undefined,
    });
  });

  it('una tool que no tiene formulario no lleva a ninguna parte', () => {
    expect(routeForTool('import_holidays')).toBeNull();
    expect(routeForTool('inventada')).toBeNull();
  });
});
