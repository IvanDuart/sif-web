# Asistente — que el modelo prefiera el formulario antes que escribir él

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** [`assistant-frontend.md`](assistant-frontend.md) §3.2 (herramientas de
> cliente) y §7 (catálogo de tools de servidor).
> **Estado: CERRADA (2026-11-07).** El backend implementó la **opción A** (regla en el prompt)
> más el interruptor de la **C** (`preferClientTools`, ausente = activado), y descartó la **B**
> con un argumento mejor que el nuestro: esconder la tool de servidor deja al modelo sin salida
> justo cuando la cadena falla. El frontend ya manda `pageContext.reachableForms`.
> **Fecha:** 2026-11-07.

---

## 1. Qué pasa

Le pides a la mascota «reagenda la cita de Homer al martes a las 17:00» y, en vez de abrir
el formulario y rellenarlo delante de ti, te sale una tarjeta de **ACCIÓN PENDIENTE** con un
resumen y un botón de Guardar.

Funciona, pero no es lo que queremos. Con la tarjeta, la persona confirma **un resumen**. Con
el formulario, ve **el formulario**: los campos que no ha tocado, los que el centro tiene por
obligatorios, el solape con otra cita, el aviso de que ese día está cerrado. Es la diferencia
entre revisar un recibo y revisar el carro.

## 2. Por qué pasa

El modelo tiene **dos caminos para lo mismo** y elige el más corto:

| Lo que quiere hacer | Tool de servidor (§7) | Herramientas de cliente (§3.2) |
|---|---|---|
| Reagendar una cita | `reschedule_appointment` | `open_appointment` + `fill_appointment` + `save_appointment` |
| Crear una cita | `create_appointment` | ídem |
| Apuntar una medición | `create_measurement` | `open_measurement` + `fill_measurement` + `save_measurement` |
| Cambiar el horario | `update_schedule` | `fill_schedule` + `save_schedule` |

La de servidor es **una llamada**; la de cliente son tres y depende de lo que haya en
pantalla. Cualquier modelo elige la primera, y hace bien: nadie le ha dicho que preferimos
la otra.

## 3. Si el formulario no está en pantalla, hay que ir a buscarlo

Esto es lo importante, y es lo que diferencia esta petición de «usa `fill_` cuando puedas».

**Que el formulario no esté delante no es motivo para escribir por detrás.** Si estoy en el
panel principal y pido «apunta 70 kg a Homer Simpson», la cadena correcta es:

```text
1. search_patients("Homer Simpson")        (servidor)  → id del paciente
2. navigate(PATIENT_MEASUREMENTS, {patientId})  (cliente) → va a su ficha, pestaña Mediciones
                                                          ← devuelve el catálogo de esa pantalla
3. open_measurement()                      (cliente)  → pulsa «Registrar medición»
                                                          ← devuelve el catálogo con fill_ y save_
4. fill_measurement({weightKg: 70})        (cliente)  → escribe, y dice qué entró y qué no
5. save_measurement()                      (cliente)  → pregunta, y guarda si hay un sí
```

Son cinco pasos donde `create_measurement` es uno. Por eso el modelo no la va a elegir solo:
hay que decírselo.

### Esto ya funciona por nuestro lado

No pedimos nada que no esté. El frontend ya declara, en cada turno y según la pantalla:

- `navigate` con la lista cerrada de pantallas, incluidas `PATIENT_MEASUREMENTS`,
  `PATIENT_PROFILE`, `PATIENT_MENU`, `PATIENT_APPOINTMENTS` y las secciones de Ajustes.
  Devuelve el catálogo de la pantalla nueva, para que el modelo no gaste un paso en
  preguntarlo.
- **Once** `open_<id>`: medición, cita, estado clínico, asignar nutricionista, evento de
  paciente, plantilla de menú, perfil del centro, tipo de cita, horario, asignación de
  horario y festivo.
- Sus `fill_<id>` y `save_<id>` correspondientes.

Lo único que necesita el paso 2 es el **id del paciente**, que el modelo ya puede sacar de
`search_patients` o de `set_active_patient`.

## 4. Qué pedimos

### Lo primero: que el modelo sepa que el formulario existe aunque no lo vea

Hay un agujero en el contrato actual, y es la raíz del problema. Hoy sólo mandamos las
herramientas de **esta** pantalla. Estando en el panel principal, `fill_measurement` no
viaja, así que desde donde el modelo mira **la medición no tiene formulario**: la única
manera que conoce de apuntar un peso es `create_measurement`. No está eligiendo mal; está
eligiendo con lo que le hemos dado.

Lo arreglamos nosotros, y es barato: añadimos al `pageContext` la lista de los formularios
que la aplicación tiene y en qué pantalla viven.

```json
{
  "route": "/dashboard",
  "forms": [],
  "reachableForms": [
    { "id": "measurement", "screen": "PATIENT_MEASUREMENTS", "needsPatient": true },
    { "id": "appointment", "screen": "PATIENT_APPOINTMENTS", "needsPatient": true },
    { "id": "schedule",    "screen": "SETTINGS_SCHEDULES",   "needsPatient": false }
  ]
}
```

Son unos 600 bytes con los quince formularios, muy por debajo del presupuesto de contexto.
**Decidnos si lo queréis ahí o en otro sitio** y lo mandamos; es un cambio de un rato.

Con eso delante, el modelo puede razonar «la medición se rellena en
`PATIENT_MEASUREMENTS`, voy allí». Sin eso, ninguna de las opciones de abajo funciona fuera
de la pantalla correcta.

### Y después, una de estas tres

Están de menor a mayor esfuerzo.

#### Opción A — una línea en el prompt *(la que recomendamos para empezar)*

> Para escribir algo, mira primero si hay un `fill_<x>` para ello entre las herramientas del
> navegador: si lo hay, úsalo con `save_<x>`. Si no lo hay pero el formulario aparece en
> `reachableForms`, ve primero con `navigate` a su pantalla, ábrelo con `open_<x>` y
> entonces rellénalo. La persona prefiere ver el formulario. Usa la tool de escritura de
> servidor sólo si ese formulario no existe, o si llegar hasta él ha fallado.

Barato y reversible, y es lo que probaríamos primero.

#### Opción B — que el backend esconda su tool cuando hay formulario para eso

Con una tabla `measurement → {create_measurement, update_measurement}`, el backend **no
declara** la tool de servidor cuando ese formulario está en `clientTools` **o en
`reachableForms`**. Así el modelo no tiene que elegir: sólo le queda el camino bueno.

Ojo: mirando sólo `clientTools` esto no sirve, porque en el panel principal no hay ningún
`fill_` que esconder. Por eso `reachableForms` va antes que esto.

Es lo más robusto, pero obliga a mantener la tabla de equivalencias.

#### Opción C — un interruptor para que lo probemos nosotros

```json
{ "content": "...", "clientTools": [...], "preferClientTools": true }
```

Que el backend aplique la A o la B según ese campo. Nos deja probarlo con usuarios reales y
apagarlo sin desplegar backend si sale mal. Combinable con cualquiera de las dos.

## 5. Lo que NO pedimos

- **No** quitéis las tools de escritura de servidor. Siguen haciendo falta:
  - por el endpoint **bloqueante**, que no tiene herramientas de cliente;
  - cuando de verdad **no hay formulario** para eso (`import_holidays`,
    `create_menu_from_description`, `generate_shopping_list`…);
  - y como salida cuando la cadena de arriba falla —el paciente no se encuentra, la pantalla
    no monta, la persona dice que no—. Entonces la tarjeta de ACCIÓN PENDIENTE es la
    respuesta correcta, no la primera opción.
- **No** cambiéis `confirm_action`: está bien como está y la pintamos ya.

## 6. Cómo sabremos que está

Dos pruebas, una fácil y otra que es la que importa:

1. **Con el formulario delante.** En la agenda, «reagenda la cita de Homer al martes a las
   17:00» abre el diálogo de la cita, se ve a la mascota rellenar los campos, y el sí se da
   en el Guardar del propio formulario.
2. **Sin el formulario delante.** En el panel principal, «apunta 70 kg a Homer Simpson»
   **navega a su ficha**, abre el diálogo de medición y lo rellena. Hoy esto contesta con una
   tarjeta de ACCIÓN PENDIENTE sin moverse de sitio, y es justo lo que queremos cambiar.
