import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminInventoryMovement } from './types';

export type InventoryProduct = {
  id: string;
  name: string;
  stock: number | null;
  low_stock_threshold: number | null;
  is_active: boolean | null;
  sku: string | null;
};

export function stockStatus(stock: number | null, threshold: number | null): 'out' | 'low' | 'ok' {
  const s = stock ?? 0;
  const t = threshold ?? 3;
  if (s <= 0) return 'out';
  if (s <= t) return 'low';
  return 'ok';
}

export async function getInventoryProducts(): Promise<InventoryProduct[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('products')
    .select('id, name, stock, low_stock_threshold, is_active, sku')
    .order('name', { ascending: true });
  return (data ?? []) as InventoryProduct[];
}

export async function getRecentMovements(productId: string, limit = 20): Promise<AdminInventoryMovement[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('inventory_movements')
    .select('id, product_id, delta, stock_after, reason, admin_note, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as AdminInventoryMovement[];
}

export interface MovementWithProduct extends AdminInventoryMovement {
  product_name: string;
}

export async function getAllRecentMovements(limit = 100): Promise<MovementWithProduct[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('inventory_movements')
    .select('id, product_id, delta, stock_after, reason, admin_note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data || data.length === 0) return [];

  // Enrich with product names
  const productIds = [...new Set((data as AdminInventoryMovement[]).map((m) => m.product_id))];
  const { data: products } = await db
    .from('products')
    .select('id, name')
    .in('id', productIds);

  const nameMap: Record<string, string> = {};
  (products ?? []).forEach((p: { id: string; name: string }) => { nameMap[p.id] = p.name; });

  return (data as AdminInventoryMovement[]).map((m) => ({
    ...m,
    product_name: nameMap[m.product_id] ?? m.product_id.slice(0, 8),
  }));
}

export async function adjustStock(
  productId: string,
  delta: number,
  reason: string,
  adminNote?: string
): Promise<void> {
  const db = createAdminSupabaseClient();
  // Atomic: locks the product row, clamps at 0, and records the ACTUAL applied
  // delta so the ledger stays consistent (stock_after = prev + delta) even when a
  // negative adjustment exceeds the current stock (S1). No read-modify-write race.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).rpc('apply_stock_delta', {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_order_id: null,
    p_admin_note: adminNote ?? null,
    p_reject_if_insufficient: false,
  });
  if (error) throw new Error(error.message);
}
