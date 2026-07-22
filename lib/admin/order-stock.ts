import 'server-only';
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

// SERVER-ONLY. Brings an order's stock effect to the desired STATE:
//   • 'deduct'  — the order occupies stock (COD created, payment confirmed,
//     admin manual order, or a cancelled order being restored).
//   • 'restore' — the order occupies no stock (cancelled / refunded).
//
// Delegates to the sync_order_stock() RPC, which compares the order's current net
// effect in inventory_movements against the desired one and applies only the
// difference — inside one transaction with the product rows locked.
//
// Consequences of the state model (vs the old event model):
//   • calling it twice is a no-op, so double-confirm can't double-deduct;
//   • an order can be cancelled and restored repeatedly and stock stays exact;
//   • the ledger always records the ACTUAL applied delta, so
//     stock_after = previous + delta holds even when clamped at zero.
export async function applyOrderStock(orderId: string, direction: 'deduct' | 'restore'): Promise<void> {
  if (!orderId) return;
  const db = createAdminSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc('sync_order_stock', {
    p_order_id: orderId,
    p_should_deduct: direction === 'deduct',
  });
  if (error) throw new Error(error.message);

  // Only refresh customer-facing caches when stock actually moved.
  const changed = typeof data === 'number' ? data : Number(data ?? 0);
  if (changed > 0) revalidateStockSurfaces();
}
