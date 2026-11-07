/**
 * Facturación por centro (Fase 0B). El backend cobra una suscripción mensual
 * fija por tenant y bloquea el tráfico de negocio cuando lleva 10 días impagada.
 *
 * Contrato: `doc/contrato-api/billing/billing-frontend.md`.
 */

/** Estado de la suscripción del centro. Solo `SUSPENDED` bloquea el acceso. */
export type BillingStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'EXEMPT'
  | 'CANCELLED';

/** Qué cuenta atrás representa `daysLeft`. */
export type BillingCountdownKind = 'TRIAL' | 'GRACE' | 'PAID_UNTIL';

export type BillingInvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';

export interface BillingPaymentMethod {
  /** Marca de la tarjeta tal y como la devuelve Stripe (`visa`, `mastercard`…). */
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface BillingInvoice {
  id: string;
  number: string | null;
  amountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  status: BillingInvoiceStatus;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  /**
   * URL firmada de MinIO con 1 h de caducidad y **sin** comprobación de permisos:
   * para descargar usa `BillingService.downloadInvoice()`, que sí audita el acceso.
   */
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
  /** Días naturales UTC ya calculados por el backend: **no** recalcular en el cliente. */
  daysLeft: number | null;
  countdownKind: BillingCountdownKind | null;
  cancelAtPeriodEnd: boolean;
  billingEmail: string | null;
  paymentMethod: BillingPaymentMethod | null;
  invoices: BillingInvoice[];
}

/** Respuesta de los endpoints que delegan en una pasarela alojada por Stripe. */
export interface BillingRedirect {
  url: string;
}

/** Cabeceras que acompañan a toda respuesta bajo `/api/tenant/{tenantId}/**`. */
export const BILLING_STATUS_HEADER = 'X-Billing-Status';
export const BILLING_TRIAL_ENDS_HEADER = 'X-Billing-Trial-Ends-At';
export const BILLING_GRACE_ENDS_HEADER = 'X-Billing-Grace-Ends-At';

/** Código del `ProblemDetail` que devuelve un tenant suspendido en cualquier endpoint de negocio. */
export const TENANT_SUSPENDED_CODE = 'TENANT_SUSPENDED';

/**
 * Códigos de error propios de facturación. Se traducen con
 * `billing.errors.<code>`; cualquier otro cae en el mensaje genérico.
 */
export const BILLING_ERROR_CODES = [
  'TENANT_SUSPENDED',
  'BILLING_DISABLED',
  'BILLING_EXEMPT_TENANT',
  'BILLING_CHECKOUT_NOT_ALLOWED',
  'BILLING_INVALID_TRANSITION',
  'BILLING_CUSTOMER_REQUIRED',
] as const;

export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[number];

export function isBillingStatus(value: unknown): value is BillingStatus {
  return (
    value === 'TRIAL' ||
    value === 'ACTIVE' ||
    value === 'PAST_DUE' ||
    value === 'SUSPENDED' ||
    value === 'EXEMPT' ||
    value === 'CANCELLED'
  );
}

// ── Panel de superadmin ───────────────────────────────────────────────────
// Base `/api/tenants`, permiso de plataforma `MANAGE_TENANT`.
// Contrato: `doc/roadmap/plan-mejoras/fase-0b-suscripciones.md` §8.1.

/**
 * Vista de facturación de un centro para el superadmin. A diferencia de
 * `BillingStatusResponse`, aquí **sí** salen los ids de Stripe.
 */
export interface TenantBillingAdminDto {
  tenantId: string;
  tenantName: string;
  billingStatus: BillingStatus;
  billingExempt: boolean;
  priceCents: number;
  currency: string;
  trialEndsAt: string | null;
  paidUntil: string | null;
  graceEndsAt: string | null;
  suspendedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  billingEmail: string | null;
}

/**
 * `PUT /tenants/{id}/billing`. Solo viajan los campos que se tocan.
 *
 * - `priceCents` afecta únicamente a suscripciones nuevas: las existentes
 *   conservan su `price_id` de Stripe.
 * - `trialDays` solo se aplica si el centro está en `TRIAL` o se llama a `/trial`.
 * - `billingExempt: true` **exige** `reason`.
 */
export interface UpdateTenantBillingRequest {
  billingExempt?: boolean;
  priceCents?: number;
  trialDays?: number;
  billingEmail?: string;
  reason?: string;
}

/** Cuerpo de las acciones manuales de override (`/trial`, `/suspend`, `/reactivate`). */
export interface BillingOverrideRequest {
  /** Días de prueba a conceder. Solo lo usa `/trial`. */
  days?: number;
  /** Queda registrado junto a quién hizo el override. */
  reason?: string;
}

/**
 * Tipos de `subscription_event` conocidos hoy. El campo del DTO es `string` a
 * propósito: el backend puede añadir tipos y la tabla no debe romperse por uno
 * que aún no conocemos (se enseña el código en crudo).
 */
export const SUBSCRIPTION_EVENT_TYPES = [
  'TRIAL_STARTED',
  'TRIAL_ENDING',
  'TRIAL_ENDED',
  'CHECKOUT_COMPLETED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'GRACE_STARTED',
  'GRACE_ENDING',
  'SUSPENDED',
  'REACTIVATED',
  'CANCELLED',
  'EXEMPTED',
  'MANUAL_OVERRIDE',
] as const;

export type KnownSubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number];

export interface SubscriptionEvent {
  id: string;
  type: string;
  occurredAt: string;
  stripeEventId: string | null;
  metadata: Record<string, unknown>;
}

/** Estados por los que el panel de superadmin permite filtrar. */
export const BILLING_STATUSES: readonly BillingStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'EXEMPT',
  'CANCELLED',
];
