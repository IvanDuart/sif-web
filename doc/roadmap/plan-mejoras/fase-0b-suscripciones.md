# Fase 0B — Suscripciones y facturación por tenant

> **Duración estimada:** 5-6 semanas con 1 backend dedicado + 1-1,5 semanas de frontend Angular.
> **Objetivo:** cobrar una suscripción mensual fija por tenant para mantener el software operativo, con periodo de prueba, 10 días de gracia y corte de acceso automatizado.
> **Entregable:** Stripe integrado, estados de facturación por tenant, webhooks idempotentes, middleware de suspensión, panel de superadmin, portal del tenant, emails y notificaciones.
> **Posición en el roadmap:** después de la Fase 0. Requiere que el contrato, los errores tipados y los campos base de `Tenant` estén cerrados.

---

## 1. Decisiones de producto

| Tema | Decisión |
|---|---|
| Pasarela | **Stripe** (Billing + Tax). Tarjeta como método principal; SEPA opcional. |
| Precio | **25 €/mes fijo por tenant** (`2500` céntimos, EUR). |
| Periodicidad | Mensual, renovación automática. |
| Prueba | Trial configurable por tenant; **14 días por defecto**. |
| Gracia | **10 días naturales** desde el fallo de pago o fin de trial sin método de pago. |
| Acceso durante la gracia | **Completo**, con avisos diarios. |
| Corte | Tras la gracia: `SUSPENDED`. El backend rechaza todo salvo billing. |
| Admin suspendido | **Puede acceder a billing** para pagar y reactivar. |
| Exención | El superadmin puede marcar un tenant como `billing_exempt` (tenant de prueba, partners, lifetime). |
| Tenant de prueba | Exento por defecto; nunca se le crea suscripción en Stripe. |
| Cancelación voluntaria | Acceso hasta `paid_until`; después `SUSPENDED` sin gracia. |
| Facturación | Stripe Tax calcula IVA; el backend genera/guarda la factura local y su PDF. |
| Avisos | **Email + notificación in-app/push** a los administradores del tenant. |
| Moneda | EUR únicamente en esta fase. |

> **Nota:** esta fase sustituye la decisión anterior “Pagos fuera de roadmap”. El cobro por cita y los pagos a profesionales siguen fuera de alcance.

---

## 2. Prerrequisitos (Fase 0)

- `Tenant` con `currency` y `preferences` estables (T2).
- Errores `ProblemDetail` con `code` (T3).
- `PATCH /tenant/{id}/preferences` mergeable (T5).
- `@hasAccess.withSystemPermission('MANAGE_TENANT')` operativo.
- `PushNotificationService` operativo.
- MinIO operativo para PDFs de factura.
- Acceso a un proveedor de email transaccional (ver §9).

---

## 3. Estados del tenant

Añadir `billing_status` a `tenant`:

| Estado | Significado | Acceso |
|---|---|---|
| `TRIAL` | Periodo de prueba activo. | Completo. |
| `ACTIVE` | Suscripción pagada y vigente. | Completo. |
| `PAST_DUE` | Fallo de pago; gracia de 10 días en curso. | Completo + avisos. |
| `SUSPENDED` | Gracia agotada o cancelación voluntaria. | Bloqueado salvo billing. |
| `EXEMPT` | No se factura. | Completo. |
| `CANCELLED` | Cancelación programada; acceso hasta `paid_until`. | Completo hasta fin de periodo. |

### 3.1 Transiciones

```text
Alta ──[billing_exempt=true]──► EXEMPT
Alta ──[billing_exempt=false]──► TRIAL
TRIAL ──[pago ok / checkout]──► ACTIVE
TRIAL ──[trial_ends_at sin pago]──► PAST_DUE ──[+10d]──► SUSPENDED
ACTIVE ──[invoice.payment_failed]──► PAST_DUE ──[+10d]──► SUSPENDED
PAST_DUE ──[invoice.paid]──► ACTIVE
SUSPENDED ──[invoice.paid / checkout]──► ACTIVE
ACTIVE ──[cancel_at_period_end]──► CANCELLED ──[paid_until]──► SUSPENDED
CANCELLED ──[reactivate]──► ACTIVE
SUSPENDED ──[superadmin override]──► ACTIVE | EXEMPT
```

### 3.2 Reglas

1. `EXEMPT` nunca se suspende automáticamente.
2. `PAST_DUE` siempre tiene `grace_ends_at`; si es `null`, el job lo calcula como `now + 10 días`.
3. `SUSPENDED` conserva los datos; no se borra nada.
4. El paso a `SUSPENDED` no deshabilita usuarios en Keycloak: el bloqueo es de negocio, reversible al instante.
5. Un tenant suspendido puede pagar y volver a `ACTIVE` sin intervención manual.

---

## 4. Modelo de datos

Migración `V48__create_billing_tables.sql` (renumerar si otra rama usa V48).

### 4.1 Columnas en `tenant`

> La moneda se toma de `tenant.currency` (creada en Fase 0, T2). No se duplica una columna de moneda de billing.

```sql
ALTER TABLE tenant
    ADD COLUMN billing_status VARCHAR(20) NOT NULL DEFAULT 'TRIAL',
    ADD COLUMN billing_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN trial_ends_at TIMESTAMPTZ,
    ADD COLUMN paid_until TIMESTAMPTZ,
    ADD COLUMN grace_ends_at TIMESTAMPTZ,
    ADD COLUMN suspended_at TIMESTAMPTZ,
    ADD COLUMN subscription_price_cents INTEGER NOT NULL DEFAULT 2500,
    ADD COLUMN stripe_customer_id VARCHAR(255),
    ADD COLUMN stripe_subscription_id VARCHAR(255),
    ADD COLUMN stripe_price_id VARCHAR(255),
    ADD COLUMN billing_email VARCHAR(255),
    ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tenant
    ADD CONSTRAINT ck_tenant_billing_status CHECK (
        billing_status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'EXEMPT', 'CANCELLED')
    ),
    ADD CONSTRAINT ck_tenant_billing_price CHECK (subscription_price_cents >= 0);

CREATE UNIQUE INDEX uq_tenant_stripe_customer
    ON tenant (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX uq_tenant_stripe_subscription
    ON tenant (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;
```

Backfill:

```sql
-- El tenant de plataforma y los de desarrollo quedan exentos.
UPDATE tenant
SET billing_status = 'EXEMPT', billing_exempt = TRUE
WHERE admin_tenant = TRUE;

-- El resto empieza en trial de 14 días.
UPDATE tenant
SET billing_status = 'TRIAL',
    trial_ends_at = now() + interval '14 days'
WHERE billing_exempt = FALSE;
```

> Ajustar el backfill antes de ejecutar en producción. Confirmar qué tenants son de prueba.

### 4.2 `subscription_event`

```sql
CREATE TABLE subscription_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL,
    type            VARCHAR(40) NOT NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    stripe_event_id VARCHAR(255),
    metadata        JSONB       NOT NULL DEFAULT '{}',
    CONSTRAINT fk_subscription_event_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscription_event_tenant
    ON subscription_event (tenant_id, occurred_at DESC);
CREATE UNIQUE INDEX uq_subscription_event_stripe
    ON subscription_event (stripe_event_id)
    WHERE stripe_event_id IS NOT NULL;
```

Tipos: `TRIAL_STARTED`, `TRIAL_ENDING`, `TRIAL_ENDED`, `CHECKOUT_COMPLETED`, `PAYMENT_SUCCEEDED`, `PAYMENT_FAILED`, `GRACE_STARTED`, `GRACE_ENDING`, `SUSPENDED`, `REACTIVATED`, `CANCELLED`, `EXEMPTED`, `MANUAL_OVERRIDE`.

### 4.3 `subscription_invoice`

```sql
CREATE TABLE subscription_invoice (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID        NOT NULL,
    stripe_invoice_id  VARCHAR(255) NOT NULL,
    number             VARCHAR(80),
    amount_cents       INTEGER     NOT NULL,
    tax_cents          INTEGER     NOT NULL DEFAULT 0,
    currency           VARCHAR(3)  NOT NULL DEFAULT 'EUR',
    status             VARCHAR(20) NOT NULL,
    period_start       TIMESTAMPTZ NOT NULL,
    period_end         TIMESTAMPTZ NOT NULL,
    paid_at            TIMESTAMPTZ,
    hosted_invoice_url TEXT,
    pdf_stored_file_id UUID,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_subscription_invoice_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_subscription_invoice_pdf
        FOREIGN KEY (pdf_stored_file_id) REFERENCES stored_file(id),
    CONSTRAINT uq_subscription_invoice_stripe UNIQUE (stripe_invoice_id),
    CONSTRAINT ck_subscription_invoice_status CHECK (
        status IN ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE')
    )
);

CREATE INDEX idx_subscription_invoice_tenant
    ON subscription_invoice (tenant_id, period_start DESC);
```

### 4.4 `billing_webhook_event`

```sql
CREATE TABLE billing_webhook_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
    type            VARCHAR(80) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    payload         JSONB       NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    error           TEXT,
    CONSTRAINT ck_billing_webhook_status CHECK (
        status IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')
    )
);
```

Sirve para idempotencia y para reprocesar eventos fallidos.

### 4.5 `billing_reminder`

```sql
CREATE TABLE billing_reminder (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL,
    type        VARCHAR(40) NOT NULL,
    sent_on     DATE        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_billing_reminder_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT uq_billing_reminder UNIQUE (tenant_id, type, sent_on)
);
```

Evita duplicar emails si el job se ejecuta dos veces.

---

## 5. Configuración de Stripe

### 5.1 Producto y precio

En Stripe:

- Producto: `Tus Dietas — Suscripción mensual`.
- Price: `price_xxx`, `unit_amount = 2500`, `currency = eur`, `recurring.interval = month`.
- Tax behavior: `exclusive` (el IVA se añade según el país del cliente).
- Stripe Tax activado.

El `price_id` se guarda en `application.yaml` (`stripe.price-id`) y se copia a `tenant.stripe_price_id` al crear la suscripción. Así se puede cambiar de precio en el futuro sin romper suscripciones existentes.

### 5.2 Configuración

```yaml
stripe:
  enabled: ${STRIPE_ENABLED:false}
  secret-key: ${STRIPE_SECRET_KEY:}
  publishable-key: ${STRIPE_PUBLISHABLE_KEY:}
  webhook-secret: ${STRIPE_WEBHOOK_SECRET:}
  price-id: ${STRIPE_PRICE_ID:}
  success-url: ${STRIPE_SUCCESS_URL:http://localhost:4200/billing/success}
  cancel-url: ${STRIPE_CANCEL_URL:http://localhost:4200/billing/cancel}
  portal-return-url: ${STRIPE_PORTAL_RETURN_URL:http://localhost:4200/billing}
  tax-enabled: ${STRIPE_TAX_ENABLED:true}
```

- `stripe.enabled=false` en local: los endpoints devuelven `BILLING_DISABLED`.
- Nunca commitear claves reales.
- Usar variables de entorno o secret manager.

### 5.3 Dependencia

```xml
<dependency>
    <groupId>com.stripe</groupId>
    <artifactId>stripe-java</artifactId>
    <version>29.x</version>
</dependency>
```

> Verificar la última versión estable antes de implementar. La API usada es estable desde hace años.

---

## 6. Flujos

### 6.1 Alta de tenant facturable

1. Superadmin crea el tenant.
2. Si `billing_exempt=false`:
   - `billing_status = TRIAL`
   - `trial_ends_at = now() + trialDays`
   - `subscription_price_cents = 2500`
   - `billing_email` = email del admin.
3. Se envía email de bienvenida con fecha de fin de trial.
4. El admin puede añadir tarjeta cuando quiera.

### 6.2 Checkout

1. `POST /tenant/{id}/billing/checkout-session`.
2. Backend:
   - Busca o crea `Stripe Customer` con `metadata.tenantId`.
   - Crea `Checkout Session` en modo `subscription`.
   - `line_items`: `price_id`.
   - `subscription_data.metadata.tenantId`.
   - `customer_update.address = auto` si Stripe Tax está activo.
   - `allow_promotion_codes` opcional.
3. Devuelve `{ "url": "https://checkout.stripe.com/..." }`.
4. Angular redirige.
5. Stripe vuelve a `success_url`.
6. Webhook `checkout.session.completed` y `customer.subscription.created` activan el tenant.

### 6.3 Fallo de pago

1. Stripe emite `invoice.payment_failed`.
2. Backend:
   - `billing_status = PAST_DUE`.
   - `grace_ends_at = now() + 10 días`.
   - Registra `PAYMENT_FAILED` y `GRACE_STARTED`.
   - Email + notificación a admins.
3. Stripe reintenta el cobro según su configuración (dunning).
4. Si `invoice.paid` antes de `grace_ends_at`: `ACTIVE`, limpia gracia.
5. Si no: el job diario suspende.

### 6.4 Suspensión

Job diario (03:00 UTC):

```sql
SELECT *
FROM tenant
WHERE billing_status = 'PAST_DUE'
  AND grace_ends_at < now()
  AND billing_exempt = FALSE;
```

Para cada tenant:

- `billing_status = SUSPENDED`, `suspended_at = now()`.
- `subscription_event(SUSPENDED)`.
- Email + notificación.
- No se toca Keycloak.

### 6.5 Reactivación

- `invoice.paid` o `checkout.session.completed`:
  - `billing_status = ACTIVE`.
  - `paid_until = period_end`.
  - `grace_ends_at = NULL`, `suspended_at = NULL`.
  - `subscription_event(REACTIVATED)`.
  - Email + notificación.

### 6.6 Cancelación voluntaria

1. `POST /tenant/{id}/billing/cancel`.
2. Backend llama a Stripe con `cancel_at_period_end = true`.
3. `tenant.cancel_at_period_end = true`, `billing_status = CANCELLED`.
4. Acceso hasta `paid_until`.
5. Al llegar `paid_until`, job o webhook `customer.subscription.deleted` pasa a `SUSPENDED`.
6. Reactivar antes del final: `POST /tenant/{id}/billing/reactivate`.

### 6.7 Exención

Superadmin:

```http
PUT /tenants/{id}/billing
{ "billingExempt": true, "reason": "Tenant de prueba" }
```

- `billing_status = EXEMPT`.
- Cancela la suscripción en Stripe si existía (`cancel_at_period_end` o cancelación inmediata, según decisión).
- Registra `EXEMPTED` con el motivo.

---

## 7. Middleware de acceso

### 7.1 Implementación

`security/TenantBillingAccessInterceptor.java`:

- `HandlerInterceptor.preHandle`.
- Extrae `tenantId` de `HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE`.
- Si no hay `tenantId`, continúa.
- Carga el tenant (cache corta de 60 s para no golpear la BD en cada request).
- Si `billing_exempt` o `EXEMPT`: continúa.
- Si `SUSPENDED`:
  - Comprueba si la ruta es de billing o de identidad.
  - Si no lo es: `403` con `ProblemDetail` `TENANT_SUSPENDED`.
- Si `TRIAL` o `PAST_DUE`:
  - Añade cabeceras `X-Billing-Status`, `X-Billing-Trial-Ends-At` / `X-Billing-Grace-Ends-At`.
  - Continúa.

### 7.2 Rutas exentas del bloqueo

```text
GET  /api/tenant/{tenantId}/billing/**
POST /api/tenant/{tenantId}/billing/**
GET  /api/users/me
POST /api/auth/**
GET  /api/notifications/**
POST /api/webhooks/stripe
GET  /api/actuator/health
```

> `GET /api/notifications/**` se mantiene para que el admin reciba el aviso de suspensión. Si se prefiere cortar todo, quitar esta excepción.

### 7.3 Respuesta de suspensión

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

### 7.4 Cache

- `Caffeine` o un `ConcurrentHashMap` con TTL de 60 s.
- Invalidar al cambiar el estado (`TenantBillingService`).
- No cachear `SUSPENDED` más de 60 s para que el pago reactive rápido.

---

## 8. API

### 8.1 Superadmin

Base: `/api/tenants`.

```http
GET  /tenants/billing?status=&q=&page=&size=
GET  /tenants/{id}/billing
PUT  /tenants/{id}/billing
POST /tenants/{id}/billing/trial
POST /tenants/{id}/billing/suspend
POST /tenants/{id}/billing/reactivate
GET  /tenants/{id}/billing/events?page=&size=
GET  /tenants/{id}/billing/invoices?page=&size=
```

`GET /tenants/{id}/billing`:

```json
{
  "tenantId": "uuid",
  "tenantName": "Clínica Ejemplo",
  "billingStatus": "ACTIVE",
  "billingExempt": false,
  "priceCents": 2500,
  "currency": "EUR",
  "trialEndsAt": null,
  "paidUntil": "2026-11-29T00:00:00Z",
  "graceEndsAt": null,
  "suspendedAt": null,
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...",
  "cancelAtPeriodEnd": false,
  "billingEmail": "admin@clinica.com"
}
```

`PUT /tenants/{id}/billing`:

```json
{
  "billingExempt": false,
  "priceCents": 2500,
  "trialDays": 14,
  "billingEmail": "admin@clinica.com",
  "reason": "Alta comercial"
}
```

Reglas:

- `priceCents` solo afecta a suscripciones nuevas; las existentes conservan su `price_id`.
- `trialDays` solo se aplica si el tenant está en `TRIAL` o se llama a `/trial`.
- `billingExempt=true` exige `reason`.
- `POST /suspend` es una acción manual de override; registra quién y por qué.
- `POST /reactivate` solo si el tenant está `SUSPENDED`.

### 8.2 Admin del tenant

Base: `/api/tenant/{tenantId}/billing`.

```http
GET  /status
POST /checkout-session
POST /portal-session
POST /cancel
POST /reactivate
GET  /invoices?page=&size=
GET  /invoices/{invoiceId}
GET  /invoices/{invoiceId}/pdf
```

`GET /status`:

```json
{
  "status": "PAST_DUE",
  "priceCents": 2500,
  "currency": "EUR",
  "trialEndsAt": null,
  "paidUntil": "2026-10-01T00:00:00Z",
  "graceEndsAt": "2026-10-11T00:00:00Z",
  "daysLeft": 4,
  "cancelAtPeriodEnd": false,
  "paymentMethod": {
    "brand": "visa",
    "last4": "4242",
    "expMonth": 12,
    "expYear": 2028
  },
  "invoices": [
    {
      "id": "uuid",
      "number": "TD-2026-0001",
      "amountCents": 2500,
      "taxCents": 525,
      "currency": "EUR",
      "status": "PAID",
      "periodStart": "2026-09-01T00:00:00Z",
      "periodEnd": "2026-10-01T00:00:00Z",
      "pdfUrl": "https://minio.../firmada"
    }
  ]
}
```

Reglas:

- `GET /status` accesible para cualquier admin del tenant, incluso `SUSPENDED`.
- `POST /checkout-session` solo si `TRIAL`, `PAST_DUE` o `SUSPENDED`.
- `POST /portal-session` solo si hay `stripe_customer_id`.
- `POST /cancel` exige `MANAGE_TENANT` y confirmación (`{ "confirm": true }`).
- `POST /reactivate` revierte `cancel_at_period_end`.
- Las facturas PDF se sirven por URL firmada de MinIO o por `hosted_invoice_url` de Stripe.

### 8.3 Webhook

```http
POST /api/webhooks/stripe
Stripe-Signature: t=...,v1=...
```

- Verificar firma con `Webhook.constructEvent`.
- Guardar `billing_webhook_event` antes de procesar.
- Si ya existe `stripe_event_id`, devolver `200` sin reprocesar.
- Procesar en transacción.
- Si falla, marcar `FAILED`, devolver `500` para que Stripe reintente.
- Responder `200` rápido; operaciones lentas (email) después del commit.

Eventos soportados:

| Evento | Acción |
|---|---|
| `checkout.session.completed` | Vincular customer/subscription; si `payment_status=paid`, `ACTIVE`. |
| `customer.subscription.created` | Guardar IDs, status, `trial_end`, `current_period_end`. |
| `customer.subscription.updated` | Sincronizar status, `cancel_at_period_end`, `current_period_end`. |
| `customer.subscription.deleted` | `SUSPENDED` (o `CANCELLED` si aún no venció). |
| `invoice.paid` | `ACTIVE`, `paid_until`, guardar factura, PDF. |
| `invoice.payment_failed` | `PAST_DUE`, `grace_ends_at = now + 10d`. |
| `invoice.finalized` | Guardar factura local. |
| `customer.updated` | Sincronizar email/dirección fiscal. |

Eventos desconocidos: guardar como `IGNORED`, responder `200`.

---

## 9. Emails y notificaciones

### 9.1 Infraestructura de email

Actualmente **no hay** servicio de email en el backend. Hay que añadir uno.

Opciones:

| Proveedor | Coste | Ventaja |
|---|---|---|
| **Resend** | Free 100/día; ~20 €/mes para 50k | API sencilla, buena entrega. |
| **Amazon SES** | ~0,10 € por 1.000 emails | Muy barato a escala; requiere verificación de dominio. |
| **Postmark** | ~15 €/mes | Excelente entregabilidad transaccional. |
| **SMTP propio** | Variable | Sin dependencia, pero peor entregabilidad. |

Recomendación: **Resend** para empezar, con abstracción `EmailService` para cambiar a SES/Postmark.

Dependencia:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

Configuración:

```yaml
app:
  billing:
    email:
      enabled: ${BILLING_EMAIL_ENABLED:false}
      provider: ${BILLING_EMAIL_PROVIDER:resend}
      from: ${BILLING_EMAIL_FROM:facturacion@tusdietas.com}
      reply-to: ${BILLING_EMAIL_REPLY_TO:soporte@tusdietas.com}
```

`EmailService`:

```java
void sendBillingEmail(String to, BillingEmailType type, Map<String, Object> model);
```

### 9.2 Plantillas

| Email | Cuándo | Contenido |
|---|---|---|
| `TRIAL_STARTED` | Alta | Bienvenida + fecha fin de prueba + enlace a billing. |
| `TRIAL_ENDING` | 7, 3 y 1 día antes | Recordatorio + enlace para añadir tarjeta. |
| `PAYMENT_FAILED` | Fallo | Importe, motivo, enlace para actualizar tarjeta. |
| `GRACE_REMINDER` | Día 3, 7 y 10 de gracia | Días restantes + enlace. |
| `SUSPENDED` | Suspensión | Acceso cortado + enlace para pagar. |
| `REACTIVATED` | Pago ok | Acceso restaurado. |
| `INVOICE_PAID` | Factura pagada | Enlace a factura PDF. |
| `CANCELLED` | Cancelación | Fecha de fin de acceso. |

- HTML simple, responsive, en español.
- Incluir logo del tenant si existe; si no, logo de plataforma.
- No incluir datos de tarjeta.
- Enlaces con token firmado o login.

### 9.3 Notificaciones in-app/push

Usar `PushNotificationService.notifyUserAfterCommit` a todos los usuarios con rol `ADMIN` del tenant:

```java
pushNotificationService.notifyUserAfterCommit(
    adminUserId,
    "Suscripción pendiente",
    "Quedan 3 días para renovar. Actualiza tu método de pago.",
    PushNotificationService.pushData("BILLING_GRACE", tenantId, null, null)
);
```

Añadir `TYPE_BILLING_TRIAL_ENDING`, `TYPE_BILLING_PAYMENT_FAILED`, `TYPE_BILLING_SUSPENDED`, `TYPE_BILLING_REACTIVATED`.

Reglas:

- No enviar más de un aviso del mismo tipo al día (`billing_reminder`).
- El email es el canal principal; el push es refuerzo.
- Si el tenant no tiene admins con email, usar `billing_email`.

---

## 10. Job diario

`BillingLifecycleJob` con `@Scheduled(cron = "0 0 3 * * *")` (03:00 UTC):

1. **Trial vencido sin suscripción**: `TRIAL` con `trial_ends_at < now()` y sin `stripe_subscription_id` → `PAST_DUE`, `grace_ends_at = trial_ends_at + 10 días`.
2. **Trial vencido con suscripción**: Stripe ya lo gestiona; sincronizar.
3. **Gracia agotada**: `PAST_DUE` con `grace_ends_at < now()` → `SUSPENDED`.
4. **Recordatorios**: trial a 7/3/1 días; gracia a 3/7/10 días.
5. **Cancelaciones vencidas**: `CANCELLED` con `paid_until < now()` → `SUSPENDED`.
6. **Limpieza**: `billing_webhook_event` con `received_at < now() - 90 days`.
7. **Métricas**: contar tenants por estado y emitir gauge.

El job debe ser idempotente y tolerante a fallos por tenant (try/catch individual, seguir con el resto).

---

## 11. Seguridad y cumplimiento

1. **Secretos**: `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` solo en variables de entorno/secret manager. Nunca en el repo.
2. **Webhook**: verificar firma; rechazar peticiones sin `Stripe-Signature` válida.
3. **Idempotencia**: `billing_webhook_event.stripe_event_id` único.
4. **Tarjetas**: el backend nunca ve ni almacena datos de tarjeta. Todo en Stripe.
5. **PCI**: Stripe Checkout/Portal reduce el alcance a SAQ A.
6. **IVA**: Stripe Tax calcula; la factura local debe incluir base, IVA, total y datos fiscales.
7. **Verifactu**: evaluar si aplica a los tenants españoles; si es necesario, integrar con un proveedor de facturación electrónica. No bloquear la fase por ello, pero dejar el campo `invoice_number` y el PDF preparados.
8. **GDPR**: los datos de facturación se conservan 6 años por obligación fiscal; documentar en la política de privacidad.
9. **Auditoría**: registrar cambios manuales de estado con actor, motivo y timestamp.
10. **Kill switch**: `stripe.enabled=false` desactiva checkout/portal, pero no el estado local.

---

## 12. Testing

### Unitarios

- `BillingStateMachine`: todas las transiciones válidas e inválidas.
- `BillingAccessInterceptor`:
  - `EXEMPT` pasa;
  - `ACTIVE` pasa;
  - `TRIAL` pasa y añade cabeceras;
  - `PAST_DUE` pasa y añade cabeceras;
  - `SUSPENDED` bloquea rutas normales;
  - `SUSPENDED` permite `/billing/**`.
- `StripeWebhookService`:
  - firma inválida → 400;
  - evento duplicado → 200 sin reprocesar;
  - `invoice.paid` → `ACTIVE`;
  - `invoice.payment_failed` → `PAST_DUE` + 10 días;
  - `customer.subscription.deleted` → `SUSPENDED`.
- `BillingLifecycleJob`:
  - trial vencido → `PAST_DUE`;
  - gracia vencida → `SUSPENDED`;
  - exento no se suspende;
  - recordatorios no se duplican.

### MVC

- `GET /tenant/{id}/billing/status` accesible en `SUSPENDED`.
- `POST /tenant/{id}/billing/checkout-session` devuelve URL.
- `GET /tenants/{id}/billing` solo superadmin.
- `PUT /tenants/{id}/billing` con `billingExempt=true` exige motivo.

### Integración

- Stripe CLI (`stripe listen --forward-to localhost:8081/api/webhooks/stripe`) para probar webhooks.
- Tarjetas de prueba: `4242 4242 4242 4242` (ok), `4000 0000 0000 0002` (rechazo).
- Probar trial, pago, fallo, gracia, suspensión y reactivación.

### Manual

- Tenant exento no se suspende.
- Tenant suspendido puede pagar y recuperar acceso sin reiniciar.
- Admin recibe email y notificación en cada hito.

---

## 13. Archivos a crear/modificar

### Nuevos

| Archivo | Propósito |
|---|---|
| `config/StripeProperties.java` | Propiedades de Stripe. |
| `config/StripeConfig.java` | Inicialización de `Stripe.apiKey`. |
| `models/entity/SubscriptionEvent.java` | Historial de eventos. |
| `models/entity/SubscriptionInvoice.java` | Facturas locales. |
| `models/entity/BillingWebhookEvent.java` | Idempotencia de webhooks. |
| `models/entity/BillingReminder.java` | Evita emails duplicados. |
| `repository/SubscriptionEventRepository.java` | Eventos. |
| `repository/SubscriptionInvoiceRepository.java` | Facturas. |
| `repository/BillingWebhookEventRepository.java` | Webhooks. |
| `repository/BillingReminderRepository.java` | Recordatorios. |
| `service/billing/BillingStateMachine.java` | Transiciones válidas. |
| `service/billing/TenantBillingService.java` | Lógica de estados, exención, trial. |
| `service/billing/StripeCustomerService.java` | Customer, Checkout, Portal. |
| `service/billing/StripeWebhookService.java` | Procesamiento de eventos. |
| `service/billing/BillingLifecycleJob.java` | Job diario. |
| `service/billing/BillingEmailService.java` | Plantillas y envío. |
| `service/EmailService.java` | Abstracción de proveedor. |
| `security/TenantBillingAccessInterceptor.java` | Bloqueo por estado. |
| `controller/PlatformBillingController.java` | Endpoints superadmin. |
| `controller/TenantBillingController.java` | Endpoints del tenant. |
| `controller/StripeWebhookController.java` | Webhook. |
| `models/dto/billing/*` | DTOs de estado, facturas, configuración. |
| `config/BillingInterceptorConfig.java` | Registro del interceptor. |
| `V48__create_billing_tables.sql` | Migración. |

### Modificados

| Archivo | Cambio |
|---|---|
| `pom.xml` | `stripe-java`, `spring-boot-starter-mail`. |
| `application.yaml` | Bloque `stripe`, `app.billing.email`. |
| `models/entity/Tenant.java` | Campos de billing. |
| `security/HasAccess.java` | Método para admin del tenant si hace falta. |
| `service/PushNotificationService.java` | Tipos de billing. |
| `exception/ErrorResource.java` | `TENANT_SUSPENDED`, `BILLING_*`. |
| `config/TenantInterceptorConfig.java` | Registrar el interceptor de billing después del de tenant. |
| `doc/contrato-api/breaking-changes.md` | Nuevos campos y 403. |

---

## 14. Tareas y estimación

| ID | Tarea | Días |
|---|---|---|
| BILL-01 | Spike Stripe: Checkout, Portal, Tax, webhooks, dunning | 2 |
| BILL-02 | Migración `V48`, columnas de tenant, tablas auxiliares | 1,5 |
| BILL-03 | `StripeProperties` + configuración + dependencia | 0,5 |
| BILL-04 | `BillingStateMachine` + `TenantBillingService` | 2 |
| BILL-05 | `StripeCustomerService` + Checkout + Portal | 3 |
| BILL-06 | `StripeWebhookService` + idempotencia + firma | 2,5 |
| BILL-07 | `TenantBillingAccessInterceptor` + cache + excepciones | 2 |
| BILL-08 | Endpoints superadmin | 2 |
| BILL-09 | Endpoints admin del tenant | 2 |
| BILL-10 | `BillingLifecycleJob` + recordatorios | 2 |
| BILL-11 | `EmailService` + plantillas + notificaciones | 2,5 |
| BILL-12 | Facturas: persistencia, PDF en MinIO, listado | 2 |
| BILL-13 | Tests unitarios + MVC + integración Stripe CLI | 3 |
| BILL-14 | Documento de contrato Angular (`doc/contrato-api/billing/billing-frontend.md`) | 1 |
| **Total backend** | | **28 días** |

Con 1 backend: **5,5–6 semanas** incluyendo margen.

### Frontend Angular

| Tarea | Días |
|---|---|
| Servicio `BillingApiService` + modelos | 1,5 |
| Pantalla de estado de suscripción | 2 |
| Checkout redirect + success/cancel | 1,5 |
| Portal de cliente (redirect) | 1 |
| Banner global de trial/gracia/suspendido | 1,5 |
| Pantalla de facturas + descarga PDF | 1,5 |
| Pantalla de suspensión con acceso a billing | 1 |
| Tests | 1,5 |
| **Total frontend** | **11,5 días** |

---

## 15. Criterios de aceptación

- [ ] Todo tenant nuevo nace en `TRIAL` con 14 días, salvo que sea exento.
- [ ] El tenant de prueba/plataforma está `EXEMPT` y no se suspende.
- [ ] El superadmin puede marcar/desmarcar `billing_exempt` con motivo.
- [ ] El admin del tenant puede abrir Checkout y pagar con tarjeta.
- [ ] El admin puede abrir el Customer Portal y actualizar tarjeta.
- [ ] `invoice.paid` deja el tenant en `ACTIVE` y actualiza `paid_until`.
- [ ] `invoice.payment_failed` deja el tenant en `PAST_DUE` con 10 días de gracia.
- [ ] Durante la gracia el acceso es completo y se envían avisos.
- [ ] Al agotar la gracia, el tenant pasa a `SUSPENDED`.
- [ ] Un tenant suspendido recibe `403 TENANT_SUSPENDED` en rutas normales.
- [ ] Un tenant suspendido **sí** puede acceder a `/billing/**` y pagar.
- [ ] Al pagar, el acceso se restaura sin reiniciar el backend.
- [ ] El webhook verifica firma y es idempotente.
- [ ] Los emails se envían en trial, gracia, suspensión y reactivación.
- [ ] Las notificaciones in-app/push llegan a los admins.
- [ ] Las facturas se listan y su PDF se sirve por URL firmada.
- [ ] `GET /tenants/{id}/billing` solo es accesible por superadmin.
- [ ] Tests pasan y la aplicación compila.
- [ ] `doc/contrato-api/billing/billing-frontend.md` describe el contrato Angular.
- [ ] `doc/contrato-api/breaking-changes.md` documenta los nuevos campos y el 403.

---

## 16. Dependencias internas de la fase

```text
BILL-01  ->  puede hacerse en paralelo con BILL-02
BILL-02  ->  bloquea BILL-04, BILL-05, BILL-06, BILL-10
BILL-04  ->  bloquea BILL-07, BILL-08, BILL-09
BILL-05  ->  depende de BILL-04
BILL-06  ->  depende de BILL-04 y BILL-05
BILL-07  ->  depende de BILL-04
BILL-11  ->  depende de BILL-04 y BILL-06
BILL-12  ->  depende de BILL-06 y de MinIO
BILL-13  ->  al final, con Stripe CLI
```

## 17. Checklist de cierre de fase

- [ ] Stripe configurado en staging con webhook real.
- [ ] Producto y precio de 25 €/mes creados.
- [ ] Tenant de prueba exento verificado.
- [ ] Flujo completo probado: trial → pago → fallo → gracia → suspensión → pago → reactivación.
- [ ] Emails y notificaciones verificados.
- [ ] Facturas PDF verificadas.
- [ ] Middleware probado con rutas exentas.
- [ ] `application.yaml` documenta todas las variables de entorno.
- [ ] `doc/contrato-api/billing/billing-frontend.md` publicado.
- [ ] `doc/contrato-api/breaking-changes.md` actualizado.

---

## 18. Frontend Angular (resumen del contrato)

- `BillingApiService` con `status`, `checkout`, `portal`, `cancel`, `reactivate`, `invoices`.
- Banner global:
  - `TRIAL`: “Te quedan X días de prueba”.
  - `PAST_DUE`: “No hemos podido cobrar. Tienes X días”.
  - `SUSPENDED`: “Suscripción suspendida. Renueva para acceder”.
- En `SUSPENDED`, redirigir a `/billing` y permitir checkout/portal.
- Checkout: `window.location.href = response.url`.
- Portal: `window.location.href = response.url`.
- Facturas: listado + descarga por URL firmada.
- No mostrar datos de tarjeta; solo `brand`, `last4`, `expMonth`, `expYear`.

---

## 19. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Webhook duplicado o fuera de orden | Alto | Idempotencia + consultar Stripe si el evento es ambiguo. |
| Suspensión por error de configuración | Alto | Override manual del superadmin + logs + alertas. |
| Tenant de prueba suspendido | Medio | `billing_exempt=true` por defecto en `admin_tenant`. |
| IVA/factura incorrecta | Alto | Stripe Tax + revisión con asesor fiscal. |
| Emails en spam | Medio | Proveedor transaccional + SPF/DKIM/DMARC. |
| Admin sin acceso en suspensión | Alto | Exención de `/billing/**` + login intacto. |
| Cambio de precio | Medio | `price_id` por suscripción; no mutar suscripciones existentes. |
| Dunning de Stripe no configurado | Medio | Configurar reintentos y emails de Stripe como refuerzo. |
| Verifactu | Medio | Evaluar con asesor; dejar `invoice_number` y PDF preparados. |

---

## 20. Fuera de alcance

- Cobro por cita o comisión por transacción.
- Pagos a nutricionistas.
- Facturación por usuario adicional.
- Planes múltiples o add-ons.
- Cupones y descuentos automáticos (Stripe los soporta, pero no se expone UI en v1).
- Pago anual.
- Cambio de moneda distinto de EUR.
- Domiciliación SEPA como método principal (se puede activar en Stripe sin cambiar código).
- Verifactu completo.
- Portal de partners.
