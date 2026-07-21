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
 * Cancels unpaid orders older than the grace period.
 *
 * Reuses updateOrderStatus so each order goes through the normal cancel path
 * (payment_status → cancelled, cancelled_at set, open payment_requests cancelled,
 * stock restored — a no-op for orders that were never deducted).
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
      .select('id')
      .in('payment_status', UNSETTLED_PAYMENT_STATUSES as unknown as string[])
      .lt('created_at', cutoff)
      .limit(200);

    const rows = (data ?? []) as { id: string }[];
    let cancelled = 0;
    for (const row of rows) {
      try {
        await updateOrderStatus(row.id, 'cancelled');
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
