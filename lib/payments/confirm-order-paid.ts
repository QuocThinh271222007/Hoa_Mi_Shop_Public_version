// SERVER-ONLY. Single source of truth for "an order became paid".
//
// Every path that confirms payment (SePay webhook, customer confirm, admin manual
// match, admin mark-paid, admin set payment_status) must go through here so the
// side effects are ALWAYS applied together and consistently:
//   1. order → paid/confirmed        (never regresses an already-advanced status)
//   2. payment_request → paid        (when one is supplied)
//   3. discount usage counted        (idempotent)
//   4. stock deducted                (idempotent via inventory_movements)
//   5. GA4 purchase sent             (idempotent via orders.ga_purchase_sent_at)
//
// This closes the F4 gap where updatePaymentStatus() marked an order paid without
// deducting stock or counting discount usage.

import type { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { countDiscountUsageForPaidOrder } from '@/lib/payments/discount-usage';
import { applyOrderStock } from '@/lib/admin/order-stock';
import { sendPurchaseForOrder } from '@/lib/analytics/ga-server';

type Db = ReturnType<typeof createAdminSupabaseClient>;

export interface ConfirmPaidOptions {
  paymentRequestId?: string | null;
  transactionId?: string | null;
  adminNote?: string | null;
}

export async function confirmOrderPaid(
  db: Db,
  orderId: string,
  opts: ConfirmPaidOptions = {},
): Promise<void> {
  const now = new Date().toISOString();

  const { data: ord } = await db
    .from('orders')
    .select('payment_status, status, paid_at, confirmed_at')
    .eq('id', orderId)
    .single();
  const o = (ord ?? {}) as {
    payment_status: string | null;
    status: string | null;
    paid_at: string | null;
    confirmed_at: string | null;
  };

  // Only rewrite the money/lifecycle columns the first time (don't regress a
  // later fulfilment status or overwrite the original paid_at).
  if (o.payment_status !== 'paid') {
    const updates: Record<string, unknown> = {
      payment_status: 'paid',
      updated_at: now,
    };
    if (!o.paid_at) updates.paid_at = now;
    if (opts.transactionId) updates.bank_transaction_id = opts.transactionId;
    if (!o.status || o.status === 'pending') {
      updates.status = 'confirmed';
      if (!o.confirmed_at) updates.confirmed_at = now;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await db.from('orders').update(updates as any).eq('id', orderId);
    if (error) throw new Error(error.message);
  }

  if (opts.paymentRequestId) {
    const prUpdates: Record<string, unknown> = { status: 'paid', paid_at: now, updated_at: now };
    if (opts.transactionId) prUpdates.matched_transaction_id = opts.transactionId;
    if (opts.adminNote) prUpdates.admin_note = opts.adminNote;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.from('payment_requests').update(prUpdates as any).eq('id', opts.paymentRequestId);
  }

  // Side effects — each is independently idempotent, so re-running confirm on an
  // already-paid order is harmless.
  await countDiscountUsageForPaidOrder(orderId);
  await applyOrderStock(orderId, 'deduct');
  await sendPurchaseForOrder(db, orderId);
}
