'use server';

import { headers } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { getClientIpFromHeaders } from '@/lib/api/request-context';
import { isBlacklisted } from '@/lib/api/blacklist';
import { rateLimit } from '@/lib/api/rate-limit';

export interface PublicComment {
  id: string;
  author_name: string | null;
  content: string;
  created_at: string;
}

export async function getApprovedComments(
  targetType: string,
  targetSlug: string
): Promise<PublicComment[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('comments')
    .select('id, author_name, content, created_at')
    .eq('target_type', targetType)
    .eq('target_slug', targetSlug)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(100);
  return (data ?? []) as PublicComment[];
}

export async function submitComment(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const targetType = (formData.get('target_type') as string | null) ?? '';
  const targetSlug = (formData.get('target_slug') as string | null) ?? '';
  const authorName = ((formData.get('author_name') as string | null) ?? '').trim().slice(0, 100);
  const authorEmail = ((formData.get('author_email') as string | null) ?? '').trim().slice(0, 200);
  const content = ((formData.get('content') as string | null) ?? '').trim();

  if (!content) return { ok: false, error: 'Nội dung bình luận không được để trống.' };
  if (content.length > 1000) return { ok: false, error: 'Bình luận tối đa 1000 ký tự.' };
  if (!targetType || !targetSlug) return { ok: false, error: 'Thiếu thông tin bài viết.' };

  const db = createAdminSupabaseClient();

  // Attribute the comment to the logged-in account so it shows the real name
  // instead of "Ẩn danh". Priority: saved profile name → auth metadata → email
  // local-part → whatever the form supplied (anonymous visitors keep that).
  let userId: string | null = null;
  let resolvedName: string | null = authorName || null;
  let resolvedEmail: string | null = authorEmail || null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { data: profile } = await db
        .from('customer_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const profileName = (profile as { full_name?: string | null } | null)?.full_name?.trim();
      const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
      const metaName = (meta?.full_name || meta?.name)?.trim();
      const emailName = user.email ? user.email.split('@')[0] : '';
      resolvedName = profileName || metaName || emailName || resolvedName;
      resolvedEmail = user.email || resolvedEmail;
    }
  } catch {
    // Auth lookup failed — treated as not logged in below.
  }

  // Require login: only authenticated customers may comment (blocks anonymous
  // spam and lets the blacklist actually target an account).
  if (!userId) {
    return { ok: false, error: 'Vui lòng đăng nhập để bình luận.' };
  }

  // Blacklist + rate-limit before writing.
  const ip = getClientIpFromHeaders(await headers());
  if (await isBlacklisted({ userId, email: resolvedEmail, ip })) {
    return { ok: false, error: 'Tài khoản của bạn đang bị hạn chế bình luận.' };
  }
  const rl = await rateLimit('comment', userId, 5, 600);
  if (!rl.ok) {
    return { ok: false, error: 'Bạn bình luận quá nhanh. Vui lòng thử lại sau ít phút.' };
  }

  const { error } = await db.from('comments').insert({
    target_type: targetType,
    target_slug: targetSlug,
    user_id: userId,
    author_name: resolvedName || null,
    author_email: resolvedEmail || null,
    content,
    status: 'pending',
  });

  if (error) return { ok: false, error: 'Không thể gửi bình luận. Vui lòng thử lại.' };
  return { ok: true };
}
