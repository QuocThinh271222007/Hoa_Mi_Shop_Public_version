import type { NextRequest } from 'next/server';

// Best-effort client IP. On Vercel/most proxies the real client is the first
// entry of x-forwarded-for. Never fully trustworthy (spoofable), so it is used
// only for rate-limit/blacklist heuristics, never as an auth control.
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Same, but from a headers object (server actions via next/headers, whose
// ReadonlyHeaders is structurally a `.get()`-only view).
export function getClientIpFromHeaders(h: { get(name: string): string | null }): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return h.get('x-real-ip')?.trim() || 'unknown';
}
