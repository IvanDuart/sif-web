#!/usr/bin/env node
/**
 * Mantiene `BACKEND_WRITE_TOOLS` igual a lo que el backend declara de verdad.
 *
 * Lee las DOS fuentes, que es donde está la trampa: el núcleo
 * (`AssistantToolRegistry.WRITE_TOOLS`) y cada `*ToolModule.writeTools()`. El
 * catálogo del asistente son 67 tools, 27 en el registro y 40 en los módulos;
 * mirar sólo una mitad lleva a concluir que no existen tools que sí existen.
 *
 *   node scripts/sync-assistant-tools.mjs            # comprueba, falla si no cuadra
 *   node scripts/sync-assistant-tools.mjs --write    # regenera el fichero
 *
 * El backend se busca en $SIF_BACKEND, o en ../tus-dietas. Si no está, no se
 * puede comprobar nada: avisa y sale en 0, porque el CI de este repo no tiene
 * el otro al lado.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'src/app/features/assistant/copilot/write-tools.testing.ts');
const BACKEND = process.env.SIF_BACKEND ?? resolve(RAIZ, '../tus-dietas');
const JAVA = join(BACKEND, 'src/main/java/com/carajillolabs/tusdietas/service');
const MODULOS = join(JAVA, 'assistant/tools');
const REGISTRO = join(JAVA, 'AssistantToolRegistry.java');

/** Del nombre del módulo al rótulo del grupo, para que el fichero se lea. */
const GRUPOS = {
  AgendaToolModule: 'Agenda',
  DiaryToolModule: 'Diario',
  ExchangeToolModule: 'Intercambios',
  MenuToolModule: 'Menús',
  NotificationToolModule: 'Notificaciones',
  PatientFileToolModule: 'Ficha del paciente',
  RecipeToolModule: 'Recetas',
  ScheduleToolModule: 'Horarios y festivos',
  TenantToolModule: 'Centro',
};

/**
 * Las tools de `writeTools()` de un módulo. Se lee el cuerpo del método y no
 * el fichero entero: las declaraciones de lectura también son literales entre
 * comillas y se colarían todas.
 */
function escriturasDe(fuente) {
  const inicio = fuente.indexOf('Set<String> writeTools()');
  if (inicio === -1) return [];
  let i = fuente.indexOf('{', inicio);
  let nivel = 0;
  let fin = i;
  for (; fin < fuente.length; fin++) {
    if (fuente[fin] === '{') nivel++;
    else if (fuente[fin] === '}' && --nivel === 0) break;
  }
  const cuerpo = fuente.slice(i, fin);
  return [...cuerpo.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]);
}

/**
 * Las escrituras del núcleo: el literal `Set.of(...)` de `WRITE_TOOLS`. Se
 * acota al literal y no al fichero porque `AssistantToolRegistry` declara
 * también 27 tools de lectura, y todas son cadenas entre comillas.
 */
function escriturasDelNucleo() {
  const fuente = readFileSync(REGISTRO, 'utf8');
  const inicio = fuente.indexOf('WRITE_TOOLS = Set.of(');
  if (inicio === -1) return [];
  const fin = fuente.indexOf(');', inicio);
  const literal = fuente.slice(inicio, fin);
  return [...literal.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]);
}

function leerBackend() {
  const nucleo = escriturasDelNucleo();
  const porGrupo = nucleo.length > 0 ? [{ grupo: 'Núcleo', tools: nucleo }] : [];
  for (const fichero of readdirSync(MODULOS).sort()) {
    if (!fichero.endsWith('ToolModule.java')) continue;
    const modulo = fichero.replace('.java', '');
    const tools = escriturasDe(readFileSync(join(MODULOS, fichero), 'utf8'));
    if (tools.length > 0) porGrupo.push({ grupo: GRUPOS[modulo] ?? modulo, tools });
  }
  return porGrupo;
}

function render(porGrupo) {
  const lineas = porGrupo.flatMap(({ grupo, tools }) => [
    `  // ${grupo}`,
    ...tools.map((t) => `  '${t}',`),
  ]);
  return `${CABECERA}export const BACKEND_WRITE_TOOLS: readonly string[] = [\n${lineas.join('\n')}\n];\n`;
}

const CABECERA = readFileSync(DESTINO, 'utf8').split('export const BACKEND_WRITE_TOOLS')[0];

if (!existsSync(MODULOS) || !existsSync(REGISTRO)) {
  console.warn(`[sync:assistant-tools] No encuentro el backend en ${BACKEND}.`);
  console.warn('[sync:assistant-tools] Sin él no hay nada que comparar. Usa $SIF_BACKEND si está en otro sitio.');
  process.exit(0);
}

const esperado = render(leerBackend());
const actual = readFileSync(DESTINO, 'utf8');

if (process.argv.includes('--write')) {
  if (esperado === actual) {
    console.log('[sync:assistant-tools] Ya estaba al día.');
  } else {
    writeFileSync(DESTINO, esperado, 'utf8');
    console.log(`[sync:assistant-tools] Regenerado ${DESTINO}.`);
  }
  process.exit(0);
}

if (esperado !== actual) {
  const nombres = (texto) => new Set([...texto.matchAll(/^ {2}'([a-z_]+)',$/gm)].map((m) => m[1]));
  const hay = nombres(actual);
  const debe = nombres(esperado);
  const sobran = [...hay].filter((t) => !debe.has(t));
  const faltan = [...debe].filter((t) => !hay.has(t));
  console.error('[sync:assistant-tools] La lista NO coincide con el backend.');
  if (sobran.length) console.error(`  Nombramos lo que no existe: ${sobran.join(', ')}`);
  if (faltan.length) console.error(`  El backend tiene y no listamos: ${faltan.join(', ')}`);
  if (!sobran.length && !faltan.length) console.error('  Mismos nombres, distinto orden o agrupación.');
  console.error('  Arréglalo con: npm run sync:assistant-tools -- --write');
  process.exit(1);
}

console.log(`[sync:assistant-tools] Al día: ${[...actual.matchAll(/^ {2}'/gm)].length} escrituras.`);
