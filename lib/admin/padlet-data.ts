import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

export interface AdminPadletPost {
  id: string;
  author_name: string | null;
  title: string | null;
  body: string | null;
  image_url: string | null;
  image_path: string | null;
  image_alt: string | null;
  bg_color: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

const FIELDS =
  'id, author_name, title, body, image_url, image_path, image_alt, bg_color, sort_order, is_published, created_at, updated_at';

export async function getPadletPosts(): Promise<AdminPadletPost[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('padlet_posts')
    .select(FIELDS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as AdminPadletPost[];
}

export async function createPadletPost(fields: Record<string, unknown>): Promise<void> {
  // padlet_posts isn't in the generated Supabase types (added by migration
  // 20260714_padlet_posts.sql), so its query builder is typed `never`. Cast to a
  // loose client for writes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminSupabaseClient() as any;
  const { error } = await db.from('padlet_posts').insert({ ...fields, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function updatePadletPost(id: string, fields: Record<string, unknown>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminSupabaseClient() as any;
  const { error } = await db.from('padlet_posts').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePadletPost(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminSupabaseClient() as any;
  const { error } = await db.from('padlet_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
