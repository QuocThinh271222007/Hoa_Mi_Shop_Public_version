// Public-facing banner slides for the /collection carousel. Backend-first
// with a safe empty fallback so the page never breaks when the
// `collection_banners` table is empty/unavailable.

export type PublicBanner = {
  id: string;
  name: string | null;
  image_url: string;
  alt: string | null;
  collectionSlug: string | null;
};

type BannerRow = {
  id: string;
  name: string | null;
  image_url: string | null;
  alt: string | null;
  collections: { slug: string } | { slug: string }[] | null;
};

export async function getPublicBanners(): Promise<PublicBanner[]> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('collection_banners')
      .select('id, name, image_url, alt, sort_order, collections ( slug )')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return (data as BannerRow[])
      .filter((row) => !!row.image_url)
      .map((row) => {
        const col = Array.isArray(row.collections) ? row.collections[0] : row.collections;
        return {
          id: row.id,
          name: row.name,
          image_url: row.image_url as string,
          alt: row.alt,
          collectionSlug: col?.slug ?? null,
        };
      });
  } catch {
    return [];
  }
}
