import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// SERVER-ONLY. Product gallery images (many per product). Uses the
// service-role client (bypasses RLS). Never import in a client component.

export type ProductImage = {
  id: string;
  url: string;
  path: string | null;
  alt: string | null;
  sort_order: number;
};

export async function getProductImages(productId: string): Promise<ProductImage[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('product_images')
    .select('id, url, path, alt, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  return (data ?? []) as ProductImage[];
}

// Replace the whole gallery for a product with the given ordered list.
// The array index becomes sort_order, so callers control ordering.
export async function setProductImages(
  productId: string,
  images: { url: string; path?: string | null; alt?: string | null }[],
): Promise<void> {
  const db = createAdminSupabaseClient();
  await db.from('product_images').delete().eq('product_id', productId);
  const clean = images.filter((img) => img.url && img.url.trim());
  if (clean.length === 0) return;
  const rows = clean.map((img, i) => ({
    product_id: productId,
    url: img.url.trim(),
    path: img.path ?? null,
    alt: img.alt ?? null,
    sort_order: i,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('product_images').insert(rows as any);
  if (error) throw new Error(error.message);
}
