import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { getConfiguredTimeZone, zonedDayStartUtcIso, zonedDayEndUtcIso } from '@/lib/time';
import { assertOrderStatus, normalizeOrderStatus, assertOrderPaymentStatus } from '@/lib/orders/order-flow';
import { generatePaymentCode } from '@/lib/payments/payment-code';
import { applyOrderStock } from './order-stock';
import type { AdminOrder, AdminOrderItem } from './types';

const ORDER_FIELDS =
  'id, user_id, customer_name, customer_phone, customer_email, shipping_address, pickup_time, subtotal, shipping_fee, discount_amount, total_amount, discount_code, payment_method, payment_status, payment_code, paid_at, bank_transaction_id, status, order_note, admin_note, confirmed_at, packed_at, shipped_at, delivered_at, cancelled_at, cancel_requested_at, cancel_reason, estimated_delivery_min_at, estimated_delivery_max_at, created_at, updated_at';

export async function getOrders(filters?: {
  status?: string;
  paymentStatus?: string;
  method?: string;
  delivery?: string; // 'pickup' | 'delivery' | 'all'
  search?: string;
  dateFrom?: string; // 'YYYY-MM-DD' (inclusive), interpreted in configured timezone
  dateTo?: string;   // 'YYYY-MM-DD' (inclusive), interpreted in configured timezone
  pickupDate?: string;     // 'YYYY-MM-DD' — matches the pickup_time day
  pickupTimeFrom?: string; // 'HH:MM' — earliest pickup clock time (inclusive)
  pickupTimeTo?: string;   // 'HH:MM' — latest pickup clock time (inclusive)
}): Promise<AdminOrder[]> {
  const db = createAdminSupabaseClient();

  // Date-range filter interprets the chosen wall-clock days in the store's
  // configured timezone (site_timezone), then maps to UTC bounds on created_at.
  let timeZone: string | undefined;
  if (filters?.dateFrom || filters?.dateTo) {
    const { data: tzRow } = await db
      .from('site_settings')
      .select('value')
      .eq('key', 'site_timezone')
      .maybeSingle();
    timeZone = getConfiguredTimeZone({ site_timezone: (tzRow as { value?: string } | null)?.value });
  }

  let query = db
    .from('orders')
    .select(ORDER_FIELDS)
    .order('created_at', { ascending: false })
    .limit(100);

  // Only orders that have entered fulfilment appear here:
  //   • COD → immediately (paid on delivery), or
  //   • bank/QR → once payment is confirmed (paid/refunded).
  // Unpaid bank/QR orders stay in Payments until confirmed.
  query = query.or('payment_method.eq.cod,payment_status.eq.paid,payment_status.eq.refunded');

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
    query = query.eq('payment_status', filters.paymentStatus);
  }
  // Payment method: 'cod' vs everything-else ('bank_transfer' = chuyển khoản/QR).
  if (filters?.method && filters.method !== 'all') {
    if (filters.method === 'cod') {
      query = query.eq('payment_method', 'cod');
    } else if (filters.method === 'bank_transfer') {
      query = query.neq('payment_method', 'cod');
    }
  }
  // Delivery mode: pickup (pickup_time IS NOT NULL) vs delivery (pickup_time IS NULL).
  if (filters?.delivery && filters.delivery !== 'all') {
    if (filters.delivery === 'pickup') {
      query = query.not('pickup_time', 'is', null);
    } else if (filters.delivery === 'delivery') {
      query = query.is('pickup_time', null);
    }
  }
  // Created-date range (inclusive of both ends, in the configured timezone).
  if (filters?.dateFrom) {
    const fromIso = zonedDayStartUtcIso(filters.dateFrom, timeZone);
    if (fromIso) query = query.gte('created_at', fromIso);
  }
  if (filters?.dateTo) {
    const toIso = zonedDayEndUtcIso(filters.dateTo, timeZone);
    if (toIso) query = query.lt('created_at', toIso);
  }
  if (filters?.search) {
    // Search by customer name/phone OR the order code (= payment_code / transfer note).
    const s = filters.search.trim().replace(/[%,()]/g, '');
    query = query.or(
      `customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,payment_code.ilike.%${s}%`
    );
  }
  // Pickup DATE — pickup_time is stored as text ("14h52 - 03/07/2026"), so match the
  // dd/mm/yyyy substring. This also implicitly limits to pickup orders (non-null).
  if (filters?.pickupDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.pickupDate);
    if (m) {
      const ddmmyyyy = `${m[3]}/${m[2]}/${m[1]}`;
      query = query.ilike('pickup_time', `%${ddmmyyyy}%`);
    }
  }
  const { data } = await query;
  // Cast via unknown: the generated Supabase types don't yet include the additive
  // pickup_time column (migration 20260701_order_pickup_time.sql), so the typed
  // select widens to a SelectQueryError. The column exists at runtime.
  let rows = (data ?? []) as unknown as AdminOrder[];

  // Pickup TIME range — text times ("8h30" vs "14h52") don't compare correctly in
  // SQL, so parse the leading clock time and filter in the app layer.
  const fromM = parseClockMinutes(filters?.pickupTimeFrom);
  const toM = parseClockMinutes(filters?.pickupTimeTo);
  if (fromM != null || toM != null) {
    rows = rows.filter((o) => {
      const t = leadingClockMinutes((o as { pickup_time?: string | null }).pickup_time ?? null);
      if (t == null) return false;
      if (fromM != null && t < fromM) return false;
      if (toM != null && t > toM) return false;
      return true;
    });
  }
  return rows;
}

/** Parses a native "HH:MM" input into minutes-since-midnight, or null. */
function parseClockMinutes(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? '').trim());
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Extracts the leading clock time from a stored pickup_time ("14h52 - 03/07/2026"). */
function leadingClockMinutes(s: string | null): number | null {
  if (!s) return null;
  const m = /(\d{1,2})\s*[h:]\s*(\d{2})?/.exec(s);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Minimal lifecycle snapshot keyed by order id — used by the Payments page to
 * gate payment-confirmation buttons (esp. COD, which is confirmable only once the
 * order is out for delivery / delivered).
 */
export async function getOrderLifecycleMap(
  orderIds: string[]
): Promise<Map<string, { status: string | null; payment_status: string | null; payment_method: string | null }>> {
  const map = new Map<string, { status: string | null; payment_status: string | null; payment_method: string | null }>();
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  if (ids.length === 0) return map;
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('orders')
    .select('id, status, payment_status, payment_method')
    .in('id', ids);
  for (const row of (data ?? []) as { id: string; status: string | null; payment_status: string | null; payment_method: string | null }[]) {
    map.set(row.id, { status: row.status, payment_status: row.payment_status, payment_method: row.payment_method });
  }
  return map;
}

export interface ManualOrderItemInput {
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
}

export interface ManualOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  shippingAddress: string;
  pickupTime?: string | null;
  paymentMethod: 'cod' | 'bank_transfer';
  paid: boolean;
  shippingFee: number;
  items: ManualOrderItemInput[];
  adminNote?: string | null;
}

/**
 * Admin-created order (phone/in-person sale). Created as 'confirmed' so it goes
 * straight into fulfilment. Bank orders can be flagged paid; COD stays awaiting
 * (collected on delivery). Returns the new order id.
 */
export async function createManualOrder(input: ManualOrderInput): Promise<string> {
  const db = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const subtotal = input.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const shippingFee = Number.isFinite(input.shippingFee) ? Math.max(0, input.shippingFee) : 0;
  const total = subtotal + shippingFee;
  const isCod = input.paymentMethod === 'cod';
  const paid = !isCod && input.paid;

  const { data: order, error } = await db
    .from('orders')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail || null,
      shipping_address: input.shippingAddress,
      pickup_time: input.pickupTime || null,
      subtotal,
      shipping_fee: shippingFee,
      total_amount: total,
      payment_method: input.paymentMethod,
      payment_status: paid ? 'paid' : 'awaiting_payment',
      paid_at: paid ? now : null,
      status: 'confirmed',
      confirmed_at: now,
      admin_note: input.adminNote || null,
      // Give admin-created orders a real order code (same DH+8 format as web
      // orders) so the admin list shows a proper code, not a truncated UUID.
      payment_code: generatePaymentCode(),
    } as any)
    .select('id')
    .single();
  if (error || !order) throw new Error(error?.message ?? 'Không thể tạo đơn hàng.');

  const orderId = (order as { id: string }).id;
  const rows = input.items.map((it) => ({
    order_id: orderId,
    product_id: it.productId,
    product_name: it.productName,
    unit_price: it.unitPrice,
    quantity: it.quantity,
  }));
  const { error: itemsErr } = await db.from('order_items').insert(rows);
  if (itemsErr) throw new Error(itemsErr.message);

  // Admin manual orders enter fulfilment immediately → deduct stock now.
  await applyOrderStock(orderId, 'deduct');

  return orderId;
}

export async function getOrderById(id: string): Promise<AdminOrder | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('orders').select(ORDER_FIELDS).eq('id', id).single();
  return (data as unknown as AdminOrder) ?? null;
}

export async function getOrderItems(orderId: string): Promise<AdminOrderItem[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('order_items')
    .select('id, order_id, product_id, product_name, unit_price, quantity')
    .eq('order_id', orderId);
  return (data ?? []) as AdminOrderItem[];
}

export async function updateOrderStatus(orderId: string, rawStatus: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const now = new Date().toISOString();

  // Normalize legacy spellings then fail fast on anything outside the canonical
  // set so we never hit the DB orders_status_check constraint at runtime.
  const status = normalizeOrderStatus(rawStatus);
  assertOrderStatus(status);

  // Fetch current lifecycle timestamps to avoid overwriting already-set values.
  const { data: current } = await db
    .from('orders')
    .select('confirmed_at, packed_at, shipped_at, delivered_at, cancelled_at, returned_at, payment_status')
    .eq('id', orderId)
    .single();

  const cur = (current ?? {}) as {
    confirmed_at: string | null;
    packed_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    cancelled_at: string | null;
    returned_at: string | null;
    payment_status: string | null;
  };

  const updates: Record<string, unknown> = { status, updated_at: now };
  if (status === 'confirmed'  && !cur.confirmed_at)  updates.confirmed_at  = now;
  if (status === 'packing'    && !cur.packed_at)      updates.packed_at     = now;
  if (status === 'shipped'    && !cur.shipped_at)     updates.shipped_at    = now; // legacy shipping/delivering normalized to shipped
  if (status === 'delivered'  && !cur.delivered_at)   updates.delivered_at  = now;
  if ((status === 'returned' || status === 'refunded') && !cur.returned_at) updates.returned_at = now;
  if (status === 'cancelled'  && !cur.cancelled_at)   updates.cancelled_at  = now;

  // Cancelling an unpaid/awaiting order also cancels its payment so the order
  // never lingers under "Chờ xác nhận" in the customer's history.
  const unpaid = !cur.payment_status ||
    ['awaiting_payment', 'awaiting_verification', 'pending', 'failed', 'expired'].includes(cur.payment_status);
  if (status === 'cancelled' && unpaid) {
    updates.payment_status = 'cancelled';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('orders').update(updates as any).eq('id', orderId);
  if (error) throw new Error(error.message);

  // Cancel any still-open payment requests for this order.
  if (status === 'cancelled') {
    const openStatuses = ['awaiting_payment', 'awaiting_verification', 'pending'];
    // Core status update (guaranteed columns).
    await db.from('payment_requests')
      .update({ status: 'cancelled', updated_at: now })
      .eq('order_id', orderId)
      .in('status', openStatuses);
    // Best-effort timestamp — cancelled_at may be absent on older DBs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('payment_requests') as any)
      .update({ cancelled_at: now })
      .eq('order_id', orderId)
      .eq('status', 'cancelled');

    // Give stock back (only if it was previously deducted — idempotent).
    await applyOrderStock(orderId, 'restore');
  }
}

export async function updatePaymentStatus(orderId: string, paymentStatus: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const now = new Date().toISOString();

  // Guard against writing an out-of-vocabulary payment status.
  assertOrderPaymentStatus(paymentStatus);

  const { data: current } = await db
    .from('orders')
    .select('status, paid_at, confirmed_at, cancelled_at')
    .eq('id', orderId)
    .single();
  const cur = (current ?? {}) as {
    status: string | null; paid_at: string | null;
    confirmed_at: string | null; cancelled_at: string | null;
  };

  const updates: Record<string, unknown> = { payment_status: paymentStatus, updated_at: now };

  if (paymentStatus === 'paid') {
    if (!cur.paid_at) updates.paid_at = now;
    // Move a still-pending order forward to confirmed (don't regress later states).
    if (!cur.status || cur.status === 'pending') {
      updates.status = 'confirmed';
      if (!cur.confirmed_at) updates.confirmed_at = now;
    }
  }

  // Cancelled/failed/expired payment must take the order out of "Chờ xác nhận"
  // (unless it has already shipped/delivered).
  if (['cancelled', 'failed', 'expired'].includes(paymentStatus)) {
    const advanced = cur.status === 'delivered' || cur.status === 'shipped' || cur.status === 'shipping';
    if (!advanced) {
      updates.status = 'cancelled';
      if (!cur.cancelled_at) updates.cancelled_at = now;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('orders').update(updates as any).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function updateAdminNote(orderId: string, adminNote: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('orders')
    .update({ admin_note: adminNote || null, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
}
