'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function actionAddBlacklist(formData: FormData) {
  const { email: adminEmail } = await requireAdmin();
  const s = (k: string) => ((formData.get(k) as string | null) ?? '').trim();

  const rawUserId = s('user_id');
  const userId = UUID_RE.test(rawUserId) ? rawUserId : null;
  const email = s('email').toLowerCase() || null;
  const ip = s('ip') || null;
  const reason = s('reason').slice(0, 300) || null;
  const expiresRaw = s('expires_at'); // 'YYYY-MM-DD' from a date input (optional)

  // Need at least one target to block.
  if (!userId && !email && !ip) return;

  const db = createAdminSupabaseClient();
  // Cast: generated Supabase types don't include this additive table yet.
  await db.from('blacklist').insert({
    user_id: userId,
    email,
    ip,
    reason,
    created_by: adminEmail,
    expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
  } as never);
  revalidatePath('/admin/blacklist');
}

export async function actionRemoveBlacklist(formData: FormData) {
  await requireAdmin();
  const id = (formData.get('id') as string | null) ?? '';
  if (!id) return;
  const db = createAdminSupabaseClient();
  await db.from('blacklist').delete().eq('id', id);
  revalidatePath('/admin/blacklist');
}
