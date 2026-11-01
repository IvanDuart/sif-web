/**
 * Markdown mínimo para los mensajes del asistente.
 *
 * El modelo responde con negritas (`**texto**`), alguna cursiva y trozos de
 * código, pero el panel lo pintaba como texto plano y se veían los asteriscos.
 * Aquí sólo se trocea el texto; el pintado lo hace `MascotRichText` con
 * `<strong>` / `<em>` / `<code>`, sin `innerHTML`, así que no hay riesgo de
 * inyección aunque el contenido venga del backend.
 */
export interface RichSegment {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
}

/** Una línea = lista de tramos. Las líneas se pintan separadas por `<br>`. */
export type RichLine = readonly RichSegment[];

/**
 * `` `código` ``, `**negrita**`, `__negrita__` y `*cursiva*`.
 *
 * El contenido no puede empezar ni acabar en espacio (`2 ** 3` no es negrita)
 * y el cierre de la negrita no puede llevar otro asterisco detrás, para que
 * `**muy *urgente***` cierre donde toca. La cursiva con `_` queda fuera a
 * propósito: rompería `snake_case`, los permisos (`MANAGE_MENU`) y las rutas.
 */
const TOKEN =
  /`([^`\n]+)`|\*\*(\S|\S[^\n]*?\S)\*\*(?!\*)|__(\S|\S[^\n]*?\S)__(?!_)|\*(\S|\S[^*\n]*?\S)\*/g;

type RichStyle = Omit<RichSegment, 'text'>;

const PLAIN: RichStyle = { bold: false, italic: false, code: false };

function push(out: RichSegment[], text: string, style: RichStyle): void {
  if (!text) return;
  const last = out[out.length - 1];
  // Une tramos contiguos con el mismo estilo para no generar spans de sobra.
  if (last && last.bold === style.bold && last.italic === style.italic && last.code === style.code) {
    out[out.length - 1] = { ...last, text: last.text + text };
    return;
  }
  out.push({ ...style, text });
}

function parseInline(raw: string, style: RichStyle, out: RichSegment[]): void {
  // Instancia propia por llamada: `parseInline` se llama recursivamente para el
  // contenido de cada token y una expresión global compartida perdería el
  // `lastIndex` del bucle de fuera.
  const token = new RegExp(TOKEN.source, 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(raw)) !== null) {
    push(out, raw.slice(cursor, match.index), style);
    cursor = match.index + match[0].length;

    const [, code, boldStars, boldUnderscores, italic] = match;
    if (code !== undefined) {
      push(out, code, { ...style, code: true });
    } else if (boldStars !== undefined || boldUnderscores !== undefined) {
      parseInline((boldStars ?? boldUnderscores)!, { ...style, bold: true }, out);
    } else if (italic !== undefined) {
      parseInline(italic, { ...style, italic: true }, out);
    }
  }

  push(out, raw.slice(cursor), style);
}

/** Trocea el texto del mensaje en líneas de tramos con estilo. */
export function parseRichText(raw: string | null | undefined): RichLine[] {
  if (!raw) return [];
  return raw.split(/\r?\n/).map((line) => {
    const segments: RichSegment[] = [];
    parseInline(line, PLAIN, segments);
    return segments;
  });
}
