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

// Runs the atomic stock RPC (locks the product row, clamps at 0, records the
// ACTUAL applied delta, idempotent per order+product+reason). Returns the applied
// delta (0 when it was a no-op / already applied).
async function applyDelta(
  db: ReturnType<typeof createAdminSupabaseClient>,
  productId: string,
  delta: number,
  reason: string,
  orderId: string | null,
  adminNote: string | null,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc('apply_stock_delta', {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_order_id: orderId,
    p_admin_note: adminNote,
    p_reject_if_insufficient: false,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.applied_delta ?? 0) as number;
}

export async function applyOrderStock(orderId: string, direction: 'deduct' | 'restore'): Promise<void> {
  if (!orderId) return;
  const db = createAdminSupabaseClient();

  const { data: items } = await db
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);
  const list = ((items ?? []) as { product_id: string | null; quantity: number }[])
    .filter((it) => it.product_id && it.quantity > 0);
  if (list.length === 0) return;

  if (direction === 'deduct') {
    for (const it of list) {
      const applied = await applyDelta(db, it.product_id!, -it.quantity, DEDUCT_REASON, orderId, 'Trừ kho khi ghi nhận đơn');
      // S5 — surface an oversell: a real deduct that took less than requested
      // (applied 0 with an existing movement = idempotent re-run, not a shortfall).
      if (applied !== 0 && Math.abs(applied) < it.quantity) {
        console.warn(
          `[stock] Oversell on order ${orderId}, product ${it.product_id}: requested ${it.quantity}, deducted ${Math.abs(applied)} (stock ran out).`,
        );
      }
    }
    revalidateStockSurfaces();
    return;
  }

  // Restore — give back EXACTLY what was deducted for this order (S2), read from
  // the ledger, not the order quantity (which may differ if a deduct was clamped).
  const { data: deducts } = await db
    .from('inventory_movements')
    .select('product_id, delta')
    .eq('order_id', orderId)
    .eq('reason', DEDUCT_REASON);
  const rows = (deducts ?? []) as { product_id: string; delta: number }[];
  if (rows.length === 0) return; // never deducted → nothing to give back

  const perProduct = new Map<string, number>();
  for (const r of rows) perProduct.set(r.product_id, (perProduct.get(r.product_id) ?? 0) + r.delta);

  let changed = false;
  for (const [productId, sumDelta] of perProduct) {
    const restoreAmount = -sumDelta; // deduct deltas are negative → positive give-back
    if (restoreAmount <= 0) continue;
    await applyDelta(db, productId, restoreAmount, RESTORE_REASON, orderId, 'Hoàn kho khi hủy đơn');
    changed = true;
  }
  if (changed) revalidateStockSurfaces();
}
