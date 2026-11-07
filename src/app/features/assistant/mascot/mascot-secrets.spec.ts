import { SECRET_HELP, installSecrets, type MascotSecrets } from './mascot-secrets';

describe('secretos de consola', () => {
  const secrets = (): MascotSecrets => ({
    help: () => [...SECRET_HELP],
    wardrobe: () => undefined,
    skin: () => undefined,
    say: () => undefined,
    bar: () => undefined,
  });

  const global = () => (globalThis as Record<string, unknown>)['nuti'];

  beforeEach(() => spyOn(console, 'info'));

  afterEach(() => delete (globalThis as Record<string, unknown>)['nuti']);

  it('en desarrollo se instalan, y se pueden llamar', () => {
    installSecrets(secrets());
    expect(global()).toBeDefined();
    expect((global() as MascotSecrets).help().length).toBeGreaterThan(0);
  });

  it('al soltarlos no queda nada colgando del global', () => {
    const remove = installSecrets(secrets());
    remove();
    expect('nuti' in (globalThis as Record<string, unknown>)).toBeFalse();
  });

  it('si ya había algo con ese nombre, se devuelve como estaba', () => {
    (globalThis as Record<string, unknown>)['nuti'] = 'de otro';
    const remove = installSecrets(secrets());
    remove();
    expect(global()).toBe('de otro');
  });

  it('la ayuda nombra lo que de verdad existe', () => {
    const api = secrets();
    for (const line of SECRET_HELP) {
      const name = /^nuti\.(\w+)/.exec(line)?.[1] as keyof MascotSecrets;
      expect(typeof api[name]).withContext(line).toBe('function');
    }
  });
});
