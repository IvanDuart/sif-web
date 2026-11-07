import { HERO_CLICKS, HERO_KEY, HERO_MS, HERO_REST, HeroSecret, heroEnabled, heroSteps, heroTransform } from './mascot-hero';

describe('el modo héroe', () => {
  describe('cómo se desbloquea', () => {
    let secret: HeroSecret;

    beforeEach(() => (secret = new HeroSecret()));

    it('hacen falta tres clics con Alt', () => {
      expect(secret.press({ altKey: true }, 0)).toBeFalse();
      expect(secret.press({ altKey: true }, 100)).toBeFalse();
      expect(secret.press({ altKey: true }, 200)).toBeTrue();
    });

    it('sin Alt no cuenta: pulsar la mascota es abrir la conversación', () => {
      secret.press({ altKey: true }, 0);
      secret.press({ altKey: false }, 100);
      expect(secret.press({ altKey: true }, 200)).toBeFalse();
    });

    it('clics lejanos no son la misma intención', () => {
      secret.press({ altKey: true }, 0);
      secret.press({ altKey: true }, 100);
      expect(secret.press({ altKey: true }, 2000)).toBeFalse();
    });

    it('tras salir hay que volver a empezar', () => {
      for (let i = 0; i < HERO_CLICKS; i += 1) secret.press({ altKey: true }, i * 100);
      expect(secret.press({ altKey: true }, 400)).toBeFalse();
    });
  });

  describe('se puede apagar', () => {
    afterEach(() => localStorage.removeItem(HERO_KEY));

    it('viene encendido', () => {
      expect(heroEnabled()).toBeTrue();
    });

    it('con la clave a cero, no vuela', () => {
      localStorage.setItem(HERO_KEY, '0');
      expect(heroEnabled()).toBeFalse();
    });
  });

  describe('el vuelo', () => {
    const viewport = { width: 1400, height: 900 };
    const steps = heroSteps(viewport);
    const poses = steps.map(([, pose]) => pose).filter((pose) => pose !== null);

    it('cruza la pantalla de verdad, no da un brinco', () => {
      const masLejos = Math.min(...poses.map((pose) => pose!.x));
      // Llega casi al otro extremo: un héroe que salta 38 px no es un héroe.
      expect(Math.abs(masLejos)).toBeGreaterThan(viewport.width * 0.6);
    });

    it('sube hasta arriba del todo', () => {
      const masAlto = Math.min(...poses.map((pose) => pose!.y));
      expect(Math.abs(masAlto)).toBeGreaterThan(viewport.height * 0.5);
    });

    it('en una ventana más pequeña cruza lo mismo: todo', () => {
      const pequena = heroSteps({ width: 700, height: 500 });
      const lejos = Math.abs(Math.min(...pequena.map(([, p]) => p?.x ?? 0)));
      expect(lejos).toBeGreaterThan(700 * 0.5);
      expect(lejos).toBeLessThan(700);
    });

    it('nunca se sale de la pantalla', () => {
      for (const pose of poses) {
        expect(Math.abs(pose!.x)).withContext('x').toBeLessThan(viewport.width);
        expect(Math.abs(pose!.y)).withContext('y').toBeLessThan(viewport.height);
      }
    });

    it('se agacha, despega, cruza y vuelve a su sitio', () => {
      expect(steps[0][1]!.y).toBeGreaterThan(0);
      expect(steps[steps.length - 2][1]!.x).toBe(0);
      expect(steps[steps.length - 2][1]!.y).toBe(0);
      expect(steps[steps.length - 1][1]).toBeNull();
    });

    it('la capa sale al despegar, no antes: de pie sería un adorno', () => {
      expect(steps[0][1]!.cape).toBe(0);
      expect(steps[1][1]!.cape).toBe(1);
    });

    it('se inclina hacia donde vuela', () => {
      expect(steps[1][1]!.tilt).toBeLessThan(0);
    });

    it('los tiempos van en orden y acaba cuando dice', () => {
      const times = steps.map(([ms]) => ms);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(times[times.length - 1]).toBe(HERO_MS);
    });

    it('en reposo no mueve nada', () => {
      expect(heroTransform(HERO_REST)).toBe('translate(0.0px, 0.0px) scale(1, 1)');
    });
  });
});
