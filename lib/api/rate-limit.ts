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
    // Atomic (R1): prune + count + insert happen inside one SQL function guarded by
    // a per-key advisory lock. The old count-then-insert let a burst of concurrent
    // requests all read the same count and all slip through the limit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc('check_rate_limit', {
      p_bucket: bucket,
      p_identifier: identifier,
      p_limit: limit,
      p_window_sec: windowSec,
    });
    if (error) return { ok: true };            // fail open on infra errors
    return data === false ? { ok: false, retryAfterSec: windowSec } : { ok: true };
  } catch {
    return { ok: true };
  }
}
