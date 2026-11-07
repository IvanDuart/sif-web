# Asistente — `reachableForms` ahora dice qué escritura cubre cada formulario

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** [`assistant-frontend.md`](assistant-frontend.md) §3.2,
> `pageContext.reachableForms` y la regla de `preferClientTools`.
> **Estado:** el frontend ya lo manda. Falta que el prompt lo use.
> **Fecha:** 2026-11-08.

---

## 1. El problema, con el caso real

La regla de preferir el formulario **funciona para las mediciones y no para las citas**.
Probado desde el panel principal y desde la agenda:

| Petición | Qué hace | Pasos de cliente |
|---|---|---|
| «apunta 70 kg a Homer» | navega a su ficha, abre el diálogo y rellena ✅ | 5 |
| «reagenda la cita de Homer al martes a las 18h» | tarjeta de ACCIÓN PENDIENTE ❌ | **1** |

Un solo paso significa que **ni lo intenta**: no busca al paciente, no navega, no mira el
formulario. Va directo a `reschedule_appointment`.

## 2. Por qué, creemos

Mirad los nombres:

| Formulario | Tool de servidor | ¿Se parecen? |
|---|---|---|
| `measurement` | `create_measurement` | **sí**, comparten la palabra |
| `appointment` | `reschedule_appointment` | sí |
| `appointment` | **`reschedule_appointment`** para «reagendar» | el verbo no aparece en el id del formulario |

Para la medición, el modelo puede atar «voy a llamar a `create_measurement`» con «hay un
formulario que se llama `measurement`». Para reagendar tiene que saber que *reagendar* se
hace en el formulario *de citas*, y eso no está escrito en ninguna parte: se lo estábamos
dejando a su intuición.

## 3. Lo que ya mandamos

`reachableForms` lleva desde hoy un campo `tools`: **las escrituras de servidor que ese
formulario cubre**. No es una tabla nueva que haya que mantener; sale de lo que cada
formulario ya declaraba en el frontend.

```json
"reachableForms": [
  {
    "id": "appointment",
    "screen": "PATIENT_PROFILE",
    "needsPatient": true,
    "tools": ["create_appointment", "reschedule_appointment"]
  },
  {
    "id": "measurement",
    "screen": "PATIENT_MEASUREMENTS",
    "needsPatient": true,
    "tools": ["create_measurement", "update_measurement"]
  },
  {
    "id": "template",
    "screen": "TEMPLATES",
    "needsPatient": false,
    "tools": []
  }
]
```

- `tools` **vacío** significa que **no hay tool de servidor** para eso y el formulario es el
  único camino. Hoy pasa con las plantillas de menú y con las comidas de una plantilla: el
  catálogo tiene `get_menu_templates` y `create_menu_from_template`, pero nada que cree la
  plantilla ni que le añada comidas.

## 4. Qué pedimos

Que la regla del prompt deje de depender de que los nombres se parezcan:

> Antes de llamar a una tool de escritura, mira si su nombre aparece en el `tools` de algún
> formulario de `reachableForms`. Si aparece, usa el formulario: navega a su `screen`
> (resolviendo antes el paciente si `needsPatient`), ábrelo con `open_<id>`, rellénalo con
> `fill_<id>` y termina con `save_<id>`. La tool de servidor queda para cuando no aparece en
> ningún `tools`, o para cuando llegar al formulario ha fallado.

Es la misma regla que ya tenéis, pero con una comprobación exacta en lugar de un parecido.

## 5. Esto también desbloquea la opción B, si la queréis

Cuando descartasteis esconder la tool de servidor, uno de los dos motivos era mantener una
tabla de equivalencias que se queda vieja en silencio. **Ya no hace falta: la tabla os la
mandamos nosotros en cada turno**, y sale de lo que el formulario declara, así que no puede
desfasarse.

El otro motivo sigue en pie y nos parece bueno: esconderla deja al modelo sin salida cuando
la cadena falla. Así que seguimos prefiriendo la regla en el prompt; lo decimos sólo para que
conste que el argumento de la tabla ya no aplica.

## 6. Cómo sabremos que está

«Reagenda la cita de Homer al martes a las 18h» desde el panel principal: busca al paciente,
navega a su ficha, pulsa Reagendar, rellena fecha y hora y espera en el Guardar. Hoy son
cero pasos de cliente y una tarjeta.
