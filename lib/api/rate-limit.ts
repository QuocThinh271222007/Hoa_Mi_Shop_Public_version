import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

// DB-backed fixed-window limiter (works across serverless instances, unlike an
// in-memory counter). Counts hits for (bucket, identifier) inside the window and
// rejects once the count reaches `limit`. Old rows are pruned opportunistically.
//
// Fails OPEN on any DB error — this is abuse mitigation, not an auth gate, so an
// infra hiccup must never lock out real customers.
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  try {
    const db = createAdminSupabaseClient();
    const sinceIso = new Date(Date.now() - windowSec * 1000).toISOString();

    // Prune this key's expired rows (best-effort, keeps the table small).
    await db
      .from('rate_limit_hits')
      .delete()
      .eq('bucket', bucket)
      .eq('identifier', identifier)
      .lt('created_at', sinceIso);

    const { count } = await db
      .from('rate_limit_hits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket)
      .eq('identifier', identifier)
      .gte('created_at', sinceIso);

    if ((count ?? 0) >= limit) return { ok: false, retryAfterSec: windowSec };

    // Cast: generated Supabase types don't include this additive table yet.
    await db.from('rate_limit_hits').insert({ bucket, identifier } as never);
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
