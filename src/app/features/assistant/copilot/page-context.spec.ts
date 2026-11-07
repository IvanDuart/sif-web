import { TuiDay, TuiTime } from '@taiga-ui/cdk';

import type { AssistantPageContext } from '../../../core/api/models/assistant.model';
import { MAX_VALUE_CHARS, fitPageContext, serializeValue } from './page-context';

describe('contexto de pantalla', () => {
  describe('serializeValue', () => {
    it('lo vacío llega como null', () => {
      expect(serializeValue('')).toBeNull();
      expect(serializeValue(undefined)).toBeNull();
      expect(serializeValue(null)).toBeNull();
    });

    it('escribe los valores de Taiga como el formulario', () => {
      expect(serializeValue(new TuiDay(2026, 10, 7))).toBe('2026-11-07');
      expect(serializeValue(new TuiTime(9, 5))).toBe('09:05');
    });

    it('deja pasar números y booleanos, incluido el cero y false', () => {
      expect(serializeValue(0)).toBe(0);
      expect(serializeValue(false)).toBe(false);
      expect(serializeValue(72.5)).toBe(72.5);
    });

    it('corta un valor largo y lo dice', () => {
      const out = serializeValue('x'.repeat(MAX_VALUE_CHARS + 50)) as string;
      expect(out.endsWith('…(cortado)')).toBeTrue();
      expect(out.length).toBeLessThan(MAX_VALUE_CHARS + 20);
    });

    it('descarta lo que no sabe contar', () => {
      expect(serializeValue(() => 1)).toBeNull();
      expect(serializeValue(Symbol('x'))).toBeNull();
    });
  });

  describe('fitPageContext', () => {
    const base: AssistantPageContext = {
      route: '/patients/1',
      forms: [
        { id: 'measurement', values: { notes: 'a'.repeat(300) } },
        { id: 'appointment', values: { notes: 'b'.repeat(300) } },
      ],
      extras: { dia: '2026-11-10' },
    };

    it('lo que cabe se queda como está', () => {
      expect(fitPageContext(base)).toEqual(base);
    });

    it('lo primero que se quita son los extras', () => {
      const fitted = fitPageContext({ ...base, extras: { relleno: 'z'.repeat(2000) } }, 900);
      expect(fitted.extras).toBeUndefined();
      expect(fitted.forms?.length).toBe(2);
    });

    it('después se quitan formularios, los más antiguos primero: el último es el diálogo en uso', () => {
      const fitted = fitPageContext(base, 400);
      expect(fitted.forms?.map((form) => form.id)).toEqual(['appointment']);
    });

    it('siempre queda uno, aunque solo no quepa: el backend ya lo recorta', () => {
      expect(fitPageContext(base, 10).forms?.length).toBe(1);
    });
  });
});
