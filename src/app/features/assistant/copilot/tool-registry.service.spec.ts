import { TestBed } from '@angular/core/testing';

import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { MAX_TOOLS } from './catalog-rules';
import type { ClientTool } from './client-tool.model';
import { ECHO_DEBUG_KEY } from './tools/echo.run';
import { SCREEN_TOOLS_KEY, ToolRegistryService } from './tool-registry.service';

describe('ToolRegistryService', () => {
  let registry: ToolRegistryService;
  let fill: MascotFillService;

  const tool = (name: string, over: Partial<ClientTool> = {}): ClientTool => ({
    decl: { name, description: 'Una herramienta', parameters: { type: 'object' } },
    run: async () => ({ ok: true }),
    ...over,
  });

  beforeEach(() => {
    localStorage.removeItem(ECHO_DEBUG_KEY);
    localStorage.removeItem(SCREEN_TOOLS_KEY);
    spyOn(console, 'warn');
    registry = TestBed.inject(ToolRegistryService);
    fill = TestBed.inject(MascotFillService);
  });

  afterEach(() => {
    localStorage.removeItem(ECHO_DEBUG_KEY);
    localStorage.removeItem(SCREEN_TOOLS_KEY);
  });

  const names = () => registry.catalog().map((decl) => decl.name);

  it('sin nada registrado no declara herramientas: echo es solo de depuración', () => {
    expect(names()).toEqual([]);
    localStorage.setItem(ECHO_DEBUG_KEY, '1');
    expect(names()).toEqual(['echo']);
  });

  it('una herramienta que se registra se declara, y al quitarla desaparece', () => {
    const remove = registry.register(tool('press'));
    expect(names()).toEqual(['press']);
    remove();
    expect(names()).toEqual([]);
  });

  it('una herramienta no ofrecida no se declara, pero se puede ejecutar', () => {
    registry.register(tool('press', { offered: () => false }));
    expect(names()).toEqual([]);
    expect(registry.runFor('press')).not.toBeNull();
  });

  it('lo que el backend descartaría no se declara y se avisa', () => {
    registry.register(tool('fill_patient-profile'));
    registry.register(tool('search_patients'));
    expect(names()).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it('una descripción larga se declara recortada, no se pierde la herramienta', () => {
    registry.register(tool('press', { decl: { name: 'press', description: 'x\ny'.repeat(200), parameters: { type: 'object' } } }));
    const [decl] = registry.catalog();
    expect(decl.description.length).toBeLessThanOrEqual(300);
    expect(decl.description).not.toContain('\n');
  });

  it('no declara más de 40', () => {
    for (let i = 0; i < MAX_TOOLS + 10; i += 1) registry.register(tool(`action_cosa_${i}`));
    expect(registry.catalog().length).toBe(MAX_TOOLS);
  });

  it('una herramienta cuyo `offered` lanza no tumba el catálogo', () => {
    registry.register(tool('press', { offered: () => { throw new Error('boom'); } }));
    registry.register(tool('navigate'));
    expect(names()).toEqual(['navigate']);
  });

  it('las herramientas de formulario solo salen con la clave de depuración', () => {
    TestBed.runInInjectionContext(() =>
      fill.register(
        { id: 'menu-rename', tools: [], fields: [{ key: 'name', kind: 'text', from: [] }] },
        { get: () => '', set: () => undefined },
      ),
    );
    expect(names()).toEqual([]);
    localStorage.setItem(SCREEN_TOOLS_KEY, '1');
    expect(names()).toEqual(['fill_menu_rename']);
  });
});
