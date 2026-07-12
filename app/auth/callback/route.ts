import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';

// OAuth (Google) redirect target. Supabase sends the user back here with a
// short-lived ?code that we exchange for a session cookie, then forward the
// user on to ?next (defaults to home).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Behind a reverse proxy (Nginx/Cloudflare), request.url carries the internal
  // localhost origin. Reconstruct the public origin from forwarded headers or
  // fall back to the configured site URL.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? origin);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${next.startsWith('/') ? next : `/${next}`}`);
    }
  }

  // Failed / missing code — send back to login with a flag.
  return NextResponse.redirect(`${publicOrigin}/login?error=oauth`);
}
