/**
 * Cuándo una respuesta se lee y cuándo se escucha.
 *
 * Una barra de abajo tiene sitio para una frase. Una respuesta de doce líneas
 * metida ahí obliga a leer por una rendija, y puesta en un globo tapa la
 * pantalla en la que la mascota acaba de trabajar. Lo largo se abre en la
 * bandeja, con sus secciones, y en la barra queda solo la primera frase.
 *
 * Es una función pura: decide, no pinta.
 */

/** A partir de aquí, leer en la barra es incómodo. */
const LONG_WORDS = 120;

export interface DocSection {
  /** El título de la sección, o vacío si el texto empieza sin uno. */
  title: string;
  body: string;
}

export interface ReadingDoc {
  /** Lo que se queda en la barra. */
  lead: string;
  sections: DocSection[];
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word !== '').length;
}

/** El título de una línea markdown (`#`, `##`, `###`), o `null`. */
function headingOf(line: string): string | null {
  const match = /^\s{0,3}(#{1,3})\s+(.*\S)\s*$/.exec(line);
  return match ? match[2] : null;
}

/** La primera frase, para que la barra diga algo con sentido. */
function leadOf(text: string): string {
  const firstLine = text.split('\n').map((line) => line.trim()).find((line) => line !== '' && headingOf(line) === null);
  if (!firstLine) return text.trim().split('\n')[0]?.trim() ?? '';
  const sentence = /^(.*?[.!?])(\s|$)/.exec(firstLine);
  return (sentence ? sentence[1] : firstLine).trim();
}

/**
 * La respuesta como documento, o `null` si cabe en la barra tal cual.
 *
 * Se abre en la bandeja si es larga o si viene con títulos: los títulos los
 * pone el modelo cuando ya está estructurando, y eso es señal de que hay que
 * leerlo, no oírlo de pasada.
 */
export function readingDoc(markdown: string): ReadingDoc | null {
  const text = markdown.trim();
  if (text === '') return null;

  const lines = text.split('\n');
  const hasHeadings = lines.some((line) => headingOf(line) !== null);
  if (!hasHeadings && words(text) < LONG_WORDS) return null;

  const sections: DocSection[] = [];
  let current: DocSection = { title: '', body: '' };
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading === null) {
      current.body += (current.body === '' ? '' : '\n') + line;
      continue;
    }
    if (current.title !== '' || current.body.trim() !== '') sections.push(current);
    current = { title: heading, body: '' };
  }
  if (current.title !== '' || current.body.trim() !== '') sections.push(current);

  return {
    lead: leadOf(text),
    sections: sections.map((section) => ({ title: section.title, body: section.body.trim() })),
  };
}
