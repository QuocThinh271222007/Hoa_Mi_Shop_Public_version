import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// SERVER-ONLY. Admin CRUD for the collection banner carousel.
// Uses the service-role client (bypasses RLS). Never import in a client component.

export type AdminBanner = {
  id: string;
  name: string | null;
  image_url: string | null;
  image_path: string | null;
  alt: string | null;
  collection_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const BANNER_FIELDS =
  'id, name, image_url, image_path, alt, collection_id, sort_order, is_active, created_at, updated_at';

export async function getAllBanners(): Promise<AdminBanner[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('collection_banners')
    .select(BANNER_FIELDS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return (data ?? []) as AdminBanner[];
}

export async function getBannerById(id: string): Promise<AdminBanner | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('collection_banners')
    .select(BANNER_FIELDS)
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as AdminBanner) ?? null;
}

export async function createBanner(fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('collection_banners')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...fields, updated_at: new Date().toISOString() } as any);
  if (error) throw new Error(error.message);
}

export async function updateBanner(id: string, fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('collection_banners')
    .update({ ...fields, updated_at: new Date().toISOString() } as never)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteBanner(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db.from('collection_banners').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
