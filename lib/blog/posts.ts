import { MOCK_POSTS, type BlogPost } from './mock-posts';

// Column lists. WITH_TOGGLE adds the detail-image flag; if the migration hasn't
// been applied yet the query errors and we transparently retry with BASE.
const BASE_FIELDS =
  'slug, title, excerpt, content, read_time, views, comments_count, likes, published_at, created_at, image_url';
const FIELDS_WITH_TOGGLE = `${BASE_FIELDS}, show_detail_image`;

// Map Supabase blog_post row to the BlogPost shape used by the public UI
function mapRow(row: {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  read_time: string | null;
  views: number;
  comments_count: number;
  likes: number;
  published_at: string | null;
  created_at: string;
  image_url: string | null;
  show_detail_image?: boolean | null;
}): BlogPost {
  const date = row.published_at ?? row.created_at;
  const d = new Date(date);
  const viDate = d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return {
    slug: row.slug,
    date: viDate,
    readTime: row.read_time ?? '2 phút đọc',
    title: row.title,
    excerpt: row.excerpt ?? '',
    content: row.content ?? '',
    views: row.views,
    commentsCount: row.comments_count,
    likes: row.likes,
    imageUrl: row.image_url ?? undefined,
    showDetailImage: row.show_detail_image ?? true,
  };
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const run = (fields: string) =>
      db
        .from('blog_posts')
        .select(fields)
        .eq('is_published', true)
        .order('sort_order')
        .order('created_at', { ascending: false });
    let { data, error } = await run(FIELDS_WITH_TOGGLE);
    if (error) ({ data, error } = await run(BASE_FIELDS)); // migration not applied yet
    if (error || !data || data.length === 0) return MOCK_POSTS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(mapRow);
  } catch {
    return MOCK_POSTS;
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const run = (fields: string) =>
      db
        .from('blog_posts')
        .select(fields)
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
    let { data, error } = await run(FIELDS_WITH_TOGGLE);
    if (error) ({ data, error } = await run(BASE_FIELDS)); // migration not applied yet
    if (error || !data) {
      return MOCK_POSTS.find((p) => p.slug === slug);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mapRow(data as any);
  } catch {
    return MOCK_POSTS.find((p) => p.slug === slug);
  }
}

/**
 * Increments a post's view counter by one. Best-effort: uses the admin client so
 * the write passes RLS, and never throws so a failure can't break page render.
 * No-op for slugs that don't exist in the DB (e.g. mock fallback posts).
 */
export async function incrementBlogViews(slug: string): Promise<void> {
  try {
    const { createAdminSupabaseClient } = await import('../supabase/admin-client');
    const db = createAdminSupabaseClient();
    const { data } = await db
      .from('blog_posts')
      .select('views')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return;
    const current = (data as { views: number | null }).views ?? 0;
    await db.from('blog_posts').update({ views: current + 1 }).eq('slug', slug);
  } catch {
    // best-effort — view counting must never block or fail the page
  }
}

export async function getSuggestedBlogPosts(currentSlug: string): Promise<BlogPost[]> {
  const all = await getBlogPosts();
  return all.filter((p) => p.slug !== currentSlug).slice(0, 3);
}

export async function getAllBlogSlugs(): Promise<string[]> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const { data } = await db
      .from('blog_posts')
      .select('slug')
      .eq('is_published', true);
    const fromDb = (data ?? []).map((r: { slug: string }) => r.slug);
    if (fromDb.length > 0) return fromDb;
  } catch {
    // fall through
  }
  return MOCK_POSTS.map((p) => p.slug);
}
