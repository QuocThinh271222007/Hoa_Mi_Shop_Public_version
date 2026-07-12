import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminFeedbackItem } from './types';

const FIELDS = 'id, customer_name, message, image_url, image_path, image_alt, rating, is_featured, is_published, sort_order, description, detail_title, detail_title_font_size, reviewer_font_size, created_at, updated_at';

export async function getFeedbackItems(publishedOnly = false): Promise<AdminFeedbackItem[]> {
  const db = createAdminSupabaseClient();
  let q = db.from('feedback_items').select(FIELDS).order('sort_order').order('created_at', { ascending: false });
  if (publishedOnly) q = q.eq('is_published', true);
  const { data } = await q;
  // Cast via unknown: the generated Supabase types don't include the additive
  // description/detail_title/detail_title_font_size columns (migration
  // 20260710_feedback_detail_description_padlet.sql).
  return (data ?? []) as unknown as AdminFeedbackItem[];
}

export async function getFeedbackItemById(id: string): Promise<AdminFeedbackItem | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('feedback_items').select(FIELDS).eq('id', id).single();
  return (data as unknown as AdminFeedbackItem) ?? null;
}

export async function createFeedbackItem(fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('feedback_items').insert({ ...fields, updated_at: new Date().toISOString() } as any);
  if (error) throw new Error(error.message);
}

export async function updateFeedbackItem(id: string, fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('feedback_items').update({ ...fields, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteFeedbackItem(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db.from('feedback_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
