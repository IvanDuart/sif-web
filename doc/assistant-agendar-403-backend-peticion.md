# Agendar por NutrIA da 403 aunque el paciente sea tuyo

> **Estado:** petición al backend. Reproducido el 2026-11-01 contra
> `localhost:8081`, tenant `00000000-0000-0000-0000-000000000001`.

## 1. El síntoma

Con el asistente abierto **desde el panel principal**, el usuario pide "quiero
agendar a Frank Grimes para el día 5 a las 10". NutrIA encuentra al paciente,
mira su agenda y propone el hueco:

> He encontrado hueco para Frank Grimes el día 5 de noviembre. La cita de
> seguimiento (20 min) encaja perfectamente a las 10:00. ¿Te parece bien que la
> agende de 10:00 a 10:20?

Se contesta que sí y el turno muere con **403 `error.permission_denied`**
(`"Permiso denegado"`). Pasa **también al usuario admin, que es el
nutricionista asignado de ese paciente**, así que no es un problema de a quién
pertenece la ficha.

## 2. Qué se ha descartado

| Comprobación | Resultado |
|---|---|
| ¿Falta algún permiso? | No. El actor tiene `MANAGE_APPOINTMENTS`, `VIEW_USER`, `VIEW_PATIENT_PROFILE`, `MANAGE_PATIENT_PROFILE`. |
| ¿Es el alcance por asignación? | No. Falla igual con admin, asignado de Frank Grimes. |
| ¿Las tools de lectura leen fuera de alcance? | No. Como `nelson@` —que no tiene a Frank asignado— NutrIA responde *«No he encontrado a ningún paciente llamado "Frank Grimes"»*. La lectura filtra bien. |
| ¿Es el proveedor de IA? | No. Ese fallo sale como `503 error.assistant_unavailable`, distinto y bien etiquetado. |

## 3. La hipótesis, que es vuestra propia mina documentada

Lo que queda en pie es lo que ya avisa
[`assistant-tools-backend.md`](assistant-tools-backend.md) §5. En
`AssistantActionService.confirm()`:

```java
patientScope.requireVisible(tenantId, actor.getId(), action.getSubjectUserId());
```

y en `AssistantPatientScope.canView()`:

```java
if (patientId == null) {
    return false;
}
```

**Abriendo el asistente desde el panel principal la sesión nace sin paciente
activo** (`POST /sessions` con `subjectUserId: null`, que es lo que manda el
frontend cuando no hay ficha en pantalla). Si al preparar la cita la acción no
hereda el paciente que el modelo acaba de resolver por su nombre, ese guardia
recibe `null`, y `canView(null)` deniega **aunque el paciente sea del actor**.
Encaja con todo: con que falle desde el panel principal, con que falle siendo
admin, y con que el mensaje sea exactamente el `"Permiso denegado"` del scope.

### La prueba que lo confirma o lo tumba

Repetir lo mismo como admin pero **abriendo el asistente desde la ficha de
Frank Grimes**. Ahí la sesión sí nace con `subjectUserId`, y:

- si la cita se crea → confirmado: el fallo es el `subjectUserId` nulo de la acción;
- si vuelve a dar 403 → el guardia que deniega es otro y hay que mirar el
  aplicador de `create_appointment`.

## 4. Lo que pedimos

1. **Que el guardia mire el paciente de la acción, no el de la sesión.** La
   propuesta de cita ya lleva `patientId` en su `preview` (§1 del contrato del
   frontend): es ese el paciente cuyo acceso hay que comprobar. Alternativa
   equivalente: rellenar `subjectUserId` de la acción al prepararla, con el
   paciente que la tool resolvió.
2. **Que un `null` donde se esperaba un paciente no se cuente como "no tienes
   permiso".** Si una tool de paciente llega sin paciente, eso es un fallo del
   armado de la acción, y merece su propio código (`error.assistant_no_subject`
   o similar) en vez de disfrazarse de 403 de permisos. Un "Permiso denegado"
   manda a buscar el problema al sitio equivocado —a nosotros nos costó una
   tarde.

## 5. Aparte: "asignado" y "visible" no son lo mismo

Buscando esto salió otra incoherencia, menor pero real. El contrato
([`assistant-frontend.md`](assistant-frontend.md) §2) dice que `subjectUserId`
ha de ser *«un paciente **visible** para el nutricionista»*, pero el código
exige que esté **asignado**. Como `nelson@`, sobre Frank Grimes:

| | |
|---|---|
| `GET /tenant/{t}/users/5181dbfa-…` | **200** |
| `GET /tenant/{t}/users/5181dbfa-…/profile` | **200** |
| `GET /tenant/{t}/users/by-type/PATIENT` (el buscador del formulario de citas) | **200**, y Frank sale en la lista |
| `POST /tenant/{t}/assistant/sessions` con ese `subjectUserId` | **403** `error.permission_denied` |

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"subjectUserId":"5181dbfa-15a8-4887-bf3e-a4606fc2e327","screen":"PATIENT_PROFILE"}' \
  http://localhost:8081/api/tenant/00000000-0000-0000-0000-000000000001/assistant/sessions
# {"detail":"Permiso denegado","status":403,"code":"error.permission_denied"}
```

O sea: un nutricionista puede abrir esa ficha y agendarle una cita con el ratón,
pero el asistente no le deja ni empezar. Hay que decidir cuál de las dos manda —
nuestro voto es que el asistente no sea más estricto que el formulario que
imita— y dejarlo escrito en §2 del contrato, diga lo que diga.

## 6. Mientras tanto, en el frontend

El evento `error` del stream traía `"Permiso denegado"` y el panel lo pintaba
tal cual, mientras el camino bloqueante sí traducía por código. Ya no: el
**código manda sobre el `detail`** en los dos caminos. No arregla el fondo —el
turno sigue muriendo—, sólo deja de repetir un mensaje que no dice nada.
