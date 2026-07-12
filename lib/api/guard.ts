import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { getClientIp } from './request-context';
import { rateLimit } from './rate-limit';
import { isBlacklisted } from './blacklist';

export type GuardContext = {
  userId: string | null;
  email: string | null;
  ip: string;
};

export type GuardOptions = {
  requireAuth?: boolean;
  blacklist?: boolean;
  rateLimit?: { bucket: string; limit: number; windowSec: number };
};

type GuardedHandler = (
  req: NextRequest,
  ctx: GuardContext,
) => Promise<Response> | Response;

// Central "API gateway" wrapper: resolves the caller once, then applies auth,
// blacklist and rate-limit before delegating to the route handler. Keeps these
// cross-cutting checks consistent instead of re-implementing them per route.
export function withApiGuard(handler: GuardedHandler, opts: GuardOptions = {}) {
  return async (req: NextRequest): Promise<Response> => {
    const ip = getClientIp(req);
    let userId: string | null = null;
    let email: string | null = null;
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      email = user?.email ?? null;
    } catch {
      /* treated as anonymous */
    }

    if (opts.requireAuth && !userId) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập để tiếp tục.' },
        { status: 401 },
      );
    }

    if (opts.blacklist && (await isBlacklisted({ userId, email, ip }))) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc thiết bị của bạn đang bị hạn chế thao tác này.' },
        { status: 403 },
      );
    }

    if (opts.rateLimit) {
      const identifier = userId ?? ip;
      const rl = await rateLimit(
        opts.rateLimit.bucket,
        identifier,
        opts.rateLimit.limit,
        opts.rateLimit.windowSec,
      );
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
        );
      }
    }

    return handler(req, { userId, email, ip });
  };
}
