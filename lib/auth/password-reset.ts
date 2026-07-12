// SERVER-ONLY. Custom password-reset token bucket:
//   • createPasswordResetToken → issues a single-use token (5-minute expiry),
//     stored as a sha256 hash; the raw token only ever lives in the email link.
//   • resetPasswordWithToken → validates a raw token and sets the new password
//     via the Supabase admin API, then burns the token.
// All access goes through the service-role admin client (RLS denies others).

import { randomBytes, createHash } from 'crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

type Admin = ReturnType<typeof createAdminSupabaseClient>;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Resolve a Supabase auth user id from an email (profile fast-path, then scan). */
async function findUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();

  const { data: profile } = await admin
    .from('customer_profiles')
    .select('user_id')
    .ilike('email', target)
    .limit(1)
    .maybeSingle();
  if (profile?.user_id) return profile.user_id;

  // Fallback: page through auth users (small shop — capped for safety).
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/**
 * Issues a reset token for the email if an account exists. Returns the RAW token
 * to embed in the email link, or null when no account matches (caller should
 * still respond success to avoid email enumeration).
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const userId = await findUserIdByEmail(admin, email);
  if (!userId) return null;

  const now = new Date();
  // Invalidate any still-active tokens for this email so only the newest works.
  await admin
    .from('password_reset_tokens')
    .update({ used_at: now.toISOString() })
    .eq('email', email.trim().toLowerCase())
    .is('used_at', null);

  const raw = randomBytes(32).toString('hex');
  const { error } = await admin.from('password_reset_tokens').insert({
    user_id: userId,
    email: email.trim().toLowerCase(),
    token_hash: hashToken(raw),
    expires_at: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
  });
  if (error) return null;
  return raw;
}

export type ResetResult = { ok: true } | { ok: false; error: 'invalid' | 'expired' | 'server' };

/** Validates a raw token and, if valid & unexpired, sets the new password. */
export async function resetPasswordWithToken(rawToken: string, newPassword: string): Promise<ResetResult> {
  const admin = createAdminSupabaseClient();
  const tokenHash = hashToken(rawToken);

  const { data: row, error } = await admin
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) return { ok: false, error: 'server' };
  if (!row || row.used_at) return { ok: false, error: 'invalid' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: 'expired' };

  const { error: updateErr } = await admin.auth.admin.updateUserById(row.user_id, {
    password: newPassword,
  });
  if (updateErr) return { ok: false, error: 'server' };

  // Burn the token (single use).
  await admin
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id);

  return { ok: true };
}
