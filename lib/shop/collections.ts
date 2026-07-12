import type { Product } from '@/lib/types';

// Public-facing collection model used by /collection and /collection/[slug].
// Backend-first with a safe fallback to the legacy hardcoded groups so the
// public pages never break when the `collections` table is empty/unavailable.

export type PublicCollection = {
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  hero_image_url: string | null;
};

// Legacy hardcoded groups — identical to the previous behavior.
export const FALLBACK_COLLECTIONS: PublicCollection[] = [
  { slug: 'new-drop',    name: 'NEW DROP',    description: 'Những món mới nhất',        image_url: null, hero_image_url: null },
  { slug: 'best-seller', name: 'Best Seller', description: 'Những món được yêu thích',   image_url: null, hero_image_url: null },
  { slug: 'day-ao',      name: 'Dây áo',      description: 'Bộ sưu tập dây áo',          image_url: null, hero_image_url: null },
];

// Legacy filter used when a collection has no explicit product assignment.
export function fallbackFilter(products: Product[], slug: string): Product[] {
  if (slug === 'new-drop')    return products.filter((p) => p.isNew === true);
  if (slug === 'best-seller') return products.filter((p) => p.isBestseller === true);
  if (slug === 'day-ao')      return products.filter((p) => (p.category ?? '').toLowerCase().includes('dây'));
  return products;
}

export async function getPublicCollections(): Promise<PublicCollection[]> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('collections')
      .select('slug, name, description, image_url, hero_image_url, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error || !data || data.length === 0) return FALLBACK_COLLECTIONS;
    return data.map((row: {
      slug: string; name: string; description: string | null;
      image_url: string | null; hero_image_url: string | null;
    }) => ({
      slug: row.slug,
      name: row.name,
      description: row.description ?? '',
      image_url: row.image_url,
      hero_image_url: row.hero_image_url,
    }));
  } catch {
    return FALLBACK_COLLECTIONS;
  }
}

export async function getPublicCollectionBySlug(slug: string): Promise<PublicCollection | undefined> {
  const all = await getPublicCollections();
  return all.find((c) => c.slug === slug);
}

export type PublicCollectionWithProductIds = PublicCollection & { productIds: string[] };

// Bulk variant of getCollectionProducts — resolves every active collection's
// product membership in 2 queries (instead of 1 per collection). Used by the
// /collection listing page to drive the filter dropdown with real, admin-created
// collections instead of raw product.category strings.
export async function getPublicCollectionsWithProductIds(
  allProducts: Product[],
): Promise<PublicCollectionWithProductIds[]> {
  const toFallback = () =>
    FALLBACK_COLLECTIONS.map((c) => ({
      ...c,
      productIds: fallbackFilter(allProducts, c.slug).map((p) => p.id),
    }));

  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('collections')
      .select('id, slug, name, description, image_url, hero_image_url, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error || !data || data.length === 0) return toFallback();

    const rows = data as {
      id: string; slug: string; name: string; description: string | null;
      image_url: string | null; hero_image_url: string | null;
    }[];
    const collectionIds = rows.map((r) => r.id);

    const { data: links } = await db
      .from('collection_products')
      .select('collection_id, product_id')
      .in('collection_id', collectionIds);

    const byCollection = new Map<string, string[]>();
    for (const link of (links ?? []) as { collection_id: string; product_id: string }[]) {
      const arr = byCollection.get(link.collection_id) ?? [];
      arr.push(link.product_id);
      byCollection.set(link.collection_id, arr);
    }

    return rows.map((row) => {
      const assigned = byCollection.get(row.id) ?? [];
      return {
        slug: row.slug,
        name: row.name,
        description: row.description ?? '',
        image_url: row.image_url,
        hero_image_url: row.hero_image_url,
        // A collection with no explicit product assignment falls back to the
        // legacy category-based filter, same as getCollectionProducts.
        productIds: assigned.length > 0 ? assigned : fallbackFilter(allProducts, row.slug).map((p) => p.id),
      };
    });
  } catch {
    return toFallback();
  }
}

// Resolve products for a collection: use explicit backend assignments if the
// collection exists and has any; otherwise fall back to the legacy filter.
export async function getCollectionProducts(slug: string, allProducts: Product[]): Promise<Product[]> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const { data: col } = await db
      .from('collections')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    const collectionId = (col as { id: string } | null)?.id;
    if (collectionId) {
      const { data: links } = await db
        .from('collection_products')
        .select('product_id, sort_order')
        .eq('collection_id', collectionId)
        .order('sort_order');
      const rows = (links ?? []) as { product_id: string; sort_order: number }[];
      if (rows.length > 0) {
        const order = new Map(rows.map((r, i) => [r.product_id, r.sort_order ?? i]));
        const assigned = allProducts
          .filter((p) => order.has(p.id))
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        if (assigned.length > 0) return assigned;
      }
    }
  } catch {
    // fall through to legacy filter
  }
  return fallbackFilter(allProducts, slug);
}
