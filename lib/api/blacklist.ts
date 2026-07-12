import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// Sanitize values before they go into a PostgREST `.or()` filter string, whose
// grammar uses commas and parens. IP comes from a client-controlled header, so
// this also prevents filter injection.
const cleanEmail = (s: string) => s.toLowerCase().replace(/[,()]/g, '').trim();
const cleanId = (s: string) => s.replace(/[^0-9a-fA-F-]/g, '');
const cleanIp = (s: string) => s.replace(/[^0-9a-fA-F:.]/g, '');

// True when the account (user_id/email) or device (ip) is blacklisted and the
// entry has not expired. Fails OPEN on error (mitigation, not an auth gate).
export async function isBlacklisted(subject: {
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
}): Promise<boolean> {
  try {
    const filters: string[] = [];
    if (subject.userId) filters.push(`user_id.eq.${cleanId(subject.userId)}`);
    if (subject.email) filters.push(`email.eq.${cleanEmail(subject.email)}`);
    if (subject.ip && subject.ip !== 'unknown') filters.push(`ip.eq.${cleanIp(subject.ip)}`);
    if (filters.length === 0) return false;

    const db = createAdminSupabaseClient();
    const { data } = await db
      .from('blacklist')
      .select('id, expires_at')
      .or(filters.join(','))
      .limit(50);

    const now = Date.now();
    return (data ?? []).some(
      (r: { expires_at: string | null }) =>
        !r.expires_at || new Date(r.expires_at).getTime() > now,
    );
  } catch {
    return false;
  }
}
