// Public read model for the self-hosted Padlet wall on the feedback page.

export interface PadletPost {
  id: string;
  author_name: string | null;
  title: string | null;
  body: string | null;
  image_url: string | null;
  image_alt: string | null;
  bg_color: string | null;
}

// Fetch published padlet posts for the storefront wall. Returns [] on any error
// (e.g. the migration 20260714_padlet_posts.sql hasn't been applied yet) so the
// feedback page never crashes.
export async function getPadletPosts(): Promise<PadletPost[]> {
  try {
    const { createSupabaseServerClient } = await import('../supabase/server-client');
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('padlet_posts')
      .select('id, author_name, title, body, image_url, image_alt, bg_color')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as unknown as PadletPost[];
  } catch {
    return [];
  }
}
