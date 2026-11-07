# Mascota — lo que necesita recordar de cada persona (preferencias e hitos)

> **Quién lo pide:** frontend (sif-web).
> **Contra qué:** [`mascota-frontend.md`](mascota-frontend.md) §4 (look del usuario), que es el precedente de forma: algo del usuario, por centro, que el backend guarda y el frontend lee una vez.
> **De dónde sale:** `mascot-improvement-plan.md` §5.1.3, §5.1.4 y §5.2.5 — tips proactivos, oferta de ayuda en formularios y celebración de logros. Las tres necesitan memoria, y las tres la tienen hoy en `localStorage`, que no da para esto.
> **Fecha:** 2026-11-01.
> **Prioridad:** §2.1 es conveniente; **§2.2 es obligatoria** — sin ella las celebraciones son mentira y no se implementan.

---

## 1. Qué pasa

La mascota va a empezar a hablar sin que le pregunten: ofrecer hacer por ti lo
que acabas de hacer a mano, ofrecer ayuda cuando llevas veinte segundos parado
en un formulario con errores, y celebrar la primera vez que haces algo. Eso
obliga a recordar dos cosas por persona, y ninguna cabe en el navegador.

**Lo que le has dicho que no vuelva a decirte.** Si alguien pulsa "no me lo
vuelvas a decir" y la preferencia vive en `localStorage`, la mascota lo olvida
al cambiar de navegador, al entrar desde la tablet de consulta o al limpiar el
sitio. Una mascota que vuelve a ofrecer lo que ya rechazaste es exactamente la
que acaba desactivada.

**Qué es la primera vez de verdad.** Este es el grave. El plan propone guardar
en `localStorage` qué logros ya se celebraron, pero `localStorage` no sabe si
es tu primera cita: sabe si es la primera que te he visto crear *en este
navegador*. En un centro con dos años de uso, "¡Tu primera cita!" saltaría la
semana que viene, delante de un paciente. Sólo el backend sabe si esa cita es la
primera.

---

## 2. Qué pedimos

### 2.1 Preferencias de la mascota, por usuario y centro

```http
GET /api/tenant/{tenantId}/assistant/preferences
```

```json
{
  "proactiveEnabled": true,
  "silencedTips": ["appointment.create", "menu.generate"],
  "stuckFormOfferEnabled": true,
  "celebrationsEnabled": true,
  "updatedAt": "2026-11-01T10:10:00Z"
}
```

```http
PUT /api/tenant/{tenantId}/assistant/preferences
Content-Type: application/json

{ "proactiveEnabled": true, "silencedTips": ["appointment.create"], "stuckFormOfferEnabled": false, "celebrationsEnabled": true }
```

- Del usuario autenticado y del tenant de la URL, como `/look`. Nadie edita las
  de otro.
- El `PUT` reemplaza el objeto entero y devuelve lo guardado con `updatedAt`
  nuevo, igual que `/look`.
- `silencedTips` son ids opacos que inventa el frontend
  (`<dominio>.<acción>`). **No pedimos que el backend los valide ni los conozca**:
  es una lista de cadenas, máximo ~50, 64 caracteres cada una. Así añadir un tip
  nuevo no necesita tocar backend.
- Si el usuario no tiene preferencias, `GET` devuelve los valores por defecto de
  arriba (todo activado, lista vacía) con `updatedAt: null`, no un 404.
- `proactiveEnabled: false` apaga las tres cosas de golpe. Es el interruptor que
  queremos poder ofrecer en ajustes.

### 2.2 Hitos: que el backend diga cuál es la primera vez

```http
GET /api/tenant/{tenantId}/assistant/milestones
```

```json
[
  { "code": "first_patient",     "reachedAt": "2026-09-02T09:00:00Z", "celebratedAt": "2026-09-02T09:00:05Z" },
  { "code": "first_appointment", "reachedAt": "2026-11-01T10:10:00Z", "celebratedAt": null },
  { "code": "first_menu",        "reachedAt": null,                   "celebratedAt": null }
]
```

```http
POST /api/tenant/{tenantId}/assistant/milestones/{code}/celebrated
```
→ `204`. Idempotente: marcar dos veces no es un error.

La clave está en **quién calcula `reachedAt`**: el backend, desde sus propios
datos, no el frontend avisando. Si lo marcamos nosotros volvemos al problema de
`localStorage` con más pasos.

Los hitos que pedimos, con lo que cuenta cada uno. Todos son **por usuario
dentro del centro**, no por centro: el nutricionista que se incorpora hoy a una
clínica de dos años merece su primera vez.

| `code` | `reachedAt` es la fecha de… |
|---|---|
| `first_patient` | el primer paciente que ese usuario dio de alta. |
| `first_appointment` | la primera cita que creó. |
| `first_measurement` | la primera medición corporal que registró. |
| `first_menu` | el primer menú que creó (manual o generado). |
| `first_menu_template` | la primera plantilla de menú que guardó. |
| `first_shopping_list` | la primera lista de la compra que generó. |

- Un hito que nunca ocurrió viene con `reachedAt: null`. No hace falta que la
  lista traiga todos los códigos si eso complica: con devolver sólo los
  alcanzados nos vale, el frontend asume `null` para el resto.
- `celebratedAt` lo escribe el `POST`, y es lo que impide que la misma primera
  vez se celebre otra vez desde otro dispositivo.
- **No pedimos tiempo real.** El frontend lee esta lista al abrir la aplicación
  y después de guardar algo relevante. Un hito recién alcanzado puede tardar un
  minuto en aparecer sin que pase nada.
- Si añadir códigos nuevos más adelante es caro, decidlo y los recortamos: con
  `first_appointment`, `first_menu` y `first_measurement` —los tres gestos
  diarios— la función ya tiene sentido.

### 2.3 Privacidad y alcance

- Ni las preferencias ni los hitos guardan nada de ningún paciente: son fechas y
  cadenas del profesional.
- Todo cuelga de `tenantId` y del usuario autenticado, con el aislamiento normal.
  Cambiar de centro cambia de preferencias y de hitos, y eso es lo que queremos:
  la primera cita en la clínica nueva también es una primera cita.
- No hace falta permiso nuevo: quien ve la mascota (`§8` del contrato) lee y
  escribe lo suyo.

---

## 3. Cómo se comprueba que está hecho

1. `GET /assistant/preferences` sin haber guardado nada devuelve los valores por
   defecto y `updatedAt: null`, no 404.
2. `PUT` con `stuckFormOfferEnabled: false`, recargar en otro navegador con el
   mismo usuario, y que siga en `false`.
3. Las preferencias de otro usuario del mismo centro no se ven afectadas.
4. Con un usuario que ya tiene citas creadas desde hace meses,
   `GET /assistant/milestones` devuelve `first_appointment` con su `reachedAt`
   **antiguo**. Éste es el punto que de verdad importa: si devuelve la fecha de
   hoy, está calculado mal y la mascota felicitaría a un veterano.
5. Con un usuario recién incorporado, `first_appointment` viene con
   `reachedAt: null` hasta que crea una.
6. `POST .../first_appointment/celebrated` devuelve 204, y el siguiente `GET`
   trae `celebratedAt`. Repetirlo no falla.

---

## 4. Qué hace el frontend mientras tanto

- **Tips y oferta de ayuda en formularios: siguen adelante**, con los opt-outs en
  `localStorage`. Funcionan, con la pega conocida de que se olvidan al cambiar de
  navegador. El día que exista §2.1 se migra lo local a remoto la primera vez que
  se lee, y el navegador pasa a ser sólo caché.
- **Celebraciones: no se implementan.** Sin §2.2 lo único que podemos celebrar es
  "la primera vez que te veo desde este navegador", que es falso y además se nota.
  Si §2.2 se descarta, el plan lo reconvierte en descubrimientos —"¿sabías que
  puedo hacer esto?"—, que no afirman ninguna primera vez y no necesitan backend.
