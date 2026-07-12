// Client-side analytics event tracker.
// Fires-and-forgets. Never throws, never blocks the user.

export function trackEvent(
  eventName: string,
  data?: {
    product_id?: string;
    order_id?: string;
    path?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    if (typeof window === 'undefined') return;
    const path = data?.path ?? window.location.pathname;
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'custom',
        event_name: eventName,
        path,
        product_id: data?.product_id,
        order_id: data?.order_id,
        metadata: data?.metadata,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fail silently
  }
}

// Convenience wrappers for common events
export const analytics = {
  productView: (productId: string, slug: string) =>
    trackEvent('product_view', { product_id: productId, path: `/products/${slug}` }),

  addToCart: (productId: string, quantity?: number) =>
    trackEvent('add_to_cart', { product_id: productId, metadata: { quantity } }),

  wishlistToggle: (productId: string, added: boolean) =>
    trackEvent('wishlist_toggle', { product_id: productId, metadata: { added } }),

  checkoutStart: (orderId?: string) =>
    trackEvent('checkout_start', { order_id: orderId }),
};
