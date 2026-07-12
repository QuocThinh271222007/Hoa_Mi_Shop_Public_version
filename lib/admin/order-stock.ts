import { revalidatePath } from 'next/cache';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// Refresh the statically-cached customer surfaces whose "Hết hàng" / add-to-cart
// state is driven by product.stock. Wrapped so a revalidation hiccup can never
// break the far more important stock/payment write that precedes it.
function revalidateStockSurfaces(): void {
  try {
    revalidatePath('/products/[slug]', 'page');
    revalidatePath('/collection', 'page');
    revalidatePath('/collection/[collectionSlug]', 'page');
    revalidatePath('/');
  } catch {
    /* best-effort: outside a request context revalidatePath is a no-op/throws */
  }
}

// SERVER-ONLY. Applies (or reverts) stock for an order's items.
//   • 'deduct'  — when the order is recorded into fulfilment (COD created,
//     QR/bank payment confirmed, or an admin manual order).
//   • 'restore' — when a previously-deducted order is cancelled.
// Idempotent: inventory_movements rows (keyed by order_id + reason) act as both
// the audit ledger and the guard, so double calls never double-count.

const DEDUCT_REASON = 'order_deduct';
const RESTORE_REASON = 'order_restore';

export async function applyOrderStock(orderId: string, direction: 'deduct' | 'restore'): Promise<void> {
  if (!orderId) return;
  const db = createAdminSupabaseClient();

  const { data: existing } = await db
    .from('inventory_movements')
    .select('reason')
    .eq('order_id', orderId)
    .in('reason', [DEDUCT_REASON, RESTORE_REASON]);
  const rows = (existing ?? []) as { reason: string }[];
  const hasDeduct = rows.some((r) => r.reason === DEDUCT_REASON);
  const hasRestore = rows.some((r) => r.reason === RESTORE_REASON);

  if (direction === 'deduct' && hasDeduct) return;          // already deducted
  if (direction === 'restore' && (!hasDeduct || hasRestore)) return; // nothing to give back

  const { data: items } = await db
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);
  const list = (items ?? []) as { product_id: string | null; quantity: number }[];

  const reason = direction === 'deduct' ? DEDUCT_REASON : RESTORE_REASON;
  const note = direction === 'deduct' ? 'Trừ kho khi ghi nhận đơn' : 'Hoàn kho khi hủy đơn';

  for (const it of list) {
    if (!it.product_id || !it.quantity) continue;
    const delta = direction === 'deduct' ? -it.quantity : it.quantity;
    const { data: p } = await db.from('products').select('stock').eq('id', it.product_id).single();
    const cur = (p as { stock: number | null } | null)?.stock ?? 0;
    const next = Math.max(0, cur + delta);
    await db.from('products').update({ stock: next, updated_at: new Date().toISOString() }).eq('id', it.product_id);
    await db.from('inventory_movements').insert({
      product_id: it.product_id,
      delta,
      stock_after: next,
      reason,
      order_id: orderId,
      admin_note: note,
    });
  }

  // Stock changed → refresh the customer-facing cached pages so availability shows
  // correctly (e.g. selling out hides the buy button, cancelling restores it).
  if (list.some((it) => it.product_id && it.quantity)) {
    revalidateStockSurfaces();
  }
}
