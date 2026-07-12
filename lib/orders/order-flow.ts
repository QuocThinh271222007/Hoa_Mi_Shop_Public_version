// SERVER-ONLY canonical status vocabulary + runtime guards.
// One source of truth for the slugs allowed by the DB check constraints
// (see supabase/migrations/20260624_unify_order_payment_status_constraints.sql).
// Importing these guards before any orders/payment_requests write means an
// invalid value fails fast with a clear developer error instead of surfacing as
// an opaque Postgres "violates check constraint" runtime error.

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'packing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PAYMENT_STATUSES = [
  'awaiting_payment',
  'awaiting_verification',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'refunded',
] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const PAYMENT_REQUEST_STATUSES = [
  'awaiting_payment',
  'awaiting_verification',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'matched_pending_admin',
] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

export function isOrderStatus(v: string): v is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(v);
}
export function isOrderPaymentStatus(v: string): v is OrderPaymentStatus {
  return (ORDER_PAYMENT_STATUSES as readonly string[]).includes(v);
}
export function isPaymentRequestStatus(v: string): v is PaymentRequestStatus {
  return (PAYMENT_REQUEST_STATUSES as readonly string[]).includes(v);
}

export function assertOrderStatus(status: string): asserts status is OrderStatus {
  if (!isOrderStatus(status)) {
    throw new Error(
      `Invalid order status: "${status}". Allowed: ${ORDER_STATUSES.join(', ')}`
    );
  }
}
export function assertOrderPaymentStatus(status: string): asserts status is OrderPaymentStatus {
  if (!isOrderPaymentStatus(status)) {
    throw new Error(
      `Invalid order payment status: "${status}". Allowed: ${ORDER_PAYMENT_STATUSES.join(', ')}`
    );
  }
}

// Normalizes legacy spellings to canonical slugs (mirrors the SQL migration), so
// any value that slips through from older data/UI is corrected before a write.
export function normalizeOrderStatus(status: string): OrderStatus {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'canceled') return 'cancelled';
  if (s === 'shipping' || s === 'delivering') return 'shipped';
  if (s === 'packed') return 'packing';
  return (isOrderStatus(s) ? s : 'pending') as OrderStatus;
}
