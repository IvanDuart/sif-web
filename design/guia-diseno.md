# Guía de diseño — SaaS para clínicas de nutrición

Instrucciones para que cualquier IA (o persona) diseñe pantallas nuevas coherentes con
las ya existentes. Está escrita para pegarse entera como contexto antes de pedir una
pantalla. Si algo de aquí choca con lo que te piden, gana esta guía: pregúntalo antes de
inventar una excepción.

Pantallas ya construidas, como referencia viva: `dashboard-nutricionista.html`,
`agenda.html`, `pacientes.html`, `ficha-paciente.html`, `planes.html`,
`plan-detalle.html`, `metricas.html`, `configuracion.html`.

---

## 1. Qué se entrega y cómo

Cada pantalla es **un único archivo `.html` autocontenido**: CSS en un `<style>` y JS en
un `<script>`, sin build, sin dependencias externas salvo las tipografías. Se abre con
doble clic y funciona.

El JS va dentro de una IIFE con `'use strict'`, en estilo ES5 (`var`, `function`), sin
frameworks y sin `localStorage`. Los datos son **ficticios pero deterministas**: si hace
falta variedad, se usa un generador con semilla (LCG) para que la pantalla muestre
siempre lo mismo en cada carga. Nada de `Math.random()` suelto.

Todo el texto de interfaz está en **español de España**. Fechas en formato natural
(`14 feb 2025`, `jueves 24 de septiembre de 2026`), importes con coma decimal y punto de
millar (`15.444 €`), y `font-variant-numeric: tabular-nums` en toda cifra que se compare
en vertical.

---

## 2. Reglas de producto innegociables

Estas no se discuten ni se relajan "solo para este caso":

- **Cero calorías en toda la plataforma**, ni para el profesional ni para el paciente. Los
  planes se construyen por **raciones e intercambios**. Prohibido: kcal, déficit, objetivo
  calórico, barras de progreso calórico, macros como cifra principal.
- El **peso** se muestra como **línea de tendencia suavizada**, nunca como puntos crudos
  que exageren la oscilación diaria.
- **Solo el administrador del centro ve datos de otros profesionales** (agenda,
  facturación, asistencia, configuración). La nutricionista ve lo suyo y punto. Cuando una
  vista se comparte entre ambos roles, es la misma pantalla con distinto alcance, no dos
  pantallas.
- **Las plantillas de plan se copian al asignarlas**: editar la plantilla nunca altera el
  menú ya entregado a un paciente.
- **Lenguaje no moralizante** sobre comida ni peso. Nada de "malos hábitos", "te has
  pasado", "peso ideal", emojis de celebración por bajar de peso.

---

## 3. Tokens

Copia este bloque tal cual al principio del `<style>`. No inventes colores fuera de aquí;
si necesitas un matiz nuevo, deriva de uno existente y anótalo.

```css
:root{
  color-scheme: light;
  --canvas:#FBFAF8; --surface:#FFFFFF; --sunken:#F4F2EE;
  --line:#EAE7E1; --line-strong:#D8D4CC;
  --ink-3:#9A958C; --ink-2:#6B665E; --ink:#1F1D1A;
  --primary:#2F5D4F; --primary-hover:#264B40; --primary-soft:#EDF2F0;
  --accent:#C45608; --accent-soft:#FAF0EA;
  --ok:#2D7A5F; --warn:#B5892C; --warn-soft:#FBF4E6;
  --err:#B04A3E; --err-soft:#FBF0EE; --info:#3C6E96;
  --r-sm:8px; --r-md:12px; --r-pill:999px;
  --font-ui:'Inter', system-ui, sans-serif;
  --font-display:'Source Serif 4', Georgia, serif;
  --display-weight:600; --display-spacing:-0.01em;
  --shadow-float:0 1px 2px rgba(31,29,26,.04), 0 8px 24px rgba(31,29,26,.06);
}
html[data-type="a"]{ --font-display:'Inter Tight', system-ui, sans-serif; --display-weight:600; --display-spacing:-0.02em; }
html[data-type="c"]{ --font-display:'Satoshi', system-ui, sans-serif; --display-weight:700; --display-spacing:-0.02em; }
```

Qué significa cada cosa en la práctica: `--canvas` es el fondo de la aplicación,
`--surface` el de las tarjetas y tablas, `--sunken` el de los rellenos apagados (franja de
comida, avatares neutros, filas de resumen). `--primary` es verde y se usa para acción,
selección y estado activo; `--accent` es naranja y se reserva para el "ahora" (día de hoy,
línea de hora actual, logotipo) y para avisos suaves, nunca como segundo botón primario.

Los cuatro colores semánticos (`ok`, `warn`, `err`, `info`) solo aparecen en estados, nunca
como decoración. Cada color de profesional se define aparte, en los datos, con su pareja
`color` / `soft`.

Sombra: **solo** `--shadow-float`, y solo en elementos flotantes (diálogo, menú, toast,
control de prototipo). Las tarjetas se separan con borde de 1 px, no con sombra.

Radios: 8 px en controles, 12 px en contenedores, pill en chips y avatares.

Espaciado: múltiplos de 2 px, con 4 / 8 / 12 / 16 / 22 / 32 como escala habitual.

---

## 4. Tipografía

Dos familias: **Inter** para interfaz y **Source Serif 4** para títulos (`h1`–`h3`).
El prototipo permite cambiar la familia de títulos en caliente con `html[data-type]`
(a = Inter Tight, b = Source Serif, c = Satoshi), así que **los títulos nunca llevan
`font-family` fijo**: heredan de `--font-display`.

```css
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:var(--canvas);color:var(--ink);font-family:var(--font-ui);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;}
h1,h2,h3{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-spacing);line-height:1.2;margin:0;}
button{font:inherit;color:inherit;background:none;border:none;padding:0;cursor:pointer;}
a{color:inherit;text-decoration:none;}
:focus-visible{outline:2px solid var(--primary);outline-offset:3px;border-radius:4px;}
```

Escala de uso: título de pantalla 30 px, título de tarjeta o diálogo 19 px, subtítulo
18 px, texto normal 14–14,5 px, secundario 13–13,5 px, etiqueta o pie 12–12,5 px.
Nunca por debajo de 11,5 px. El peso máximo del texto de interfaz es 500; el 600 se
reserva para iniciales de avatar y cifras destacadas.

---

## 5. Esqueleto de pantalla

Rejilla de dos columnas: barra lateral fija de 244 px y contenido. La barra lateral es
**idéntica en todas las pantallas**, con `aria-current="page"` en la actual y el bloque de
usuario abajo del todo.

```html
<div class="app">
  <aside class="side">
    <div class="brand">…logo SVG…<div class="brand-text"><div class="brand-sub">Clínica Bonanova</div></div></div>
    <nav class="nav" aria-label="Principal">
      <!-- Inicio · Agenda · Pacientes · Planes · Métricas del centro · Informes -->
      <a class="nav-item" href="agenda.html"><svg …></svg><span>Agenda</span><em class="nav-badge">7</em></a>
    </nav>
    <div class="nav-foot">
      <a class="nav-item" href="configuracion.html">…<span>Configuración</span></a>
      <div class="who"><div class="av">MI</div><div class="txt">
        <div class="nm">Marta Ibáñez</div><div class="rl" id="meRole">Nutricionista</div></div></div>
    </div>
  </aside>

  <main class="main">
    <div class="topbar">
      <div><h1>Título</h1><p class="range">contexto o periodo</p></div>
      <div class="topbar-actions">…controles y un único botón primario…</div>
    </div>
    …contenido…
  </main>
</div>
```

```css
.app{display:grid;grid-template-columns:244px 1fr;min-height:100vh;}
.side{border-right:1px solid var(--line);background:var(--canvas);padding:24px 16px;display:flex;flex-direction:column;gap:32px;position:sticky;top:0;height:100vh;}
.nav-item{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:var(--r-sm);color:var(--ink-2);font-size:14.5px;}
.nav-item:hover{background:var(--sunken);color:var(--ink);}
.nav-item[aria-current="page"]{background:var(--primary-soft);color:var(--primary);font-weight:500;}
.main{padding:28px 32px 48px;max-width:1500px;}
.topbar{display:flex;align-items:flex-start;gap:20px;margin-bottom:22px;flex-wrap:wrap;}
.topbar h1{font-size:30px;}
.topbar-actions{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
@media (max-width:1180px){
  .app{grid-template-columns:72px 1fr;}
  .brand-text,.nav-item span,.who .txt{display:none;}
  .nav-item{justify-content:center;}
  .main{padding:24px 18px 56px;}
}
```

Regla dura: **un solo botón primario por pantalla** (y uno por diálogo). Todo lo demás es
`.btn-quiet`, chip o enlace. Si dudas de si algo merece botón primario, no lo merece.

Todas las pantallas llevan abajo a la derecha el **control de prototipo**, que permite
cambiar de rol y de tipografía sin recargar. Es andamiaje de la maqueta, no parte del
producto:

```html
<div class="proto" role="group" aria-label="Controles del prototipo">
  <span>Rol</span>
  <button type="button" data-role="pro" aria-pressed="true">Nutricionista</button>
  <button type="button" data-role="admin" aria-pressed="false">Administrador</button>
  <i class="sep"></i>
  <span>Tipografía</span>
  <button type="button" data-set="a" aria-pressed="false">Inter Tight</button>
  <button type="button" data-set="b" aria-pressed="true">Source Serif</button>
  <button type="button" data-set="c" aria-pressed="false">Satoshi</button>
</div>
```

---

## 6. Componentes

**Botones.** `.btn-primary` (verde, 10×16, con icono opcional de 15 px a la izquierda),
`.btn-quiet` (fondo blanco, borde `--line`), `.btn-danger` (solo para destruir, y siempre
tras confirmación). El primario deshabilitado baja a `opacity:.35`.

**Chips.** Filtros y opciones excluyentes. Son `<button>` con `aria-pressed`; el activo se
rellena de `--primary`. Los chips con contador llevan `<span class="n">` a la derecha.
Para elegir un valor dentro de un formulario, el chip puede llevar `<small>` con el detalle
(por ejemplo la duración de un tipo de cita).

**Segmented.** Cambio de vista o de periodo (Día/Semana/Mes, Mes/Trimestre/Año). Botones
unidos por borde, activo con `--primary-soft`.

**Búsqueda.** `.search` con lupa dentro, `min-width:290px`, borde que pasa a `--primary`
con `:focus-within`.

**Tabla.** Contenedor `.tablewrap` con borde y radio 12, cabecera pegajosa, ordenación por
columna con `aria-sort` y una flecha que solo se ve al pasar o al estar activa. Fila
completa clicable para abrir el detalle, más un **kebab** de acciones al final que solo
aparece en hover o foco. Las cifras van en `td.num` con tabular-nums. Debajo, `.foot` con
el recuento.

**Etiquetas de estado.** `.tag` pill, 12 px, con variante por estado (`activo`, `pausa`,
`alta`, `nuevo`, `inactivo`). Nunca más de un tag por fila.

**Menú contextual.** `.menu` flotante, mínimo 210 px, con separadores y la acción
destructiva en rojo al final.

**Tarjetas.** Borde 1 px, radio 12, fondo `--surface`, `h2` de 19 px y un `p.hint` de
13 px explicando en una frase qué contiene. Los pares dato/valor van en rejilla `.kv` con
clave en `--ink-3` de 12 px y valor de 14 px.

**Toast.** Píldora oscura centrada abajo, con acción **Deshacer** cuando la operación es
reversible. Si hay deshacer, el registro se vuelve a insertar en su índice original.

**Gráficos.** SVG en línea, sin librerías. Barras con `<title>` para el tooltip nativo;
líneas suavizadas con Catmull-Rom. El `viewBox` se calcula con el `clientWidth` real en el
momento de pintar; nunca `preserveAspectRatio="none"` (deforma el texto y el grosor).

---

## 7. Diálogos: el único patrón de superposición

**No se usan paneles laterales.** Todo lo que se abre encima es un diálogo centrado con
este marcado y estas tallas. La talla se elige por contenido, no por costumbre.

```html
<div class="dialog" id="miDlg" data-size="md" role="dialog" aria-modal="true"
     aria-hidden="true" aria-labelledby="miDlgTitle">
  <div class="panel">
    <header><h2 id="miDlgTitle">Título</h2>
      <button class="close" type="button" aria-label="Cerrar">…</button></header>
    <div class="body">…</div>
    <footer><button class="btn-primary" type="button">Acción</button>
      <span class="sum">contexto o motivo por el que está deshabilitada</span></footer>
  </div>
</div>
```

```css
.dialog{position:fixed;inset:0;z-index:31;display:none;place-items:center;padding:24px;background:rgba(31,29,26,.22);}
.dialog.on{display:grid;}
.dialog .panel{background:var(--surface);border-radius:var(--r-md);box-shadow:var(--shadow-float);width:100%;max-width:520px;max-height:min(84vh,780px);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(10px) scale(.99);transition:opacity .15s ease,transform .15s ease;}
.dialog.on .panel{opacity:1;transform:none;}
@starting-style{ .dialog.on .panel{opacity:0;transform:translateY(10px) scale(.99);} }
.dialog[data-size="sm"] .panel{max-width:440px;}
.dialog[data-size="md"] .panel{max-width:560px;}
.dialog[data-size="lg"] .panel{max-width:800px;}
.dialog header{display:flex;align-items:center;gap:12px;padding:20px 24px 16px;border-bottom:1px solid var(--line);}
.dialog .body{padding:22px 24px;overflow-y:auto;flex:1;}
.dialog footer{padding:16px 24px;border-top:1px solid var(--line);display:flex;align-items:center;gap:12px;}
.dialog footer .sum{font-size:12.5px;color:var(--ink-3);line-height:1.35;}
@media (prefers-reduced-motion:reduce){ .dialog .panel{transition:none;} }
```

Cuándo usar cada talla: **sm (440)** para confirmar o avisar, texto corto y dos botones;
**md (560)** para formularios y fichas rápidas; **lg (800)** cuando hay tabla, semana o
comparativa que necesita anchura, repartiendo el contenido en dos columnas.

Comportamiento obligatorio en todos: cierre con `Escape`, cierre al hacer clic en el
fondo (`e.target === dialog`), foco al botón de cerrar al abrir y **devolución del foco**
al elemento que lo abrió al cerrar. La cabecera y el pie quedan fijos; solo el cuerpo hace
scroll. El pie explica en `.sum` por qué el primario está deshabilitado en vez de dejar al
usuario adivinándolo.

---

## 8. Patrones de interacción

**Estado sucio.** En pantallas de edición (configuración, ficha médica), cualquier cambio
marca la pantalla como sucia, aparece una barra de guardado pegajosa y se avisa con
`beforeunload`. Guardar lanza un toast; nada se guarda solo.

**Rol.** El rol no duplica pantallas: recorta. La nutricionista no ve el filtro de
profesionales, ni el desglose por profesional, ni la configuración del centro; en su lugar
ve una nota breve que explica por qué, no un hueco vacío.

**Periodos en curso.** Cuando se compara un periodo con el anterior, el periodo en curso se
pondera por los días transcurridos y **el periodo anterior se corta a la misma altura del
calendario**. La interfaz lo dice con palabras ("en curso", "comparado con el mismo tramo
de agosto"). Nunca se compara un mes a medias contra un mes entero.

**Un único punto de entrada para crear.** Nada de dos botones que abren lo mismo con
matices. Si hay variantes (cita o bloqueo de agenda), son un selector dentro del propio
diálogo.

**Vacíos.** Todo listado tiene estado vacío con título, una frase y una acción. "Sin
resultados" a secas no vale.

**Cifras con significado.** Traduce el dato a consecuencia operativa: "12 citas perdidas
equivalen a 430 € de agenda sin cubrir" dice más que "tasa de asistencia 88,7 %".

---

## 9. Accesibilidad mínima

No es opcional y se revisa en cada pantalla: `aria-pressed` en los conmutadores,
`aria-current` en navegación y subnavegación, `aria-sort` en columnas ordenables,
`aria-expanded` en menús, `role="dialog"` + `aria-modal` + `aria-labelledby` en diálogos,
navegación con flechas en pestañas, `:focus-visible` siempre visible, contraste de texto
mínimo 4,5:1 y respeto a `prefers-reduced-motion`. El color nunca es el único portador de
información: siempre va acompañado de texto o forma.

---

## 10. Voz y tono de los textos

Frases cortas, en segunda persona, sin jerga de producto ni entusiasmo impostado. La
interfaz explica consecuencias, no celebra.

Sirve: "Se solapa con otra cita tuya. Elige otra hora o acorta la duración." · "Nadie podrá
reservar en esa franja desde el portal del paciente." · "El último periodo está en curso,
por eso la barra es más corta."

No sirve: "¡Ups! Algo salió mal" · "¡Buen trabajo! 🎉" · "Error 422" · "¿Seguro que quieres
continuar?" sin decir qué pasa si continúas.

---

## 11. Checklist antes de dar una pantalla por buena

Un solo botón primario. Cero kcal. Los permisos de rol se cumplen también en la interfaz,
no solo en el dato. Todos los estados existen: normal, vacío, cargando si aplica, error y
sin permiso. Las cifras usan tabular-nums y formato español. Los diálogos cierran con
Escape, con clic fuera y devuelven el foco. Hay `aria-*` en todo control con estado. La
pantalla se deja usar a 1180 px de ancho. El JS pasa `node --check`. No quedan ids
duplicados ni referencias a ids inexistentes. Y el archivo abre bien con doble clic.

---

## 12. Plantilla de encargo para una IA

> Diseña la pantalla **[nombre]** de un SaaS para clínicas de nutrición, siguiendo la guía
> de diseño adjunta al pie de la letra: mismos tokens, misma barra lateral, mismos
> componentes, diálogos centrados con sus tallas y las reglas de producto (sin kcal,
> permisos por rol, tono no moralizante).
> Entrega **un único archivo HTML autocontenido**, JS en ES5 dentro de una IIFE, datos
> ficticios deterministas y en español.
> La pantalla sirve para **[objetivo en una frase]**. El usuario llega desde **[origen]** y
> tiene que poder **[acciones principales]**. El administrador además ve **[alcance extra]**.
> Antes de escribir código, dime en tres líneas qué vas a mostrar primero, qué dejas en
> segundo plano y qué dejas fuera.

Esa última línea importa: obliga a decidir la jerarquía antes de maquetar, que es donde se
pierden casi todas las pantallas.
