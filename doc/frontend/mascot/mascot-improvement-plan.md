# Plan de mejoras del sistema de mascota (sif-web)

> **Fecha:** análisis realizado en noviembre de 2026  
> **Fuentes:** `src/app/features/assistant/*` (sif-web) y `src/core/copilot/mascot/*` (alkimia-app)  
> **Alcance:** comparativa funcional y propuesta priorizada de mejoras de producto para la mascota conversacional de sif-web.

---

## 1. Resumen ejecutivo

La mascota de **sif-web** ya es un asistente conversacional funcional con un avatar procedural, vida propia, panel de chat, rellenado de formularios y personalización por tenant. Sin embargo, respecto a la versión más madura de **alkimia-app**, le faltan capas de **personalidad, proactividad, descubrimiento y encanto** que convierten a la mascota de "herramienta" en "personaje".

El plan propone:

1. **Quick wins (1–2 sprints):** ampliar el catálogo de skins, añadir el modo "héroe", notas proactivas de ayuda y celebración de logros.
2. **Medio plazo (2–4 sprints):** sistema de tips contextuales, detección de usuario atascado en formularios, mejoras en la barra/posicionamiento y easter eggs.
3. **Largo plazo / ambiciosas:** seguimiento entre pantallas, integración con eventos de plataforma y posible migración parcial hacia un modelo de "copiloto persistente" tipo barra inferior.

El enfoque es **adaptar, no copiar**: alkimia-app es una plataforma genérica de gestión; sif-web es una clínica de fisioterapia/nutrición, por lo que la proactividad debe ser más conservadora y centrada en el flujo clínico.

---

## 2. Estado actual en sif-web

### 2.1 Arquitectura

| Capa | Archivos clave | Descripción |
|------|----------------|-------------|
| Estado global | `mascot-state.service.ts` | Sesión, mensajes, acciones pendientes, consentimiento, config del tenant, streaming. |
| Vida propia | `mascot-life.service.ts`, `lifeDetectors.ts` | Gestos autónomos: mirar, girar, marearse, sonrojarse, enfurecerse, teléfono, dormirse. |
| Estado emocional | `mascot-mood.service.ts` | Moods `worried`, `cheer`, `highfive`, `welcome`, `proud` y condiciones `offline`, `tired`. |
| Look | `mascot-look.service.ts`, `skins/*` | 4 skins procedurales (`manzana`, `naranja`, `pina`, `melon`) y 1 accesorio (`orejas`). |
| Render | `mascot-orb.ts` | SVG procedural con morphing entre skins, animaciones por escena y ojos reactivos. |
| UI | `mascot-panel.ts`, `mascot-launcher.ts`, `mascot-wardrobe.ts` | FAB en esquina, panel modal de chat y armario de skins. |
| Relleno de formularios | `mascot/fill/*` | Sistema avanzado: la mascota navega a la pantalla, abre diálogos y rellena campos. |
| i18n | `assets/i18n/{es,en}.json` | Textos traducidos. |

### 2.2 Fortalezas actuales

- **Rellenado de formularios (fill)** es más completo que en muchos productos: soporta navegación a pantalla, apertura de diálogos, campos repetibles y validación de contrato (`warnPreviewDrift`).
- **Streaming** de respuestas del asistente implementado con fallback bloqueante.
- **Consentimiento por sesión** y control de permisos por rol (solo nutricionistas/administradores ven la mascota).
- **Wardrobe** con animación de puertas y vista previa del look.
- **Vida propia** bien implementada: la mascota no es estática.

### 2.3 Debilidades actuales

- Catálogo de **skins muy reducido** (4 frutas) y sin personalidad diferenciada.
- Solo **un accesorio**.
- No hay **tips proactivos** basados en lo que el usuario hace manualmente.
- No detecta si el usuario está **atascado en un formulario**.
- No celebra **logros** ni eventos de plataforma.
- No hay **easter eggs** ni secretos descubribles.
- El panel de chat es **modal y separado** del flujo de trabajo; no hay barra persistente.
- La mascota no **sigue al usuario** al navegar entre secciones.
- No hay modo "superhéroe" ni efectos visuales especiales.
- No hay **drag & drop** de archivos sobre la mascota.

---

## 3. Benchmark: alkimia-app

### 3.1 Arquitectura

| Capa | Archivos clave | Descripción |
|------|----------------|-------------|
| Estado global | `mascotStore.ts` | Zustand: working, paused, confirm, choice, queued, interrupt, wardrobe, pigeon, bar geometry. |
| Vida propia | `useMascotLife.ts` | Equivalente a sif-web, como hook de React. |
| Estado emocional | `mascotMood.ts` | Mismos moods + notas con acciones. |
| Look | `skins/*` | 6 skins con variables CSS, personalidades y héroes. |
| Render | `MascotOrb.tsx`, `AgentFace.tsx`, `AgentBody.tsx` | Componentes React con skins basadas en CSS vars y SVG. |
| UI | `CopilotMascot.tsx`, `MascotBar.tsx`, `MascotSpeech.tsx` | Mascota fija en esquina + barra persistente de copiloto. |
| Proactividad | `mascotTips.ts`, `useStuckFormOffer.ts`, `useMascotSignals.ts` | Tips contextuales, oferta de ayuda en formularios atascados y reacción a eventos de plataforma. |
| Encanto | `mascotHero.ts`, `MascotPigeon.tsx`, `mascotConsole.ts` | Modo héroe, paloma easter egg, comandos de consola. |
| Movimiento | `mascotFollow.ts`, `placement.ts` | Sigue al usuario entre secciones y apps. |

### 3.2 Fortalezas de alkimia-app

- **6 skins** con personalidades visuales diferenciadas (orbe, estrella, flor, gato, nube, sol).
- **Modo héroe**: seleccionando una "A" mayúscula y pulsando la mascota, se transforma en superhéroe con efectos de poder.
- **Paloma easter egg** (`neki.paloma()` desde consola).
- **Sistema de tips**: detecta acciones manuales repetitivas y ofrece hacerlo por el usuario.
- **Stuck form offer**: detecta inactividad en formularios con errores y ofrece ayuda.
- **MascotBar**: barra inferior persistente con cola de mensajes, modo tray y entrada de texto siempre disponible.
- **Seguimiento entre secciones/apps**: la mascota mira, salta y empuja la barra de carga al cambiar de app.
- **Eventos de plataforma**: reacciona a éxitos, fallos, logros y trabajos en segundo plano.
- **Drag & drop** de archivos sobre la mascota.

### 3.3 Debilidades de alkimia-app (para no copiar ciegamente)

- Arquitectura más compleja y acoplada a Zustand + React.
- La barra persistente puede ser intrusiva en un flujo clínico donde el profesional necesita concentración.
- Algunos easter eggs (paloma, héroe) pueden no encajar con la seriedad de una clínica.

---

## 4. Matriz comparativa

| Capacidad | sif-web | alkimia-app | Prioridad de cerrar brecha |
|-----------|:-------:|:-----------:|:--------------------------:|
| Panel de chat | Modal | Barra persistente + modal | Media |
| Skins procedurales | 4 | 6 | Alta |
| Accesorios | 1 | 1 | Media |
| Personalidad por skin | No | Sí (blush/angry diferente) | Alta |
| Modo héroe / poderes | No | Sí | Media |
| Vida propia (peek, spin, etc.) | Sí | Sí | Igualado |
| Moods (cheer, worried...) | Sí | Sí | Igualado |
| Notas con acciones | Básicas | Con botones | Alta |
| Tips proactivos | No | Sí | Alta |
| Detección formulario atascado | No | Sí | Alta |
| Celebración de logros | No | Sí | Media |
| Easter eggs (paloma, héroe) | No | Sí | Baja/Media |
| Seguimiento entre pantallas | No | Sí | Media |
| Drag & drop de archivos | No | Sí | Media |
| Relleno de formularios | Avanzado | Avanzado | Igualado |
| Streaming | Sí | Sí | Igualado |
| Consentimiento | Sí | (no aplica igual) | Igualado |
| i18n | Sí | Sí | Igualado |

---

## 5. Brechas priorizadas

### 5.1 Alta prioridad (impacto usuario + esfuerzo razonable)

1. **Ampliar catálogo de skins y darles personalidad**
   - Pasar de 4 a 6–8 skins.
   - Que cada skin tenga reacciones visuales diferenciadas en `blush`/`angry`.
   - Mejorar la paleta para que encaje con la identidad clínica/marca blanca.

2. **Notas con acciones**
   - Las notas actuales (`mascot-note`) solo muestran texto y cerrar.
   - Añadir botones de acción: "Pruébalo", "Ayúdame", "No me lo vuelvas a decir".

3. **Tips proactivos conservadores**
   - Detectar cuando el nutricionista crea manualmente citas, menús o mediciones.
   - Ofrecer: "¿Quieres que lo haga por ti la próxima vez?".
   - Respetar frecuencia (máx. 1 cada 2–3 min), contador por usuario y silencio tras uso del copiloto.

4. **Detección de usuario atascado en formularios**
   - Si el foco está en un formulario con campos inválidos y no hay actividad durante ~20 s, ofrecer ayuda.
   - Opción "No me lo vuelvas a decir" guardada en `localStorage`.

### 5.2 Media prioridad (impacto alto, esfuerzo moderado)

5. **Celebración de logros**
   - Eventos de plataforma: primera cita completada, primer menú generado, primera medición, etc.
   - La mascota celebra con `cheer` y una nota.
   - Guardar qué logros ya se celebraron por persona en `localStorage`.

6. **Modo héroe / superpoderes**
   - Añadir un easter egg discreto (por ejemplo, pulsar la mascota con una "A" seleccionada).
   - Cada skin tiene un disfraz y un efecto visual de poder.
   - Debe ser opcional y no romper la seriedad del producto.

7. **Mejorar el posicionamiento y la barra de copiloto**
   - Evaluar una barra inferior persistente (tipo alkimia) o un modo "compacto" del panel actual.
   - Que la mascota se posicione junto al campo que está rellenando sin tapar botones clave.

8. **Drag & drop de archivos**
   - Permitir arrastrar un PDF o imagen sobre la mascota para adjuntarlo al chat.
   - Útil para informes, analíticas o fotos de composición corporal.

### 5.3 Baja prioridad / ambiciosas (alto esfuerzo o riesgo de intrusividad)

9. **Seguimiento entre pantallas**
   - La mascota mira el menú seleccionado y salta de alegría al cambiar de sección.
   - En sif-web es menos relevante porque no hay cambio de "app", solo rutas dentro de la SPA.

10. **Sistema de eventos de plataforma unificado**
    - Extender `mascot-mood.service.ts` para reaccionar a eventos globales (éxito, fallo, logro, trabajo en segundo plano).
    - Requiere un bus de eventos en Angular.

11. **Paloma u otro easter egg visual**
    - Añadir un easter egg divertido pero controlado (comando de consola o combinación de teclas).
    - Evaluar si encaja con la imagen de marca clínica.

---

## 6. Plan de implementación

### Fase 1 — Fundamentos de personalidad (1 sprint)

- [ ] Ampliar `skins/types.ts` con 2–4 nuevos IDs (`frutilla`, `coco`, `arándano`, etc. o nombres alineados a marca).
- [ ] Implementar outlines/faces para las nuevas skins en `skins/outlines.ts` y `skins/faces.ts`.
- [ ] Añadir reacciones diferenciadas por skin en `blush`/`angry` (equivalente a `personalities.tsx` de alkimia).
- [ ] Actualizar `mascot-wardrobe.ts` para mostrar nuevas skins.
- [ ] Añadir claves i18n para nombres y descripciones.

### Fase 2 — Notas y proactividad (1–2 sprints)

- [ ] Extender `MascotNote` para soportar `actions: { label, run }`.
- [ ] Rediseñar `mascot-note` en `mascot-launcher.ts` para mostrar botones.
- [ ] Implementar `mascot-tips.service.ts`:
  - Catálogo de tips por contexto (citas, menús, mediciones).
  - Frecuencia, contador por persona y opt-out.
  - Integración con acciones manuales detectadas en cada feature.
- [ ] Implementar `stuck-form-offer.service.ts`:
  - Escuchar inactividad en formularios con errores.
  - Ofrecer ayuda mediante nota con acción.
  - Opt-out por persona.

### Fase 3 — Logros y encanto (1 sprint)

- [ ] Definir catálogo de logros clínicos relevantes (primera cita, primer menú, etc.).
- [ ] Implementar `mascot-achievements.service.ts` con persistencia en `localStorage` por persona.
- [ ] Emitir eventos de logro desde las features correspondientes.
- [ ] Implementar modo héroe básico:
  - `mascot-hero.service.ts` con toggle y persistencia.
  - Dibujar disfraces y efectos para al menos 2 skins.
  - Activador discreto (ej. seleccionar "A" + click en mascota).

### Fase 4 — Barra y posicionamiento (2 sprints)

- [ ] Evaluar prototipo de `MascotBar` persistente inferior vs. panel modal mejorado.
  - Criterio: no interrumpir flujo clínico.
- [ ] Implementar cola de mensajes y modo "tray" para textos largos.
- [ ] Mejorar posicionamiento de la mascota al rellenar formularios:
  - Evitar tapar botones de guardar/cancelar.
  - Añadir marca visual (`data-mascot-focus`) sobre el campo activo.

### Fase 5 — Integraciones avanzadas (2+ sprints)

- [ ] Drag & drop de archivos sobre la mascota.
- [ ] Seguimiento entre secciones (bajo relevancia para sif-web).
- [ ] Bus de eventos de plataforma para moods reactivos.

---

## 7. Recomendaciones de diseño y arquitectura

### 7.1 Mantener la arquitectura de signals de Angular

- sif-web usa signals en todo el estado; no migrar a Zustand.
- Los nuevos servicios deben seguir el patrón `signal()`/`computed()`/`effect()`.

### 7.2 Separar proactividad de intrusividad

- En un entorno clínico, la mascota debe **ayudar sin distraer**.
- Todos los tips y ofertas deben tener:
  - Frecuencia máxima clara.
  - Contador por usuario.
  - Opt-out explícito.
  - No mostrarse durante interacciones críticas (guardando, cargando, etc.).

### 7.3 Aprovechar el fill existente

- El sistema de fill de sif-web ya es sólido; las mejoras deben **encajar sobre él**, no reemplazarlo.
- Ejemplo: el stuck form offer puede usar `askCopilot()` para enviar al asistente un prompt con los campos en error.

### 7.4 i18n desde el primer día

- Todo texto nuevo debe pasar por `assets/i18n/{es,en}.json`.
- No hardcodear textos en componentes.

### 7.5 Tests

- Alkimia-app tiene una batería grande de tests (`*.test.tsx`, `*.test.ts`).
- Para sif-web, añadir tests unitarios al menos para:
  - Lógica de tips (frecuencia, opt-out).
  - Lógica de stuck form offer.
  - Logros (first-time).
  - Nuevas animaciones/scenes.

---

## 8. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| La mascota se vuelva intrusiva en consulta | Frecuencias conservadoras, opt-outs claros, no mostrar tips en modales críticos. |
| Aumento de complejidad visual | Mantener estilo limpio, opciones desactivables por tenant. |
| Inconsistencia con marca clínica | Skins más sobrias, easter eggs opcionales y desactivables. |
| Deuda de tests | Añadir tests junto a cada mejora. |

---

## 9. Conclusión

sif-web ya tiene una **base técnica sólida** para la mascota. El siguiente salto no es reescribir, sino **añadir personalidad, proactividad controlada y momentos de delight**. Las mejoras de alta prioridad (skins, notas con acciones, tips y stuck form offer) pueden entregarse en 2–3 sprints y marcarán una diferencia clara en la percepción de usuario.

La referencia de alkimia-app es valiosa, pero debe **adaptarse al contexto clínico** de sif-web: menos ruido, más utilidad, siempre respetuoso con la concentración del profesional.
