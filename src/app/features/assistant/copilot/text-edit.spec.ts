import { applyTextEdit } from './text-edit';

describe('applyTextEdit', () => {
  const NOTE = 'Viene en ayunas.\nTrae la analítica de marzo.';

  const text = (result: ReturnType<typeof applyTextEdit>) => (result.ok ? result.text : null);

  it('añade al final en un párrafo nuevo', () => {
    expect(text(applyTextEdit(NOTE, { op: 'append', text: 'Pesa 70 kg.' })))
      .toBe('Viene en ayunas.\nTrae la analítica de marzo.\nPesa 70 kg.');
  });

  it('sobre un texto vacío, añadir es escribir', () => {
    expect(text(applyTextEdit('', { op: 'append', text: 'Primera nota.' }))).toBe('Primera nota.');
    expect(text(applyTextEdit('   ', { op: 'prepend', text: 'Primera nota.' }))).toBe('Primera nota.');
  });

  it('añade al principio', () => {
    expect(text(applyTextEdit(NOTE, { op: 'prepend', text: 'URGENTE.' })))
      .toBe('URGENTE.\nViene en ayunas.\nTrae la analítica de marzo.');
  });

  it('inserta después y antes del fragmento', () => {
    expect(text(applyTextEdit(NOTE, { op: 'insert_after', anchor: 'Viene en ayunas.', text: 'Desde las 22 h.' })))
      .toBe('Viene en ayunas.\nDesde las 22 h.\nTrae la analítica de marzo.');
    expect(text(applyTextEdit(NOTE, { op: 'insert_before', anchor: 'Trae la analítica', text: 'Nota:' })))
      .toContain('Nota:\nTrae la analítica');
  });

  it('sustituye el fragmento', () => {
    expect(text(applyTextEdit(NOTE, { op: 'replace', anchor: 'marzo', text: 'abril' })))
      .toBe('Viene en ayunas.\nTrae la analítica de abril.');
  });

  it('borra el fragmento y recoge lo que queda', () => {
    expect(text(applyTextEdit(NOTE, { op: 'delete', anchor: 'Trae la analítica de marzo.' })))
      .toBe('Viene en ayunas.');
  });

  it('un fragmento que no está no se inventa', () => {
    expect(applyTextEdit(NOTE, { op: 'replace', anchor: 'colesterol', text: 'x' }))
      .toEqual({ ok: false, reason: 'not_found' });
  });

  it('un fragmento repetido es ambiguo: elegir por la persona sería inventarse cuál', () => {
    expect(applyTextEdit('peso 70\npeso 72', { op: 'replace', anchor: 'peso', text: 'masa' }))
      .toEqual({ ok: false, reason: 'ambiguous' });
  });

  it('las operaciones mal pedidas no tocan el texto', () => {
    expect(applyTextEdit(NOTE, { op: 'replace', text: 'x' })).toEqual({ ok: false, reason: 'tool_error' });
    expect(applyTextEdit(NOTE, { op: 'append' })).toEqual({ ok: false, reason: 'tool_error' });
    expect(applyTextEdit(NOTE, { op: 'delete' })).toEqual({ ok: false, reason: 'tool_error' });
  });
});
