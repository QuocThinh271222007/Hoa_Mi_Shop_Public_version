'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import {
  updateOrderStatus,
  updatePaymentStatus,
  updateAdminNote,
  createManualOrder,
  type ManualOrderItemInput,
} from '@/lib/admin/orders-data';
import { countDiscountUsageForPaidOrder } from '@/lib/payments/discount-usage';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { applyOrderStock } from '@/lib/admin/order-stock';
import { generatePaymentCode } from '@/lib/payments/payment-code';
import { sendRefundForOrder, sendOrderCustomEvent } from '@/lib/analytics/ga-server';

export async function actionUpdateOrderStatus(formData: FormData) {
  await requireAdmin();
  const orderId = formData.get('orderId') as string;
  const status  = formData.get('status') as string;
  if (!orderId || !status) return;
  await updateOrderStatus(orderId, status);
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function actionUpdatePaymentStatus(formData: FormData) {
  await requireAdmin();
  const orderId       = formData.get('orderId') as string;
  const paymentStatus = formData.get('paymentStatus') as string;
  if (!orderId || !paymentStatus) return;
  // updatePaymentStatus routes a 'paid' status through confirmOrderPaid, which
  // applies stock/discount side effects and the GA4 purchase exactly once.
  await updatePaymentStatus(orderId, paymentStatus);
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
}

// Hard-delete an order and its items. Restores stock if the order was fulfilled.
// Only allowed for cancelled orders or as an explicit admin override.
export async function actionDeleteOrder(formData: FormData) {
  await requireAdmin();
  const orderId = formData.get('orderId') as string;
  if (!orderId) return;

  const db = createAdminSupabaseClient();
  // Fetch status before deleting so we know whether to restore stock.
  const { data: order } = await db
    .from('orders')
    .select('status, payment_status')
    .eq('id', orderId)
    .single();

  const o = order as { status: string; payment_status: string } | null;
  const stockWasDeducted = o && !['pending', 'cancelled'].includes(o.status);

  // Restore stock first (idempotent — skips if never deducted).
  if (stockWasDeducted) {
    await applyOrderStock(orderId, 'restore');
  }

  // Delete items then order (FK cascade may handle items, but explicit is safer).
  await db.from('order_items').delete().eq('order_id', orderId);
  await db.from('orders').delete().eq('id', orderId);

  revalidatePath('/admin/orders');
  redirect('/admin/orders');
}

// Mark an order as returned (customer sent goods back, refund not yet issued).
export async function actionMarkReturned(formData: FormData) {
  await requireAdmin();
  const orderId = formData.get('orderId') as string;
  if (!orderId) return;
  await updateOrderStatus(orderId, 'returned');
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
}

// Mark a returned order as fully refunded (money sent back to customer).
export async function actionMarkRefunded(formData: FormData) {
  await requireAdmin();
  const orderId = formData.get('orderId') as string;
  if (!orderId) return;

  const db = createAdminSupabaseClient();
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from('orders') as any)
    .update({ payment_status: 'refunded', refunded_at: now, updated_at: now })
    .eq('id', orderId);

  // F7 — a completed refund reverses the sale, so return the goods to sellable
  // stock. Idempotent: only restores if the order had previously been deducted
  // and not already restored (guarded by inventory_movements).
  await applyOrderStock(orderId, 'restore');

  // GA4 refund — sent only here, when money is actually returned (not on a mere
  // status change to cancelled). Exactly once via orders.ga_refund_sent_at.
  await sendRefundForOrder(db, orderId);

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
}

// Mark a COD order as paid (admin confirms they received cash on delivery).
// Only valid for COD orders that are not yet paid. Also creates/updates the
// order's payment_requests row (payment_mode: 'cod') so the confirmed payment
// is tracked and visible on the Payments page, same as bank-transfer payments.
export async function actionMarkCodPaid(formData: FormData) {
  await requireAdmin();
  const orderId = formData.get('orderId') as string;
  if (!orderId) return;

  const db = createAdminSupabaseClient();
  const { data: order } = await db
    .from('orders')
    .select('payment_method, payment_status, status, total_amount, subtotal, payment_code')
    .eq('id', orderId)
    .single();

  const o = order as {
    payment_method: string; payment_status: string; status: string;
    total_amount: number | null; subtotal: number; payment_code: string | null;
  } | null;
  if (!o || o.payment_method !== 'cod' || o.payment_status === 'paid') return;

  const now = new Date().toISOString();

  // COD orders may not have a payment_code yet (only assigned for bank-transfer
  // orders at checkout) — generate and persist one so the payment_requests row
  // has a value for its unique, not-null payment_code column.
  const paymentCode = o.payment_code || generatePaymentCode();

  await db.from('orders').update({
    payment_status: 'paid',
    paid_at:        now,
    payment_code:   paymentCode,
    // Confirm the order if it hasn't progressed yet.
    ...(o.status === 'pending' ? { status: 'confirmed', confirmed_at: now } : {}),
    updated_at: now,
  } as never).eq('id', orderId);

  // Ensure a payment_requests row exists so this COD payment appears on the
  // Payments page for management/audit, same as bank-transfer payments.
  const { data: existingPr } = await db
    .from('payment_requests')
    .select('id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const amount = o.total_amount ?? o.subtotal;
  if (existingPr) {
    await db.from('payment_requests').update({
      status:       'paid',
      paid_at:      now,
      admin_note:   'COD cash collected — confirmed by admin',
      updated_at:   now,
    } as never).eq('id', (existingPr as { id: string }).id);
  } else {
    await db.from('payment_requests').insert({
      order_id:     orderId,
      amount,
      currency:     'VND',
      method:       'cod',
      status:       'paid',
      payment_code: paymentCode,
      paid_at:      now,
      payment_mode: 'cod',
      admin_note:   'COD cash collected — confirmed by admin',
    });
  }

  // Count discount usage now that payment is confirmed (idempotent).
  await countDiscountUsageForPaidOrder(orderId);

  // COD purchase was already counted at placement. Signal actual cash collection
  // with a separate custom event (revenue truth stays in the database).
  await sendOrderCustomEvent(db, orderId, 'payment_collected', { method: 'cod' });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/payments');
}

export async function actionUpdateAdminNote(formData: FormData) {
  await requireAdmin();
  const orderId   = formData.get('orderId') as string;
  const adminNote = (formData.get('adminNote') as string | null) ?? '';
  if (!orderId) return;
  await updateAdminNote(orderId, adminNote);
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function actionCreateOrder(formData: FormData) {
  await requireAdmin();
  const s = (k: string) => ((formData.get(k) as string | null) ?? '').trim();

  let items: ManualOrderItemInput[] = [];
  try {
    const parsed = JSON.parse(s('items') || '[]') as ManualOrderItemInput[];
    items = parsed
      .filter((it) => it && it.productName && Number(it.quantity) > 0)
      .map((it) => ({
        productId: it.productId || null,
        productName: String(it.productName).slice(0, 200),
        unitPrice: Math.max(0, Number(it.unitPrice) || 0),
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      }));
  } catch {
    items = [];
  }

  const customerName = s('customerName');
  const customerPhone = s('customerPhone');
  const shippingAddress = s('shippingAddress') || 'Nhận tại cửa hàng';
  const pickupTime = s('pickupTime') || null;
  // Guard: invalid input just bounces back to the form (client validates too).
  if (!customerName || !customerPhone || items.length === 0) {
    redirect('/admin/orders/new?error=1');
  }

  // Inventory guard: never create a manual order that oversells. applyOrderStock's
  // deduct clamps at 0 and never fails, so this pre-insert check is the only thing
  // preventing silent overselling. Mirrors the customer-checkout stock validation
  // in app/api/checkout/route.ts so both entry points enforce the same rule. Only
  // items with a real productId are checked; free-text lines (productId === null)
  // are exempt (no catalog row to validate against).
  const stockCheckIds = items
    .map((it) => it.productId)
    .filter((id): id is string => !!id);
  if (stockCheckIds.length > 0) {
    const db = createAdminSupabaseClient();
    const { data: prodRows } = await db
      .from('products')
      .select('id, stock, name')
      .in('id', stockCheckIds);
    const stockMap = new Map<string, { stock: number; name: string }>();
    for (const p of (prodRows ?? []) as { id: string; stock: number | null; name: string }[]) {
      stockMap.set(p.id, { stock: p.stock ?? 0, name: p.name });
    }
    const outOfStock: string[] = [];
    for (const it of items) {
      if (!it.productId) continue;
      const row = stockMap.get(it.productId);
      if (row && row.stock < it.quantity) outOfStock.push(row.name || it.productName);
    }
    if (outOfStock.length > 0) {
      redirect(`/admin/orders/new?error=stock&names=${encodeURIComponent(outOfStock.join(', '))}`);
    }
  }

  const orderId = await createManualOrder({
    customerName,
    customerPhone,
    customerEmail: s('customerEmail') || null,
    shippingAddress,
    pickupTime,
    paymentMethod: s('paymentMethod') === 'cod' ? 'cod' : 'bank_transfer',
    paid: formData.get('paid') === 'on',
    shippingFee: Number(s('shippingFee')) || 0,
    adminNote: s('adminNote') || null,
    items,
  });

  revalidatePath('/admin/orders');
  redirect(`/admin/orders/${orderId}`);
}
