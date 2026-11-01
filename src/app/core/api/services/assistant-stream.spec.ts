import { parseFrame, scanFrames } from './assistant-stream';

/**
 * El stream llega a pedazos que no respetan nada: un JSON puede partirse por
 * la mitad y un marco puede llegar en tres trozos. Lo que se prueba aquí es
 * que nada de eso pinte texto a medias ni tumbe el turno.
 */

/** Lo que iría emitiendo el troceado conforme llega el texto a pedazos. */
function feed(chunks: readonly string[]): ReturnType<typeof parseFrame>[] {
  const events: ReturnType<typeof parseFrame>[] = [];
  let buffer = '';
  let consumed = 0;

  for (const chunk of chunks) {
    buffer += chunk;
    const scan = scanFrames(buffer, consumed);
    consumed = scan.consumed;
    for (const frame of scan.frames) events.push(parseFrame(frame));
  }
  return events;
}

describe('stream del asistente', () => {
  describe('troceado', () => {
    it('no suelta un marco hasta que está entero', () => {
      const scan = scanFrames('event: delta\ndata: {"text":"Ho', 0);
      expect(scan.frames).toEqual([]);
      expect(scan.consumed).toBe(0);
    });

    it('junta el JSON partido entre dos pedazos', () => {
      const events = feed(['event: delta\ndata: {"te', 'xt":"Hola"}\n\n']);
      expect(events).toEqual([{ kind: 'delta', text: 'Hola' }]);
    });

    it('saca los dos marcos que llegan juntos en un pedazo', () => {
      const events = feed([
        'event: delta\ndata: {"text":"Voy "}\n\nevent: delta\ndata: {"text":"a buscar"}\n\n',
      ]);
      expect(events).toEqual([
        { kind: 'delta', text: 'Voy ' },
        { kind: 'delta', text: 'a buscar' },
      ]);
    });

    it('entiende los finales de línea de Windows', () => {
      const events = feed(['event: tool\r\ndata: {"name":"search_patients"}\r\n\r\n']);
      expect(events).toEqual([{ kind: 'tool', name: 'search_patients' }]);
    });

    it('no vuelve a emitir lo ya consumido cuando sigue llegando texto', () => {
      const events = feed([
        'event: delta\ndata: {"text":"Hola"}\n\n',
        'event: delta\ndata: {"text":" Ana"}\n\n',
      ]);
      expect(events.length).toBe(2);
    });
  });

  describe('marcos', () => {
    it('lee el turno entero del `done`', () => {
      const turn = {
        assistantMessage: { id: 'm-1', role: 'ASSISTANT', content: 'Hecho.' },
        pendingAction: null,
        uiActions: [{ type: 'NAVIGATE', screen: 'PATIENTS' }],
      };
      expect(parseFrame(`event: done\ndata: ${JSON.stringify(turn)}`)).toEqual({ kind: 'done', turn } as never);
    });

    it('lee el error con su código', () => {
      expect(parseFrame('event: error\ndata: {"error":"Sesión cerrada","code":"error.assistant_session_closed"}'))
        .toEqual({ kind: 'error', error: 'Sesión cerrada', code: 'error.assistant_session_closed' });
    });

    it('junta las líneas `data:` de un mismo marco', () => {
      expect(parseFrame('event: delta\ndata: {"text":"uno\\n\ndata: dos"}')).toBeNull();
      expect(parseFrame('event: delta\ndata: {"text":\ndata: "partido"}')).toEqual({ kind: 'delta', text: 'partido' });
    });

    it('deja pasar lo que no entiende sin tumbar el turno', () => {
      // Comentario de mantener viva la conexión, tipo nuevo, JSON roto y un
      // delta vacío: ninguno es un evento, y ninguno revienta.
      expect(parseFrame(': keep-alive')).toBeNull();
      expect(parseFrame('event: lo_que_venga\ndata: {"a":1}')).toBeNull();
      expect(parseFrame('event: delta\ndata: {roto')).toBeNull();
      expect(parseFrame('event: delta\ndata: {"text":""}')).toBeNull();
      expect(parseFrame('event: done\ndata: {"pendingAction":null}')).toBeNull();
    });

    it('respeta el espacio que es del dato y no del formato', () => {
      // `data: x` y `data:x` son el mismo dato; un segundo espacio ya es texto.
      expect(parseFrame('event: delta\ndata:{"text":" hola"}')).toEqual({ kind: 'delta', text: ' hola' });
    });
  });
});
