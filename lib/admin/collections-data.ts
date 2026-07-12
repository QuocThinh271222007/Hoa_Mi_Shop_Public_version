import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

export type AdminCollection = {
  id: string; slug: string; name: string; description: string | null;
  image_url: string | null; image_path: string | null; image_alt: string | null;
  hero_image_url: string | null; hero_image_path: string | null;
  is_active: boolean; sort_order: number;
  created_at: string; updated_at: string;
};

export type AdminCollectionProduct = {
  product_id: string; sort_order: number;
};

const FIELDS =
  'id, slug, name, description, image_url, image_path, image_alt, hero_image_url, hero_image_path, is_active, sort_order, created_at, updated_at';

export async function getAllCollections(): Promise<AdminCollection[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('collections')
    .select(FIELDS)
    .order('sort_order')
    .order('created_at', { ascending: false });
  return (data ?? []) as AdminCollection[];
}

export async function getCollectionById(id: string): Promise<AdminCollection | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('collections').select(FIELDS).eq('id', id).single();
  return (data as AdminCollection) ?? null;
}

export async function createCollection(fields: Record<string, unknown>): Promise<string | null> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db.from('collections').insert({ ...fields, updated_at: new Date().toISOString() } as any).select('id').single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function updateCollection(id: string, fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('collections').update({ ...fields, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCollection(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db.from('collections').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- product assignment ---

export async function getCollectionProductIds(collectionId: string): Promise<string[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('collection_products')
    .select('product_id, sort_order')
    .eq('collection_id', collectionId)
    .order('sort_order');
  return ((data ?? []) as AdminCollectionProduct[]).map((r) => r.product_id);
}

// Replace the full set of assigned products for a collection.
export async function setCollectionProducts(collectionId: string, productIds: string[]): Promise<void> {
  const db = createAdminSupabaseClient();
  await db.from('collection_products').delete().eq('collection_id', collectionId);
  if (productIds.length === 0) return;
  const rows = productIds.map((product_id, i) => ({
    collection_id: collectionId,
    product_id,
    sort_order: i,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('collection_products').insert(rows as any);
  if (error) throw new Error(error.message);
}
