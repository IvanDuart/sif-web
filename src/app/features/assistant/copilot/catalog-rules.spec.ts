import { MAX_DESCRIPTION, MAX_SCHEMA_BYTES, cleanDescription, declProblem } from './catalog-rules';

const decl = (over: Partial<Parameters<typeof declProblem>[0]> = {}) => ({
  name: 'fill_measurement',
  description: 'Rellena la medición',
  parameters: { type: 'object', properties: { weightKg: { type: 'number' } } },
  ...over,
});

describe('reglas del backend para lo que se declara', () => {
  it('acepta una declaración correcta', () => {
    expect(declProblem(decl())).toBeNull();
  });

  it('rechaza nombres con guion, mayúsculas o muy cortos', () => {
    expect(declProblem(decl({ name: 'fill_patient-profile' }))).toContain('nombre');
    expect(declProblem(decl({ name: 'Fill_x' }))).toContain('nombre');
    expect(declProblem(decl({ name: 'ab' }))).toContain('nombre');
  });

  it('rechaza familias que no son suyas', () => {
    expect(declProblem(decl({ name: 'search_patients' }))).toContain('familia');
    expect(declProblem(decl({ name: 'fill_' }))).not.toBeNull();
  });

  it('acepta los nombres sueltos del contrato', () => {
    for (const name of ['point_at', 'show_around', 'press', 'ask_user', 'navigate', 'echo']) {
      expect(declProblem(decl({ name }))).toBeNull();
    }
  });

  it('una descripción larga o en varias líneas no se rechaza: se deja limpia', () => {
    expect(declProblem(decl({ description: 'x'.repeat(MAX_DESCRIPTION + 1) }))).toBeNull();
    expect(declProblem(decl({ description: 'a\nb' }))).toBeNull();
    expect(cleanDescription('a\n\nb   c')).toBe('a b c');
    expect(cleanDescription('x'.repeat(MAX_DESCRIPTION + 50)).length).toBe(MAX_DESCRIPTION);
  });

  it('rechaza esquemas de más de 2 KB', () => {
    const properties = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`campo_${i}`, { type: 'string', description: 'x'.repeat(30) }]),
    );
    const problem = declProblem(decl({ parameters: { type: 'object', properties } }));
    expect(problem).toContain('bytes');
    expect(MAX_SCHEMA_BYTES).toBe(2048);
  });

  it('rechaza más de 3 niveles de anidamiento', () => {
    const deep = { type: 'object', properties: { a: { type: 'object', properties: { b: { type: 'object', properties: { c: { type: 'string' } } } } } } };
    expect(declProblem(decl({ parameters: deep }))).toContain('anidado');
  });

  it('una lista de objetos con campos ya pasa de 3 niveles', () => {
    const rows = { type: 'object', properties: { details: { type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } } } };
    expect(declProblem(decl({ parameters: rows }))).toContain('anidado');
  });

  it('rechaza tipos que no admite y arrays sin items', () => {
    expect(declProblem(decl({ parameters: { type: 'object', properties: { a: { type: 'null' } } } }))).toContain('tipo');
    expect(declProblem(decl({ parameters: { type: 'object', properties: { a: { type: 'array' } } } }))).toContain('items');
  });
});
