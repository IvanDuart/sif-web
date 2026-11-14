/**
 * Diagnóstico temporal: ¿qué herramientas pide el modelo, en qué orden y con
 * qué argumentos, al rellenar un formulario?
 *
 * Duplica el stream SSE (la app usa `withFetch()`) y vuelca la secuencia. Es la
 * única forma de ver los "viajes" sin leer el log del backend.
 */
import { chromium } from '@playwright/test';

const USER = process.env.SIF_USER;
const PASS = process.env.SIF_PASS;
const BASE = 'http://localhost:4200';
const PETICION = process.env.PROMPT
  ?? 'créame una receta de tortilla de patatas para 4 raciones, descripción "Tortilla tradicional", '
     + 'ingredientes patata y huevo, y pasos: 1. Pelar. 2. Freír. 3. Batir. 4. Cuajar.';

const navegador = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
const ctx = await navegador.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
  globalThis.__frames = [];
  const t0 = performance.now();
  const original = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    const res = await original(...args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? '';
    globalThis.__urls = globalThis.__urls ?? [];
    globalThis.__urls.push(url.slice(-70) + (res.body ? '' : ' [sin body]'));
    if (!url.includes('/messages/stream') || !res.body) return res;
    const [paraLaApp, paraMi] = res.body.tee();
    globalThis.__diag = { trozos: 0, bytes: 0, error: null };
    (async () => {
      try {
      const lector = paraMi.getReader();
      const dec = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        globalThis.__diag.trozos += 1;
        globalThis.__diag.bytes += value.length;
        buffer += dec.decode(value, { stream: true });
        const trozos = buffer.split('\n\n');
        buffer = trozos.pop() ?? '';
        for (const t of trozos) {
          globalThis.__diag.muestra = globalThis.__diag.muestra ?? t.slice(0, 120);
          const ev = /^event:\s*(.+?)\s*$/m.exec(t)?.[1];
          const data = /^data:\s?(.*)$/m.exec(t)?.[1];
          if (ev) globalThis.__frames.push({ ms: Math.round(performance.now() - t0), ev, data });
        }
      }
      } catch (e) { globalThis.__diag.error = String(e); }
    })();
    return new Response(paraLaApp, { status: res.status, headers: res.headers });
  };
});
const page = await ctx.newPage();

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  if (!page.url().includes('/dashboard')) {
    await page.locator('#username, input[name="username"]').first().fill(USER);
    await page.locator('#password, input[name="password"]').first().fill(PASS);
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await page.waitForURL('**/dashboard', { timeout: 45000 });
  }
  await page.goto(`${BASE}${process.env.RUTA ?? '/recipes'}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.evaluate(() => globalThis.nuti?.bar?.(true));
  const entrada = page.locator('[data-mascot-bar-input]');
  await entrada.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(3000);
  const acepto = page.locator('button.chip:has-text("Acepto")').first();
  if (await acepto.isVisible({ timeout: 8000 }).catch(() => false)) {
    await acepto.click();
    await page.waitForTimeout(2000);
  }

  await entrada.click();
  await entrada.pressSequentially(PETICION);
  const enviar = page.locator('button.icon--send').first();
  if (await enviar.isEnabled().catch(() => false)) await enviar.click();
  else await entrada.press('Enter');

  // La trayectoria de la mascota: su posición en pantalla cada 60 ms.
  await page.evaluate(() => {
    globalThis.__ruta = [];
    const t0 = performance.now();
    globalThis.__rutaTimer = setInterval(() => {
      const m = document.querySelector('.mascot-fab');
      if (!m) return;
      const r = m.getBoundingClientRect();
      const p = { ms: Math.round(performance.now() - t0), x: Math.round(r.x), y: Math.round(r.y) };
      const ultimo = globalThis.__ruta.at(-1);
      if (!ultimo || Math.abs(ultimo.x - p.x) > 12 || Math.abs(ultimo.y - p.y) > 12) {
        globalThis.__ruta.push(p);
      }
    }, 60);
  });

  await page.waitForTimeout(Number(process.env.ESPERA ?? 75000));

  const ruta = await page.evaluate(() => {
    clearInterval(globalThis.__rutaTimer);
    return globalThis.__ruta;
  });
  // Una "parada" es donde se queda quieta; entre paradas hay un viaje.
  const paradas = ruta.filter((p, i) => i === 0 || i === ruta.length - 1
    || (ruta[i + 1] && ruta[i + 1].ms - p.ms > 400));
  console.log(`\n=== Trayectoria: ${ruta.length} movimientos, ${paradas.length} paradas ===`);
  for (const p of paradas) console.log(`  ${String(p.ms).padStart(6)} ms   (${p.x}, ${p.y})`);

  const urls = await page.evaluate(() => globalThis.__urls ?? []);
  console.log('\n=== URLs por fetch (' + urls.length + ') ===');
  for (const u of urls.slice(-12)) console.log('  ', u);
  console.log('=== lector ===', JSON.stringify(await page.evaluate(() => globalThis.__diag ?? null)));
  const frames = await page.evaluate(() => globalThis.__frames);
  console.log(`\n=== ${frames.length} tramas ===`);
  let paso = 0;
  for (const f of frames) {
    if (f.ev === 'delta') continue;
    let extra = '';
    if (f.ev === 'client_tool') {
      paso += 1;
      try {
        const d = JSON.parse(f.data);
        const call = d.call ?? d;
        extra = `${call.name}  args=${JSON.stringify(call.args ?? {}).slice(0, 150)}`;
      } catch { extra = f.data?.slice(0, 120) ?? ''; }
      console.log(`  ${String(f.ms).padStart(6)} ms  [paso ${paso}] ${extra}`);
    } else if (f.ev === 'tool') {
      console.log(`  ${String(f.ms).padStart(6)} ms  (servidor) ${f.data?.slice(0, 120)}`);
    } else if (f.ev !== 'heartbeat') {
      console.log(`  ${String(f.ms).padStart(6)} ms  <${f.ev}> ${f.data?.slice(0, 120)}`);
    }
  }
} finally {
  await navegador.close();
}
