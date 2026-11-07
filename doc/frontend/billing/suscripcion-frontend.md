# Suscripción del centro — implementación en Angular

Implementación en `sif-web` del contrato
[`doc/contrato-api/billing/billing-frontend.md`](../../contrato-api/billing/billing-frontend.md)
(Fase 0B, §18 de `breaking-changes.md`).

> En una frase: el estado de la suscripción se arma con las cabeceras
> `X-Billing-*` que ya viajan en cada respuesta, el `403 TENANT_SUSPENDED` deja
> de tratarse como una falta de permisos, y `/billing` es la única pantalla que
> sigue en pie cuando el centro está bloqueado.

---

## 1. Piezas

| Fichero | Papel |
|---|---|
| `core/api/models/billing.model.ts` | Tipos del contrato, nombres de cabecera y códigos de error. |
| `core/api/services/billing.api.ts` | `BillingService`: `status`, `checkout`, `portal`, `cancel`, `reactivate`, `invoices`, `downloadInvoice`. |
| `core/billing/billing-status.service.ts` | Estado en señales del centro activo. |
| `core/http/billing.interceptor.ts` | Vuelca las cabeceras `X-Billing-*` en el servicio anterior. |
| `core/http/http-context.tokens.ts` | `IGNORE_NOT_FOUND`, `SILENT_ERROR`, `IGNORE_FORBIDDEN` (ver §5). |
| `core/http/error.interceptor.ts` | Rama nueva para `TENANT_SUSPENDED`. |
| `layout/shell/billing-banner.*` | Aviso en la cabecera de la app. |
| `features/billing/billing.page.*` | Estado, acciones, facturas y pantalla de suspensión. |
| `features/billing/billing-return.page.*` | Vuelta de Stripe (`/billing/success`, `/billing/cancel`). |
| `core/api/services/platform-billing.api.ts` | `PlatformBillingService`: panel de superadmin (§6). |
| `features/admin/billing/*` | Listado y ficha de facturación por centro (§6). |

Rutas: `/billing`, `/billing/success` y `/billing/cancel`, dentro del `Shell`.
Las dos concretas van **antes** que `/billing` en `app.routes.ts`: con
`pathMatch` por prefijo, `billing` se tragaría `billing/success` y dejaría el
segmento sobrante sin ruta.

Ítem de nav: `menu.billing`, permiso `VIEW_BILLING` (lo concede `V61` a `ADMIN`).

---

## 2. De dónde sale el estado

Dos fuentes que se complementan:

- **Cabeceras** (`X-Billing-Status`, `X-Billing-Trial-Ends-At`,
  `X-Billing-Grace-Ends-At`). Vienen en toda respuesta bajo `/api/tenant/**`,
  incluidas las de error. Son gratis y siempre frescas.
- **`GET /billing/status`**, que trae lo demás: `daysLeft`, precio, tarjeta,
  email, facturas.

`BillingStatusService` pide el detalle **una vez por centro** y vuelve a pedirlo
solo cuando la cabecera delata un cambio de estado. Por eso navegar por la app
no cuesta ni una llamada de facturación.

Dos reglas que conviene no perder:

1. **`daysLeft` no se recalcula en el cliente.** Son días naturales UTC y el
   navegador está en otra zona: recalcular da un día de diferencia. Si el estado
   de la cabecera ya no coincide con el del detalle, `daysLeft` pasa a ser
   `null` en vez de enseñar la cuenta atrás vieja.
2. **Sin `VIEW_BILLING` no se pide el detalle** (el backend respondería `403`)
   ni se pinta el banner. El estado sí se conoce, porque la pantalla de
   suspensión lo necesita para explicar qué pasa.

---

## 3. El 403 que no es de permisos

`error.interceptor.ts` mira el `code` del `ProblemDetail` antes de tratar un
`403` como una falta de permiso:

```ts
if (problemDetailCode(error) === TENANT_SUSPENDED_CODE) {
  billing.markSuspended(problemDetailRenewalUrl(error));
  router.navigate(['/billing']);   // sin toast y sin cerrar sesión
}
```

Sin esta rama, un centro suspendido manda al usuario a `/not-authorized` en cada
navegación, con el toast de «acceso denegado» y sin forma de llegar a pagar.

Rutas que siguen respondiendo con el centro suspendido: `/tenant/{id}/billing/**`,
`/tenant/{id}/branding/**`, `/tenant/{id}/profile`, `/users/me` y
`/notifications/**`. El `brandingResolver` del `Shell` entra por la segunda, así
que la pantalla se pinta con su marca aunque el centro esté bloqueado.

---

## 4. Banner y pantallas

| Estado | Qué se ve |
|---|---|
| `TRIAL` | Banner informativo; rojo suave a partir de 3 días o menos. CTA «Añadir método de pago». |
| `ACTIVE` | Sin banner. En `/billing`: portal y cancelar. |
| `PAST_DUE` | Banner rojo suave con los días de gracia. CTA «Actualizar la tarjeta». |
| `SUSPENDED` | Sin banner: `/billing` enseña la pantalla de suspensión con «Pagar». |
| `EXEMPT` | Nada de pago, en ningún sitio. |
| `CANCELLED` | Banner «Acceso hasta el {fecha}». CTA «Reactivar». |

El banner no se pinta dentro de `/billing`, donde el estado ya se ve en grande.

**Checkout y portal se cubren mutuamente.** Es el backend quien decide cuál toca
según el estado, así que cada camino cae en el otro ante su error en vez de
dejar al usuario con un mensaje y sin salida:

- `409 BILLING_CHECKOUT_NOT_ALLOWED` → se abre el portal.
- `503 BILLING_CUSTOMER_REQUIRED` → se abre el checkout.
- `409 BILLING_INVALID_TRANSITION` al reactivar (centro suspendido) → checkout.

**Vuelta de Stripe.** `/billing/success` consulta `status()`; si todavía no está
`ACTIVE`, reintenta **una vez a los 2 s** antes de decir nada, porque el webhook
tarda uno o dos segundos. Si sigue sin confirmarse no se enseña un error duro,
sino «el pago aún se está procesando».

**Facturas.** El PDF se descarga por `GET /invoices/{id}/pdf` (blob), no por
`invoice.pdfUrl`: esa es una URL firmada de MinIO con 1 h de caducidad y **sin**
comprobación de permisos, y la descarga por backend queda auditada.

---

## 5. Por qué los tokens de contexto se mudaron de fichero

`IGNORE_NOT_FOUND`, `SILENT_ERROR` e `IGNORE_FORBIDDEN` vivían en
`error.interceptor.ts`. Ahora el interceptor de errores depende de
`BillingStatusService`, que a su vez depende de `billing.api.ts`, que necesita
esos tokens: el ciclo de imports dejaba los `HttpContextToken` sin inicializar.

Se definen en `core/http/http-context.tokens.ts` y `error.interceptor.ts` los
**reexporta**, así que todos los imports existentes siguen funcionando.

---

## 6. Panel de superadmin

Base `/api/tenants`, permiso de plataforma `MANAGE_TENANT`. Cuelga de `/admin`,
que ya exige ese permiso y centro administrador (`adminGuard`), así que las
pantallas no vuelven a comprobar nada.

| Ruta | Pantalla |
|---|---|
| `/admin/billing` | Listado de centros con filtro por estado y búsqueda. |
| `/admin/billing/:tenantId` | Ficha: Stripe y fechas, configuración, acciones manuales, histórico y facturas. |

Cliente: `core/api/services/platform-billing.api.ts` (`PlatformBillingService`).
Modelos: `TenantBillingAdminDto`, `UpdateTenantBillingRequest`,
`BillingOverrideRequest` y `SubscriptionEvent`, en `billing.model.ts`.

Detalles que importan:

- **El precio se edita en euros y viaja en céntimos.** Y solo afecta a
  suscripciones nuevas: las existentes conservan su `price_id` de Stripe, cosa
  que la propia pantalla avisa.
- **Marcar un centro como exento exige motivo.** Se valida en el formulario
  además de en el backend, para no gastar el viaje y para enseñar el aviso
  junto al campo. Suspender a mano también lo exige.
- **`subscription_event.type` se tipa como `string`**, no como unión cerrada: el
  backend puede añadir tipos y una tabla no debe romperse por uno nuevo. Si no
  hay traducción para el tipo, se enseña el código en crudo en vez de la clave.
- **`metadata` es JSON libre** y se pinta tal cual (`clave: valor`), sin
  inventarle forma.
- Las facturas del panel enlazan al `hostedInvoiceUrl` de Stripe: el contrato no
  expone una descarga de PDF por el lado de plataforma, solo la del centro.

> **Tres formas sin confirmar.** El contrato (§8.1 del plan de fase) detalla
> `GET /tenants/{id}/billing` y el cuerpo del `PUT`, pero no el resto. Se ha
> asumido: (1) `GET /tenants/billing` devuelve `Page<TenantBillingAdminDto>`;
> (2) `POST /trial` acepta `{ days, reason }` y `/suspend` y `/reactivate`
> aceptan `{ reason }`; (3) los eventos salen como `{ id, type, occurredAt,
> stripeEventId, metadata }`, calcado de la tabla `subscription_event`.
> Confirmar contra el backend antes de dar el panel por bueno.

---

## 7. Cómo probarlo

Sin tocar Stripe, forzando el estado desde el backend o con un proxy que inyecte
cabeceras:

1. `X-Billing-Status: TRIAL` + `daysLeft` bajo → banner informativo y, con 3 días
   o menos, rojo suave.
2. `X-Billing-Status: PAST_DUE` → banner rojo con los días de gracia.
3. Un `403` con `{"code":"TENANT_SUSPENDED"}` en cualquier endpoint de negocio →
   la app va a `/billing`, enseña la pantalla de suspensión y **no** aparece el
   toast de «acceso denegado» ni se cierra la sesión.
4. Un usuario sin `VIEW_BILLING` en un centro suspendido → `/billing` le dice que
   contacte con el administrador y no se dispara ninguna llamada de facturación.

5. Panel de superadmin: entra como centro administrador, `/admin` → botón
   «Facturación». El filtro por estado no manda `status` cuando está en «todos».

Tests: `core/http/billing.interceptor.spec.ts`,
`core/http/error.interceptor.spec.ts`,
`core/billing/billing-status.service.spec.ts`,
`core/api/services/platform-billing.api.spec.ts` y
`features/admin/billing/admin-billing-detail.spec.ts`.
