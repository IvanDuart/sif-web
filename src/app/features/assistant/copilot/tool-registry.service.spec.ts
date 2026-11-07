import { TestBed } from '@angular/core/testing';

import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { MAX_TOOLS } from './catalog-rules';
import type { ClientTool } from './client-tool.model';
import { ToolRegistryService } from './tool-registry.service';

describe('ToolRegistryService', () => {
  let registry: ToolRegistryService;
  let fill: MascotFillService;

  const tool = (name: string, over: Partial<ClientTool> = {}): ClientTool => ({
    decl: { name, description: 'Una herramienta', parameters: { type: 'object' } },
    run: async () => ({ ok: true }),
    ...over,
  });

  beforeEach(() => {
    spyOn(console, 'warn');
    registry = TestBed.inject(ToolRegistryService);
    fill = TestBed.inject(MascotFillService);
  });

  const names = () => registry.catalog().map((decl) => decl.name);

  it('sin nada registrado y sin formularios, no declara nada', () => {
    expect(names()).toEqual([]);
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

  it('un formulario montado se declara y se sabe ejecutar', () => {
    TestBed.runInInjectionContext(() =>
      fill.register(
        { id: 'menu-rename', tools: [], fields: [{ key: 'name', kind: 'text', from: [] }] },
        { get: () => '', set: () => undefined },
      ),
    );
    expect(names()).toEqual(['fill_menu_rename', 'save_menu_rename']);
    expect(registry.runFor('fill_menu_rename')).not.toBeNull();
    expect(registry.runFor('save_menu_rename')).not.toBeNull();
  });

  it('un formulario con texto largo ofrece además `edit_`', () => {
    TestBed.runInInjectionContext(() =>
      fill.register(
        { id: 'appointment', tools: [], fields: [{ key: 'notes', kind: 'text', from: [], long: true }] },
        { get: () => '', set: () => undefined },
      ),
    );
    expect(names()).toEqual(['fill_appointment', 'edit_appointment', 'save_appointment']);
  });

  it('`open_` solo se ofrece de lo que no está ya abierto', () => {
    TestBed.runInInjectionContext(() =>
      fill.registerOpener({ id: 'measurement', screen: 'DASHBOARD', tools: [], trigger: '[data-open]' }),
    );
    expect(names()).toEqual(['open_measurement']);
    expect(registry.runFor('open_measurement')).not.toBeNull();

    TestBed.runInInjectionContext(() =>
      fill.register(
        { id: 'measurement', tools: [], fields: [{ key: 'weight', kind: 'number', from: [] }] },
        { get: () => '', set: () => undefined },
      ),
    );
    expect(names()).toEqual(['fill_measurement', 'save_measurement']);
  });

  it('un formulario excluido se rellena pero no ofrece `save_`', () => {
    TestBed.runInInjectionContext(() =>
      fill.register(
        { id: 'clinical-status', tools: [], noSave: true, fields: [{ key: 'reason', kind: 'text', from: [] }] },
        { get: () => '', set: () => undefined },
      ),
    );
    expect(names()).toEqual(['fill_clinical_status']);
    expect(registry.runFor('save_clinical_status')).toBeNull();
  });

  it('un formulario que aún carga no se declara', () => {
    TestBed.runInInjectionContext(() =>
      fill.register(
        { id: 'menu-rename', tools: [], fields: [{ key: 'name', kind: 'text', from: [] }], ready: () => false },
        { get: () => '', set: () => undefined },
      ),
    );
    expect(names()).toEqual([]);
  });
});
