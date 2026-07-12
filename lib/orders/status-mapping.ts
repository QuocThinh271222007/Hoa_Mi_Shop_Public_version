// Central, defensive mapping from backend order/payment status to the
// customer-facing buckets used by Profile → Lịch sử đơn hàng.
//
// The mapping reads BOTH order.status and order.payment_status so that an order
// is correctly classified no matter which field an admin action updates. In
// particular, a cancelled/failed/expired payment can never remain under
// "Chờ xác nhận" even if order.status was left as 'pending'.

export type CustomerOrderBucket =
  | "pending_confirmation"
  | "waiting_pickup"
  | "shipping"
  | "delivered"
  | "returned"
  | "refunded"
  | "cancelled";

type OrderLike = {
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
};

// order.status values that mean the order is cancelled
const CANCELLED_ORDER_STATUS = new Set(['cancelled', 'canceled']);
// payment_status values that mean the customer will not be charged / order is dead
const CANCELLED_PAYMENT_STATUS = new Set(['cancelled', 'canceled', 'failed', 'expired']);

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();

/** True when the order is cancelled-like via either its order or payment status. */
export function isOrderCancelledLike(order: OrderLike): boolean {
  const s = norm(order.status);
  const p = norm(order.payment_status);
  return CANCELLED_ORDER_STATUS.has(s) || CANCELLED_PAYMENT_STATUS.has(p);
}

/** Classify an order into a single customer-facing bucket. */
export function getCustomerOrderBucket(order: OrderLike): CustomerOrderBucket {
  const s = norm(order.status);
  const p = norm(order.payment_status);

  // 1. Cancelled / failed / expired takes priority — never show as pending.
  if (CANCELLED_ORDER_STATUS.has(s) || CANCELLED_PAYMENT_STATUS.has(p)) return 'cancelled';

  // 2. Refunded (returned + money back) vs. returned-awaiting-refund.
  if (s === 'refunded' || p === 'refunded') return 'refunded';
  if (s === 'returned') return 'returned';

  // 3. Delivered.
  if (s === 'delivered') return 'delivered';

  // 4. In transit — accept legacy/variant names (shipping/shipped/delivering).
  if (s === 'shipping' || s === 'shipped' || s === 'delivering') return 'shipping';

  // 5. Paid & being prepared → waiting for pickup/handover.
  if (p === 'paid' || s === 'confirmed' || s === 'packing' || s === 'packed') return 'waiting_pickup';

  // 6. Default: awaiting payment confirmation.
  return 'pending_confirmation';
}

const BUCKET_LABELS: Record<CustomerOrderBucket, string> = {
  pending_confirmation: 'Chờ xác nhận',
  waiting_pickup:       'Chờ lấy',
  shipping:             'Chờ giao',
  delivered:            'Đã giao',
  returned:             'Chờ hoàn tiền',
  refunded:             'Đã hoàn tiền',
  cancelled:            'Đã hủy',
};

/** Vietnamese customer-facing label for an order. */
export function getCustomerOrderStatusLabel(order: OrderLike): string {
  return BUCKET_LABELS[getCustomerOrderBucket(order)];
}

// Maps a bucket onto the existing Profile STATUS_TABS keys so the current tab
// UI keeps working without being redesigned. The 'packing' tab receives no
// bucket and simply shows zero.
const BUCKET_TO_TAB: Record<CustomerOrderBucket, string> = {
  pending_confirmation: 'pending',
  waiting_pickup:       'confirmed',
  shipping:             'shipping',
  delivered:            'delivered',
  returned:             'returned',
  refunded:             'returned',
  cancelled:            'cancelled',
};

/** The Profile tab key an order should appear under. */
export function getCustomerOrderTabKey(order: OrderLike): string {
  return BUCKET_TO_TAB[getCustomerOrderBucket(order)];
}

// ── Admin-side mapping ───────────────────────────────────────────────────
// Admin sees the same lifecycle buckets as the customer plus the explicit
// "preparing" stage. Both views derive from this file so they can never disagree.

export type AdminOrderBucket =
  | "pending_confirmation"
  | "confirmed"
  | "preparing"
  | "shipping"
  | "delivered"
  | "returned"
  | "refunded"
  | "cancelled";

export function getAdminOrderBucket(order: OrderLike): AdminOrderBucket {
  const s = norm(order.status);
  const p = norm(order.payment_status);

  if (CANCELLED_ORDER_STATUS.has(s) || CANCELLED_PAYMENT_STATUS.has(p)) return 'cancelled';
  if (s === 'refunded' || p === 'refunded') return 'refunded';
  if (s === 'returned') return 'returned';
  if (s === 'delivered') return 'delivered';
  if (s === 'shipping' || s === 'shipped' || s === 'delivering') return 'shipping';
  if (s === 'packing' || s === 'packed') return 'preparing';
  if (s === 'confirmed' || p === 'paid') return 'confirmed';
  return 'pending_confirmation';
}

const ADMIN_BUCKET_LABELS: Record<AdminOrderBucket, string> = {
  pending_confirmation: 'Chờ xác nhận',
  confirmed:            'Đã xác nhận / Chờ lấy',
  preparing:            'Đang chuẩn bị',
  shipping:             'Đang giao',
  delivered:            'Đã giao',
  returned:             'Trả hàng / Chờ hoàn tiền',
  refunded:             'Đã hoàn tiền',
  cancelled:            'Đã hủy',
};

export function getAdminOrderStatusLabel(order: OrderLike): string {
  return ADMIN_BUCKET_LABELS[getAdminOrderBucket(order)];
}

// ── Admin action capability guards ───────────────────────────────────────
// Drive which lifecycle buttons are offered. They are advisory (the underlying
// server actions remain authoritative and idempotent).
//
// Separation of concerns (see admin-order-management-flow.md):
//   • Order lifecycle  → managed on the Orders page (this stays payment-agnostic
//     for COD so a COD order can move confirm → prepare → ship → deliver without
//     any prior payment).
//   • Payment confirm  → done on the Payments page. For COD the money is collected
//     on delivery, so confirming payment sits at the END of the flow.

const isPaid = (o: OrderLike) => norm(o.payment_status) === 'paid';
/** True when the order is Cash-on-Delivery (pay on receipt). */
export function isCodOrder(o: OrderLike): boolean {
  return norm(o.payment_method) === 'cod';
}

// ── Order lifecycle (Orders page) ──────────────────────────────────────────

/**
 * Accept a brand-new order (pending → confirmed) from the Orders page.
 * Only COD orders are confirmed here — bank-transfer orders become 'confirmed'
 * automatically when their payment is confirmed on the Payments page.
 */
export function canAdminConfirmOrder(order: OrderLike): boolean {
  return isCodOrder(order) && getAdminOrderBucket(order) === 'pending_confirmation';
}
export function canAdminCancelOrder(order: OrderLike): boolean {
  const b = getAdminOrderBucket(order);
  return b !== 'cancelled' && b !== 'delivered' && b !== 'returned';
}
// Bank-transfer orders still require a confirmed payment before they can be
// packed/shipped; COD orders are exempt (money arrives on delivery).
export function canAdminMarkPacking(order: OrderLike): boolean {
  return getAdminOrderBucket(order) === 'confirmed' && (isCodOrder(order) || isPaid(order));
}
export function canAdminMarkShipped(order: OrderLike): boolean {
  const b = getAdminOrderBucket(order);
  return (b === 'confirmed' || b === 'preparing') && (isCodOrder(order) || isPaid(order));
}
export function canAdminMarkDelivered(order: OrderLike): boolean {
  return getAdminOrderBucket(order) === 'shipping';
}
export function canAdminMarkReturned(order: OrderLike): boolean {
  const b = getAdminOrderBucket(order);
  return b === 'delivered' || b === 'shipping';
}

/** Mark a returned order as fully refunded (money sent back to customer). */
export function canAdminMarkRefunded(order: OrderLike): boolean {
  return getAdminOrderBucket(order) === 'returned';
}

// ── Payment confirmation (Payments page) ─────────────────────────────────────

export function canAdminConfirmPayment(order: OrderLike): boolean {
  if (isPaid(order) || isOrderCancelledLike(order)) return false;
  // COD: cash is collected on delivery, so payment can only be confirmed once the
  // order is out for delivery or already delivered — the payment step is LAST.
  if (isCodOrder(order)) {
    const b = getAdminOrderBucket(order);
    return b === 'shipping' || b === 'delivered';
  }
  return true;
}
export function canAdminMarkFailed(order: OrderLike): boolean {
  return !isPaid(order) && !isOrderCancelledLike(order);
}
