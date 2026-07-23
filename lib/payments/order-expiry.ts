import 'server-only';
// Order recording window (P1).
//
// `payment_requests.expires_at` (~30 min) is only the AUTO-CONFIRM window used by
// the SePay matcher. It must NOT decide when an order dies: the shop admin is not
// online 24/7, so a customer who transfers late — or a transfer that needs manual
// review — still deserves to be honoured.
//
// So an unpaid order is kept for a GRACE PERIOD (3 days) during which:
//   • the customer can still press "Tôi đã chuyển khoản",
//   • admin can still confirm it manually,
//   • it still holds its discount-code slot.
// After the grace period it is cancelled, which also releases the discount slot
// and clears the admin Payments queue.

import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { updateOrderStatus } from '@/lib/admin/orders-data';

export const ORDER_RECORDING_GRACE_DAYS = 3;

/** Statuses that mean "created but not settled yet". */
export const UNSETTLED_PAYMENT_STATUSES = ['awaiting_payment', 'awaiting_verification'] as const;

/** ISO timestamp of the oldest moment an unpaid order is still considered alive. */
export function recordingGraceCutoffIso(days: number = ORDER_RECORDING_GRACE_DAYS): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** True when an order created at `createdAt` has outlived the grace period. */
export function isBeyondRecordingGrace(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now() - ORDER_RECORDING_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Cancels ABANDONED bank/QR checkouts older than the grace period.
 *
 * Deliberately narrow — an order is only swept when ALL of these hold:
 *   • payment is still unsettled (awaiting_payment / awaiting_verification),
 *   • it is NOT a COD order (COD stays unpaid until cash is collected — it is
 *     not abandoned, and sweeping it cancels live deliveries),
 *   • the order is still `pending` (never touch confirmed/packing/shipped),
 *   • it has no pickup date in the future (that is a live booking),
 *   • it is older than the grace period.
 *
 * Reuses updateOrderStatus so each order goes through the normal cancel path
 * (payment_status → cancelled, cancelled_at set, open payment_requests cancelled,
 * stock restored — a no-op for orders that were never deducted), then stamps
 * admin_note so the cancellation is attributable.
 *
 * Idempotent and safe to run repeatedly. Returns how many orders were cancelled.
 */
export async function expireStaleAwaitingOrders(
  days: number = ORDER_RECORDING_GRACE_DAYS,
): Promise<number> {
  try {
    const db = createAdminSupabaseClient();
    const cutoff = recordingGraceCutoffIso(days);

    const { data } = await db
      .from('orders')
      .select('id, pickup_time, admin_note')
      .in('payment_status', UNSETTLED_PAYMENT_STATUSES as unknown as string[])
      .lt('created_at', cutoff)
      // COD is NEVER "unpaid and abandoned": a COD order legitimately sits in
      // awaiting_payment until the courier collects cash on delivery. Only
      // bank/QR orders can be abandoned by not transferring.
      .neq('payment_method', 'cod')
      // Never auto-cancel an order that has already entered fulfilment —
      // confirmed/packing/shipped orders are the shop's commitment, not a
      // forgotten checkout.
      .eq('status', 'pending')
      .limit(200);

    // Cast via unknown: pickup_time is additive (migration 20260701_order_pickup_time.sql)
    // and missing from the generated Supabase types, which widens the select result.
    const rows = (data ?? []) as unknown as { id: string; pickup_time: string | null; admin_note: string | null }[];

    let cancelled = 0;
    for (const row of rows) {
      // A pickup order whose collection date is still ahead is a live booking —
      // the customer simply hasn't paid yet and will pay at/near pickup.
      if (hasFuturePickup(row.pickup_time)) continue;

      try {
        await updateOrderStatus(row.id, 'cancelled');
        // Leave a trail so nobody has to guess who cancelled it (this exact
        // ambiguity is what made an earlier mis-scoped sweep so hard to diagnose).
        const stamp = `[Tự động hủy ${new Date().toISOString()}] Quá ${days} ngày chưa thanh toán (đơn chuyển khoản/QR).`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db.from('orders') as any)
          .update({ admin_note: row.admin_note ? `${row.admin_note}\n${stamp}` : stamp })
          .eq('id', row.id);
        cancelled++;
      } catch {
        /* skip this order, keep going */
      }
    }
    return cancelled;
  } catch {
    return 0;
  }
}

/**
 * True when a stored pickup_time ("14h52 - 27/07/2026") refers to a day that has
 * not passed yet. Unparseable/absent values return false (treated as no booking).
 */
function hasFuturePickup(pickupTime: string | null | undefined): boolean {
  if (!pickupTime) return false;
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(pickupTime);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !month || !year) return false;
  // End of the pickup day, so "today" still counts as future.
  const endOfPickupDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  return endOfPickupDay >= Date.now();
}
