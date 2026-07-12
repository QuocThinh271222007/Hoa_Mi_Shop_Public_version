import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminBlogPost } from './types';

const FIELDS = 'id, slug, title, excerpt, content, image_url, image_path, image_alt, read_time, views, likes, comments_count, is_published, sort_order, published_at, show_detail_image, created_at, updated_at';

export async function getBlogPosts(publishedOnly = false): Promise<AdminBlogPost[]> {
  const db = createAdminSupabaseClient();
  let q = db.from('blog_posts').select(FIELDS).order('sort_order').order('created_at', { ascending: false });
  if (publishedOnly) q = q.eq('is_published', true);
  const { data } = await q;
  // Cast via unknown: generated types don't yet include show_detail_image
  // (migration 20260709_blog_show_detail_image.sql); the column exists at runtime.
  return (data ?? []) as unknown as AdminBlogPost[];
}

export async function getBlogPostById(id: string): Promise<AdminBlogPost | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('blog_posts').select(FIELDS).eq('id', id).single();
  return (data as unknown as AdminBlogPost) ?? null;
}

export async function createBlogPost(fields: Record<string, unknown>): Promise<string | null> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db.from('blog_posts').insert({ ...fields, updated_at: new Date().toISOString() } as any).select('id').single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function updateBlogPost(id: string, fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('blog_posts').update({ ...fields, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteBlogPost(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db.from('blog_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function toggleBlogPublished(id: string, is_published: boolean): Promise<void> {
  return updateBlogPost(id, { is_published });
}
