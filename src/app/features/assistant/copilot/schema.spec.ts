import { allSurfaces } from './all-surfaces.testing';
import { declProblem } from './catalog-rules';
import { fillTools } from './schema';

/**
 * El backend descarta sin avisar lo que no cumple sus reglas, así que aquí se
 * prueba contra los formularios reales que **ninguna** herramienta se pierda.
 */
describe('catálogo de herramientas de formulario', () => {
  const surfaces = allSurfaces();

  it('cubre todos los formularios de la aplicación', () => {
    // El número exacto cambia cada vez que se añade una pantalla; lo que
    // importa es que el catálogo de pruebas y el mapa de formularios
    // alcanzables digan lo mismo, y eso lo fija `reachable-forms.spec.ts`.
    expect(surfaces.length).toBeGreaterThanOrEqual(16);
  });

  for (const surface of allSurfaces()) {
    describe(surface.id, () => {
      const tools = fillTools(surface);

      it('genera al menos una herramienta', () => {
        expect(tools.length).toBeGreaterThan(0);
      });

      it('todas las herramientas las aceptaría el backend', () => {
        const problems = tools.map((tool) => ({ name: tool.decl.name, problem: declProblem(tool.decl) }));
        expect(problems.filter((item) => item.problem !== null)).toEqual([]);
      });

      it('no deja ningún campo fuera', () => {
        const declared = new Set(tools.flatMap((tool) => tool.keys));
        const wanted = [...surface.fields.map((f) => f.key), ...(surface.lists ?? []).map((l) => l.key)];
        expect(wanted.filter((key) => !declared.has(key))).toEqual([]);
      });

      it('los nombres no se repiten', () => {
        const names = tools.map((tool) => tool.decl.name);
        expect(new Set(names).size).toBe(names.length);
      });
    });
  }

  it('un formulario que no cabe se parte sin perder campos', () => {
    // Uno inventado y enorme: con los reales nunca hace falta partir.
    const fields = Array.from({ length: 50 }, (_, i) => ({ key: `campo_largo_numero_${i}`, kind: 'text' as const, from: [] }));
    const tools = fillTools({ id: 'enorme', tools: [], fields });
    expect(tools.length).toBeGreaterThan(1);
    expect(tools.flatMap((tool) => tool.keys).sort()).toEqual(fields.map((f) => f.key).sort());
    expect(tools.map((tool) => tool.decl.name)).toEqual(['fill_enorme', 'fill_enorme_2', ...tools.slice(2).map((_, i) => `fill_enorme_${i + 3}`)]);
    for (const tool of tools) expect(declProblem(tool.decl)).toBeNull();
  });

  it('las personas no se enumeran en la declaración', () => {
    const appointment = allSurfaces().find((surface) => surface.id === 'appointment')!;
    const [tool] = fillTools(appointment);
    const props = tool.decl.parameters['properties'] as Record<string, { enum?: string[] }>;
    expect(props['patientId'].enum).toBeUndefined();
    expect(props['nutritionistId'].enum).toBeUndefined();
    expect(JSON.stringify(tool.decl)).not.toContain('Ana García');
  });

  it('un choice con pocas opciones las enumera', () => {
    const appointment = allSurfaces().find((surface) => surface.id === 'appointment')!;
    const [tool] = fillTools(appointment);
    const type = (tool.decl.parameters['properties'] as Record<string, { enum?: string[] }>)['typeId'];
    expect(type?.enum).toEqual(['Primera visita', 'Revisión']);
  });

  it('las filas van como cadenas, para no pasar de 3 niveles', () => {
    const schedule = allSurfaces().find((surface) => surface.id === 'schedule')!;
    const [tool] = fillTools(schedule);
    const details = (tool.decl.parameters['properties'] as Record<string, { type: string; items: { type: string } }>)['details'];
    expect(details.type).toBe('array');
    expect(details.items.type).toBe('string');
  });
});
