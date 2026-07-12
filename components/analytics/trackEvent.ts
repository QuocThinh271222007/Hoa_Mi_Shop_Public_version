// Safe client-side event tracker. Fails silently — never throw.
export function trackEvent(params: {
  event_type: string;
  event_name?: string;
  path?: string;
  product_id?: string;
  metadata?: Record<string, unknown>;
}): void {
  try {
    const visitorId = typeof window !== 'undefined' ? (localStorage.getItem('cuc_vid') ?? '') : '';
    const sessionId = typeof window !== 'undefined' ? (sessionStorage.getItem('cuc_sid') ?? '') : '';
    const path = params.path ?? (typeof window !== 'undefined' ? window.location.pathname : '');

    const payload = { ...params, path, visitorId, sessionId };

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/event', JSON.stringify(payload));
    } else {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // fail silently
  }
}
