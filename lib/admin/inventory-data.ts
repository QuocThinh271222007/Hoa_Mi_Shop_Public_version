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

  const { data: product } = await db
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single();

  const currentStock = (product as { stock: number | null } | null)?.stock ?? 0;
  const newStock = Math.max(0, currentStock + delta);

  const { error: updateError } = await db
    .from('products')
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (updateError) throw new Error(updateError.message);

  await db.from('inventory_movements').insert({
    product_id: productId,
    delta,
    stock_after: newStock,
    reason,
    admin_note: adminNote ?? null,
  });
}
