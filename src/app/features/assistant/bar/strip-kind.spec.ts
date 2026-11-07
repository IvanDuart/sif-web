import type { Question } from '../copilot/question.service';
import { stripKind, type StripInput } from './strip-kind';

describe('stripKind', () => {
  const base: StripInput = { question: null, paused: false, acting: false, sending: false, reply: '' };
  const question = (kind: Question['kind']): Question => ({ id: 'q1', kind, text: '¿?' });

  it('sin nada que contar, no cuenta nada', () => {
    expect(stripKind(base)).toBe('idle');
  });

  it('lo que espera respuesta gana a todo lo demás', () => {
    const busy = { ...base, paused: true, acting: true, sending: true, reply: 'hola' };
    expect(stripKind({ ...busy, question: question('confirm') })).toBe('confirm');
    expect(stripKind({ ...busy, question: question('ask') })).toBe('choice');
  });

  it('estar en pausa gana a estar trabajando: lo primero es que se vea que paró', () => {
    expect(stripKind({ ...base, paused: true, acting: true, sending: true })).toBe('paused');
  });

  it('actuar en la pantalla gana a esperar al modelo', () => {
    expect(stripKind({ ...base, acting: true, sending: true })).toBe('acting');
  });

  it('esperar al modelo gana a lo último que dijo', () => {
    expect(stripKind({ ...base, sending: true, reply: 'hola' })).toBe('thinking');
  });

  it('en reposo, lo último que dijo', () => {
    expect(stripKind({ ...base, reply: 'Listo' })).toBe('reply');
    expect(stripKind({ ...base, reply: '   ' })).toBe('idle');
  });
});
