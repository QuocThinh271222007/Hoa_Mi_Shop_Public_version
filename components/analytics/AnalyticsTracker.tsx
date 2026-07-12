'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Generates a random ID stored in sessionStorage. Falls back to a random string.
function getOrCreateId(key: string): string {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

// Tracks page views by posting to /api/analytics/page-view.
// Never called for /admin/* paths (blocked server-side too).
export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    // Don't track admin or API paths
    if (!pathname || pathname.startsWith('/admin') || pathname.startsWith('/api')) return;
    // Avoid double-tracking the same path in the same effect cycle
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    const visitorId = getOrCreateId('_chm_vid');
    const sessionId = getOrCreateId('_chm_sid');

    const params = new URLSearchParams(window.location.search);

    const payload = {
      path:        pathname,
      referrer:    document.referrer || null,
      title:       document.title || null,
      visitorId,
      sessionId,
      utmSource:   params.get('utm_source') ?? undefined,
      utmMedium:   params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
    };

    // Use sendBeacon for fire-and-forget; fall back to fetch
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/page-view', JSON.stringify(payload));
    } else {
      fetch('/api/analytics/page-view', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
