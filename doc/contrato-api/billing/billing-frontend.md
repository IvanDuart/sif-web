# Contrato de facturación para el frontend (Angular)

> Fase 0B — suscripciones por tenant. El backend cobra 25 €/mes fijos por centro con Stripe
> Billing + Tax y bloquea el acceso cuando la cuenta lleva 10 días impagada.

Documento hermano: `doc/roadmap/plan-mejoras/fase-0b-suscripciones.md` (plan original).

---

## 1. Modelo mental: estados y qué se ve

El estado vive en el tenant (`billing_status`). Solo uno bloquea:

| Estado | Acceso | Qué enseña el frontend |
|---|---|---|
| `TRIAL` | Completo | Banner: "Te quedan X días de prueba" + CTA **Añadir método de pago**. |
| `ACTIVE` | Completo | Sin banner. |
| `PAST_DUE` | Completo | Banner rojo suave: "No hemos podido cobrar. Tienes X días" + CTA **Actualizar la tarjeta**. |
| `SUSPENDED` | **Bloqueado** salvo `/billing` | Pantalla de suspensión con CTA **Pagar**. |
| `EXEMPT` | Completo | Sin banner. Nunca se le muestra nada de pago. |
| `CANCELLED` | Completo hasta `paidUntil` | Banner: "Acceso hasta el {fecha}" + CTA **Reactivar**. |

`GET /tenant/{tenantId}/billing/status` es el **único endpoint de facturación que responde a un
tenant suspendido**. Con él se pinta el banner y la pantalla de pago.

---

## 2. Cabeceras de estado (banner sin petición extra)

Todas las respuestas bajo `/api/tenant/{tenantId}/**` traen:

| Cabecera | Ejemplo | Cuándo viene |
|---|---|---|
| `X-Billing-Status` | `TRIAL` | Siempre que el tenant exista. |
| `X-Billing-Trial-Ends-At` | `2026-12-01T00:00:00Z` | Solo si `trial_ends_at` no es nulo. |
| `X-Billing-Grace-Ends-At` | `2026-12-11T00:00:00Z` | Solo si `grace_ends_at` no es nulo. |

Recomendación: un `HttpInterceptor` lee estas cabeceras en cada respuesta y actualiza el store del
banner. No hace falta llamar a `status` en cada navegación.

---

## 3. Respuesta 403 de suspensión

Cualquier endpoint de negocio con el tenant suspendido devuelve:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json
```

```json
{
  "type": "about:blank",
  "title": "Tenant suspended",
  "status": 403,
  "detail": "La suscripción ha caducado. Renueva para recuperar el acceso.",
  "code": "TENANT_SUSPENDED",
  "billingStatus": "SUSPENDED",
  "renewalUrl": "https://app.tusdietas.com/billing"
}
```

**Qué hacer:** interceptar en el `HttpInterceptor` de errores — si `code === 'TENANT_SUSPENDED'`,
redirigir a `/billing` sin mostrar un toast genérico y sin cerrar sesión.

Rutas que **sí** responden con el tenant suspendido (no dan 403):

```text
GET  /api/tenant/{tenantId}/billing/**
POST /api/tenant/{tenantId}/billing/**
GET  /api/tenant/{tenantId}/branding/**
GET  /api/tenant/{tenantId}/profile
GET  /api/users/me
GET  /api/notifications/**
```

---

## 4. Servicio `BillingApiService`

```ts
// models
export type BillingStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'EXEMPT' | 'CANCELLED';

export interface BillingPaymentMethod {
  brand: string;        // 'visa'
  last4: string;        // '4242'
  expMonth: number;     // 12
  expYear: number;      // 2028
}

export interface BillingInvoice {
  id: string;
  number: string | null;
  amountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  pdfUrl: string | null;
  hostedInvoiceUrl: string | null;
}

export interface BillingStatusResponse {
  tenantId: string;
  tenantName: string;
  status: BillingStatus;
  statusLabel: string;
  billingExempt: boolean;
  priceCents: number;
  currency: string;
  trialEndsAt: string | null;
  paidUntil: string | null;
  graceEndsAt: string | null;
  suspendedAt: string | null;
  daysLeft: number | null;
  countdownKind: 'TRIAL' | 'GRACE' | 'PAID_UNTIL' | null;
  cancelAtPeriodEnd: boolean;
  billingEmail: string | null;
  paymentMethod: BillingPaymentMethod | null;
  invoices: BillingInvoice[];
}
```

```ts
@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private readonly base = (tenantId: string) => `/api/tenant/${tenantId}/billing`;

  constructor(private http: HttpClient) {}

  status(tenantId: string) {
    return this.http.get<BillingStatusResponse>(`${this.base(tenantId)}/status`);
  }

  checkout(tenantId: string) {
    return this.http.post<{ url: string }>(`${this.base(tenantId)}/checkout-session`, {});
  }

  portal(tenantId: string) {
    return this.http.post<{ url: string }>(`${this.base(tenantId)}/portal-session`, {});
  }

  cancel(tenantId: string) {
    return this.http.post<BillingStatusResponse>(`${this.base(tenantId)}/cancel`, { confirm: true });
  }

  reactivate(tenantId: string) {
    return this.http.post<BillingStatusResponse>(`${this.base(tenantId)}/reactivate`, {});
  }

  invoices(tenantId: string, page = 0, size = 20) {
    return this.http.get<PagedModel<BillingInvoice>>(
      `${this.base(tenantId)}/invoices?page=${page}&size=${size}&sort=periodStart,desc`);
  }

  /** Descarga del PDF con la sesión del usuario (el backend comprueba permiso en cada descarga). */
  downloadInvoice(tenantId: string, invoiceId: string) {
    return this.http.get(`${this.base(tenantId)}/invoices/${invoiceId}/pdf`,
      { responseType: 'blob' });
  }
}
```

> **Paginación:** recuerda el formato `PagedModel` — `{ content, page: { size, number, totalElements, totalPages } }`
> (ver `doc/contrato-api/breaking-changes.md` §1).

---

## 5. Flujos en pantalla

### 5.1 Checkout (contratar)

```ts
this.billing.checkout(tenantId).subscribe(({ url }) => {
  window.location.href = url;   // Stripe aloja la pasarela: no hay formulario propio
});
```

Vuelta de Stripe:

- `success_url` → `/billing/success`: llamar a `status()` y mostrar "Suscripción activada".
  El webhook puede tardar 1–2 s; si sigue en `TRIAL`, reintentar una vez a los 2 s antes de
  mostrar un error.
- `cancel_url` → `/billing/cancel`: volver a `/billing` sin haber cambiado nada.

Cuándo se puede abrir checkout: estados `TRIAL`, `PAST_DUE` y `SUSPENDED`. En `ACTIVE` y `CANCELLED`
el backend responde `409 BILLING_CHECKOUT_NOT_ALLOWED`: usa el **Portal** para cambiar la tarjeta.

### 5.2 Portal de cliente

Igual pero por `portal()`: cambiar tarjeta, ver facturas, cancelar. Requiere que el tenant ya tenga
`stripeCustomerId`; si no, responde `503 BILLING_CUSTOMER_REQUIRED` — en ese caso ofrece Checkout.

### 5.3 Cancelar

```ts
if (await confirmDialog.open('¿Cancelar la suscripción? Mantendrás el acceso hasta el {fecha}.')) {
  this.billing.cancel(tenantId).subscribe();
}
```

### 5.4 Reactivar

`POST /reactivate` deshace una cancelación programada. **No sirve para levantar un tenant
suspendido**: para eso hay que pagar (checkout). El backend responde `409` si se intenta.

### 5.5 Facturas

Listado desde `invoices` y descarga con `downloadInvoice` → `URL.createObjectURL(blob)`. No usar
`pdfUrl` para descargar directamente si se quiere auditar el acceso: `pdfUrl` es una URL firmada de
MinIO con caducidad de 1 h y sin comprobación de permisos.

---

## 6. Copy sugerido del banner

| Estado | Texto | CTA |
|---|---|---|
| `TRIAL`, `daysLeft <= 3` | "Tu prueba termina en {daysLeft} días" | Añadir método de pago |
| `TRIAL` | "Estás en periodo de prueba" | Añadir método de pago |
| `PAST_DUE` | "No hemos podido cobrar. Tienes {daysLeft} días" | Actualizar la tarjeta |
| `CANCELLED` | "Acceso hasta el {paidUntil}" | Reactivar |
| `SUSPENDED` | Pantalla completa, no banner | Pagar |

`daysLeft` y `countdownKind` ya vienen calculados en **días naturales UTC**: no recalcular en el
cliente (el navegador está en otra zona y daría un día de diferencia).

---

## 7. Códigos de error de billing

| Código | HTTP | Significado |
|---|---|---|
| `TENANT_SUSPENDED` | 403 | Suscripción caducada; redirigir a `/billing`. |
| `BILLING_DISABLED` | 400/503 | Stripe no configurado en este entorno. |
| `BILLING_EXEMPT_TENANT` | 409 | El centro está exento; no hay nada que contratar. |
| `BILLING_CHECKOUT_NOT_ALLOWED` | 409 | El estado actual no permite checkout (usa el Portal). |
| `BILLING_INVALID_TRANSITION` | 409 | Acción incompatible con el estado actual. |
| `BILLING_CUSTOMER_REQUIRED` | 503 | Sin customer de Stripe: pasa antes por Checkout. |
| `BILLING_CANCEL_CONFIRMATION_REQUIRED` | 400 | Falta `{ confirm: true }`. |
| `BILLING_REASON_REQUIRED` | 400 | (Superadmin) el cambio manual exige motivo. |
| `BILLING_INVOICE_NOT_FOUND` | 404 | Factura inexistente o de otro tenant. |
| `BILLING_INVOICE_PDF_UNAVAILABLE` | 404 | La factura aún no tiene PDF archivado. |
| `BILLING_STRIPE_ERROR` | 503 | Stripe devolvió un error; reintentar. |

---

## 8. Panel de superadmin (opcional en Angular, ya existe en la API)

Base `/api/tenants`, permiso `MANAGE_TENANT` de plataforma.

```http
GET  /api/tenants/billing?status=&q=&page=&size=
GET  /api/tenants/{id}/billing
PUT  /api/tenants/{id}/billing
POST /api/tenants/{id}/billing/trial
POST /api/tenants/{id}/billing/suspend
POST /api/tenants/{id}/billing/reactivate
GET  /api/tenants/{id}/billing/events
GET  /api/tenants/{id}/billing/invoices
```

`PUT` acepta `{ billingExempt, priceCents, trialDays, billingEmail, reason }`; `billingExempt: true`
**exige** `reason`. `priceCents` solo afecta a suscripciones nuevas: las existentes conservan su
`price_id` de Stripe.

---

## 9. Checklist de implementación

- [ ] `BillingApiService` + modelos (§4).
- [ ] `HttpInterceptor` que lee `X-Billing-*` y actualiza el store del banner (§2).
- [ ] `HttpInterceptor` de errores que detecta `TENANT_SUSPENDED` y redirige a `/billing` (§3).
- [ ] Banner global por estado (§6).
- [ ] Pantalla de suscripción: estado, cuenta atrás, método de pago, botones checkout/portal/cancelar/reactivar.
- [ ] Rutas `/billing/success` y `/billing/cancel`.
- [ ] Pantalla de facturas con descarga por blob.
- [ ] Tests de los dos interceptores y del banner.
