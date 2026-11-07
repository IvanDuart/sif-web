# Asistente — las superficies que el contrato da por ausentes ya existen

> **Quién lo dice:** frontend (sif-web).
> **Contra qué:** [`assistant-frontend.md`](assistant-frontend.md) §9, «Lo que falta en `sif-web`».
> **Gravedad:** baja, pero afecta a lo que el modelo cree que puede hacer.
> **Fecha:** 2026-11-07.

---

El §9 del contrato dice que estas tools «caen en la tarjeta de confirmar hasta que exista su
superficie de relleno». **Las siete existen desde hace varias entregas**, con su formulario,
su `open_<id>` y su `save_<id>`:

| Tool del backend | Formulario | Se puede abrir | Se puede guardar |
|---|---|---|---|
| `update_tenant_profile` | `tenant_profile` | sí | **no** (lleva precios y datos fiscales) |
| `create_appointment_type` / `update_appointment_type` | `appointment_type` | sí | **no** (lleva el precio de la consulta) |
| `update_clinical_status` | `clinical_status` | sí | **no** (incluye dar de baja) |
| `create_patient_event` | `patient_event` | sí | sí |
| `assign_nutritionist` | `assign_nutritionist` | sí | sí |
| `create_calendar_note` | `calendar_note` | sí | sí |
| `update_meal` | `meal` | sí | sí |

Los tres «no» son **deliberados**: esos formularios llevan `noSave`, así que la mascota los
rellena y **guarda la persona**. Lo que toca dinero o da de baja a alguien no lo pulsa ella
ni con un sí. La tarjeta de confirmar sigue siendo la respuesta correcta ahí.

Todos viajan ya en `pageContext.reachableForms`, así que el modelo puede ir a buscarlos.

**Añadida además (2026-11-07) la que sí faltaba:** `template`, la plantilla de menú del centro
(`/templates`). No la teníamos, y por eso pedir «créame una plantilla» sólo conseguía que la
mascota explicara cómo hacerlo. Ahora se rellena y se guarda como cualquier otra. Ojo: no hay
tool de servidor equivalente —el catálogo tiene `get_menu_templates` y
`create_menu_from_template`, pero ninguna que cree la plantilla—, así que **este formulario es
el único camino**. Va con la pantalla `TEMPLATES`, nueva en `reachableForms`.

**Qué pedimos:** sólo que actualicéis ese párrafo del §9 cuando toquéis el documento, para
que no induzca a pensar que hay que resolverlo por la tarjeta. Nada más.
