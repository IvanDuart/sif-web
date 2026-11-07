import { REST_POSE, leanTowards, poseTransform, sectionSteps, stepsDuration } from './mascot-follow';

describe('la mascota acompaña el cambio de sección', () => {
  describe('hacia dónde mira', () => {
    it('se asoma hacia el menú, que está a su izquierda', () => {
      expect(leanTowards(1200, 100)).toBeLessThan(0);
    });

    it('es un gesto, no un viaje: no crece con la distancia', () => {
      const cerca = leanTowards(1200, 1000);
      const lejos = leanTowards(1200, 0);
      expect(Math.abs(lejos)).toBeGreaterThan(Math.abs(cerca));
      expect(Math.abs(lejos)).toBeLessThanOrEqual(10);
    });

    it('si está justo encima no se inclina', () => {
      expect(leanTowards(500, 500)).toBe(0);
    });
  });

  describe('la rutina', () => {
    const steps = sectionSteps(-8);

    it('mira, se agacha, salta, aterriza y vuelve', () => {
      expect(steps.length).toBe(5);
      expect(steps[steps.length - 1][1]).withContext('acaba volviendo a su sitio').toBeNull();
    });

    it('los tiempos van en orden', () => {
      const times = steps.map(([ms]) => ms);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it('se agacha ANTES de saltar: es lo que lo hace un salto y no un rebote', () => {
      const crouch = steps[1][1]!;
      const jump = steps[2][1]!;
      expect(crouch.lift).toBeGreaterThan(0);
      expect(jump.lift).toBeLessThan(0);
      // Agachada se achata; saltando se estira.
      expect(crouch.squash[1]).toBeLessThan(1);
      expect(jump.squash[1]).toBeGreaterThan(1);
    });

    it('mira desde el principio, y deja de mirar al aterrizar', () => {
      expect(steps[0][1]!.lean).toBe(-8);
      expect(steps[3][1]!.lean).toBe(0);
    });

    it('dura poco más de medio segundo: acompaña, no entretiene', () => {
      expect(stepsDuration(steps)).toBeLessThan(1000);
    });
  });

  describe('la pose como transform', () => {
    it('sin viaje, sólo el gesto', () => {
      expect(poseTransform({ ...REST_POSE, lean: -4, lift: -10 }, null))
        .toBe('translate(-4.0px, -10.0px) scale(1, 1)');
    });

    it('con viaje, el viaje primero: el gesto es relativo a donde esté', () => {
      const out = poseTransform({ ...REST_POSE, lean: -4, lift: 0 }, { x: -100, y: -50 });
      expect(out.indexOf('translate(-100.0px, -50.0px)')).toBe(0);
    });

    it('en reposo no mueve nada', () => {
      expect(poseTransform(REST_POSE, null)).toBe('translate(0.0px, 0.0px) scale(1, 1)');
    });
  });
});
