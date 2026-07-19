import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { BUCKETS } from './storage';
import type { AdminProduct } from './types';

const PRODUCT_FIELDS =
  'id, slug, name, category, price, stock, is_bestseller, is_new, is_active, image_url, image_path, image_alt, description, sku, low_stock_threshold, created_at, updated_at';

export async function getAllProducts(): Promise<AdminProduct[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('products')
    .select(PRODUCT_FIELDS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return (data ?? []) as AdminProduct[];
}

export async function getProductById(id: string): Promise<AdminProduct | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('id', id)
    .single();
  return (data as AdminProduct) ?? null;
}

export async function createProduct(fields: Record<string, unknown>): Promise<string | null> {
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from('products')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...fields, updated_at: new Date().toISOString() } as any)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;

  // S6 — record the opening balance in the ledger so movements reconcile to the
  // current stock. The product row already carries the initial stock, so this only
  // logs it (no stock change).
  const openingStock = typeof fields.stock === 'number' ? (fields.stock as number) : 0;
  if (id && openingStock > 0) {
    await db.from('inventory_movements').insert({
      product_id: id,
      delta: openingStock,
      stock_after: openingStock,
      reason: 'opening_stock',
      admin_note: 'Tồn kho khởi tạo khi tạo sản phẩm',
    });
  }
  return id;
}

export async function updateProduct(id: string, fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('products')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function toggleProductField(
  id: string,
  field: 'is_active' | 'is_bestseller' | 'is_new',
  value: boolean
): Promise<void> {
  return updateProduct(id, { [field]: value });
}

// Hard-delete a product: removes its gallery rows and best-effort cleans up the
// cover/gallery objects from Storage, then deletes the product row itself.
// Throws if the product is still referenced (e.g. by existing order_items) so the
// caller can suggest deactivating instead of deleting.
export async function deleteProduct(id: string): Promise<void> {
  const db = createAdminSupabaseClient();

  // Best-effort storage cleanup — never block the delete on this.
  try {
    const { data: imgs } = await db
      .from('product_images')
      .select('path')
      .eq('product_id', id);
    const { data: prod } = await db
      .from('products')
      .select('image_path')
      .eq('id', id)
      .single();
    const paths = [
      ...((imgs ?? []) as { path: string | null }[]).map((i) => i.path),
      (prod as { image_path: string | null } | null)?.image_path ?? null,
    ].filter((p): p is string => !!p);
    if (paths.length > 0) {
      await db.storage.from(BUCKETS.product).remove(paths);
    }
  } catch {
    // ignore storage cleanup errors
  }

  // Remove gallery rows (FK to products) first, then the product itself.
  await db.from('product_images').delete().eq('product_id', id);
  const { error } = await db.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
