import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminComment } from './types';

const FIELDS =
  'id, target_type, target_id, target_slug, user_id, author_name, author_email, content, status, admin_note, created_at, updated_at';

export interface CommentsFilter {
  status?: string;
  target_type?: string;
  search?: string;
}

export async function getComments(filter: CommentsFilter = {}): Promise<AdminComment[]> {
  const db = createAdminSupabaseClient();
  let query = db
    .from('comments')
    .select(FIELDS)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter.status && filter.status !== 'all') {
    query = query.eq('status', filter.status);
  }
  if (filter.target_type && filter.target_type !== 'all') {
    query = query.eq('target_type', filter.target_type);
  }
  if (filter.search) {
    const term = `%${filter.search}%`;
    query = query.or(
      `content.ilike.${term},author_name.ilike.${term},author_email.ilike.${term}`
    );
  }

  const { data } = await query;
  return (data ?? []) as AdminComment[];
}

export async function updateCommentStatus(id: string, status: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from('comments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('target_type, target_slug')
    .maybeSingle();
  if (error) throw new Error(error.message);

  // Keep the blog post's comment counter in sync with its approved comments so
  // the blog listing shows an accurate number.
  const row = data as { target_type: string | null; target_slug: string | null } | null;
  if (row?.target_type === 'blog' && row.target_slug) {
    await syncBlogCommentCount(db, row.target_slug);
  }
}

/** Recomputes blog_posts.comments_count from the approved comments for a slug. */
async function syncBlogCommentCount(
  db: ReturnType<typeof createAdminSupabaseClient>,
  slug: string
): Promise<void> {
  const { count } = await db
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', 'blog')
    .eq('target_slug', slug)
    .eq('status', 'approved');
  await db.from('blog_posts').update({ comments_count: count ?? 0 }).eq('slug', slug);
}

export async function updateCommentAdminNote(id: string, adminNote: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('comments')
    .update({ admin_note: adminNote || null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
