import { readingDoc } from './reading-doc';

describe('readingDoc', () => {
  const long = (count: number) => Array.from({ length: count }, (_, i) => `palabra${i}`).join(' ');

  it('lo corto se queda en la barra', () => {
    expect(readingDoc('Hecho, ya está apuntado.')).toBeNull();
    expect(readingDoc('   ')).toBeNull();
  });

  it('lo largo se abre en la bandeja', () => {
    expect(readingDoc(long(130))).not.toBeNull();
    expect(readingDoc(long(119))).toBeNull();
  });

  it('con títulos se abre aunque sea corto: el modelo ya lo está estructurando', () => {
    const doc = readingDoc('## Desayuno\nAvena.\n## Comida\nLentejas.');
    expect(doc?.sections).toEqual([
      { title: 'Desayuno', body: 'Avena.' },
      { title: 'Comida', body: 'Lentejas.' },
    ]);
  });

  it('lo que va antes del primer título es su propia sección', () => {
    const doc = readingDoc('Te he preparado el menú.\n# Lunes\nArroz.');
    expect(doc?.sections[0]).toEqual({ title: '', body: 'Te he preparado el menú.' });
    expect(doc?.sections[1]).toEqual({ title: 'Lunes', body: 'Arroz.' });
  });

  it('en la barra queda la primera frase, no el primer título', () => {
    expect(readingDoc('# Menú semanal\nAquí lo tienes. Y lo demás.')?.lead).toBe('Aquí lo tienes.');
  });

  it('sin punto final, la primera línea entera', () => {
    expect(readingDoc(`Resumen del plan\n${long(130)}`)?.lead).toBe('Resumen del plan');
  });
});
