/**
 * Diagnóstico temporal (2026-11-13): ¿la mascota TECLEA en el formulario o pone
 * el valor de golpe? El análisis estático no encontró el fallo, así que se mide.
 *
 * Muestrea la longitud del campo cada 40 ms mientras corre el turno. Si teclea,
 * la serie sube a trozos; si lo pone de golpe, salta de 0 al total.
 *
 *   node tests/diagnostico-tecleo.mjs
 */
import { chromium } from '@playwright/test';

const USER = process.env.SIF_USER;
const PASS = process.env.SIF_PASS;
const BASE = 'http://localhost:4200';

const navegador = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
const ctx = await navegador.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (/mascot|copilot|assistant|catalogo|catálogo/i.test(t)) console.log('  [consola]', t.slice(0, 160));
});

try {
  console.log('→ Entrando…');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  if (!page.url().includes('/dashboard')) {
    await page.locator('#username, input[name="username"]').first().fill(USER);
    await page.locator('#password, input[name="password"]').first().fill(PASS);
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForURL('**/dashboard', { timeout: 45000 });
  }
  console.log('✓ Dentro:', page.url());

  // Lo que el usuario dice que no se ve: el relleno del formulario de receta.
  await page.goto(`${BASE}/templates`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  const movimientoReducido = await page.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  console.log('  prefers-reduced-motion:', movimientoReducido);

  await page.evaluate(() => globalThis.nuti?.bar?.(true));
  const entrada = page.locator('[data-mascot-bar-input]');
  await entrada.waitFor({ state: 'visible', timeout: 15000 });

  // Puerta de consentimiento de IA: sin aceptarla el mensaje no sale. El panel
  // tarda en montarse, así que se le da tiempo y se comprueba que se va.
  await page.waitForTimeout(3000);
  const acepto = page.locator('button.chip:has-text("Acepto")').first();
  if (await acepto.isVisible({ timeout: 10000 }).catch(() => false)) {
    await acepto.click();
    await acepto.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    console.log('  consentimiento aceptado');
    await page.waitForTimeout(2000);
  } else {
    console.log('  (no hacía falta consentimiento)');
  }

  // El muestreador vive en la página y recoge la serie mientras corre el turno.
  await page.evaluate(() => {
    globalThis.__serie = [];
    const t0 = performance.now();
    globalThis.__muestreo = setInterval(() => {
      const campo = (k) =>
        document.querySelector(`[data-mascot-field="template.${k}"]`) ??
        document.querySelector(`[formcontrolname="${k}"]`);
      const pasos = campo('description');
      const nombre = campo('name');
      if (!pasos && !nombre) return;
      globalThis.__serie.push({
        ms: Math.round(performance.now() - t0),
        nombre: nombre ? String(nombre.value ?? '').length : -1,
        pasos: pasos ? String(pasos.value ?? '').length : -1,
      });
    }, 40);
  });

  console.log('→ Pidiendo la receta…');
  await entrada.click();
  await entrada.pressSequentially(
    'crea una plantilla de menú llamada "Prueba tecleo" con esta descripción: ' +
      'Plantilla de prueba para comprobar si el texto se escribe poco a poco o aparece de ' +
      'golpe en el formulario, con una descripción deliberadamente larga para que se note.',
  );
  const enviar = page.locator('button.icon--send').first();
  await enviar.waitFor({ state: 'visible' });
  if (await enviar.isEnabled().catch(() => false)) await enviar.click();
  else await entrada.press('Enter');

  console.log('  esperando a que se abra el formulario…');
  const abierto = await page
    .locator('[data-mascot-field="template.description"], [formcontrolname="description"]')
    .waitFor({ state: 'attached', timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  console.log('  formulario abierto:', abierto);
  await page.waitForTimeout(abierto ? 12000 : 3000);

  const serie = await page.evaluate(() => {
    clearInterval(globalThis.__muestreo);
    return globalThis.__serie;
  });

  await page.screenshot({ path: '/tmp/diagnostico-tecleo.png', fullPage: false });

  // Sólo los puntos donde algo CAMBIÓ: la serie entera es ruido.
  const cambios = serie.filter((p, i) => i === 0 || p.pasos !== serie[i - 1].pasos || p.nombre !== serie[i - 1].nombre);
  console.log(`\n=== Serie (${serie.length} muestras, ${cambios.length} cambios) ===`);
  for (const p of cambios) console.log(`  ${String(p.ms).padStart(6)} ms   nombre=${p.nombre}   pasos=${p.pasos}`);

  const saltos = cambios.filter((p, i) => i > 0 && p.pasos - cambios[i - 1].pasos > 40);
  const chat = await page
    .locator('[data-mascot-bar-input]')
    .evaluate((el) => el.closest('.bar, [class*=bar]')?.innerText?.slice(-700) ?? '(sin panel)')
    .catch(() => '(ilegible)');
  console.log('\n=== Final del chat ===\n' + chat);

  console.log('\n=== Veredicto ===');
  if (serie.length === 0) console.log('  SIN DATOS: el formulario de receta no llegó a existir; no se midió nada.');
  else if (cambios.length <= 2) console.log('  NO TECLEA: el campo pasa de vacío a completo sin pasos intermedios.');
  else if (saltos.length > 0) console.log(`  Teclea a trozos MUY grandes (${saltos.length} saltos de +40 caracteres).`);
  else console.log('  TECLEA: hay pasos intermedios.');
} finally {
  await navegador.close();
}
