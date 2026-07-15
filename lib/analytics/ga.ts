// Client-side GA4 ecommerce events (gtag.js). Fires-and-forgets; never throws.
// Server-confirmed money events (purchase / refund) are sent server-side via the
// Measurement Protocol — see lib/analytics/ga-server.ts — NOT from here.

const CURRENCY = 'VND';

type GtagFn = (command: string, eventName: string, params?: Record<string, unknown>) => void;

function gtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { gtag?: GtagFn };
  return typeof w.gtag === 'function' ? w.gtag : null;
}

export interface GaItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_category?: string;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
}

// Minimal product/cart shape needed to build a GA item.
type ProductLike = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  quantity?: number;
};

export function toGaItem(p: ProductLike, quantity?: number): GaItem {
  return {
    item_id: p.id,
    item_name: p.name,
    price: p.price,
    quantity: quantity ?? p.quantity ?? 1,
    ...(p.category ? { item_category: p.category } : {}),
  };
}

export function sumValue(items: GaItem[]): number {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

// Generic safe emitter.
export function gaEvent(name: string, params: Record<string, unknown> = {}): void {
  try {
    const g = gtag();
    if (!g) return;
    g('event', name, params);
  } catch {
    /* fail silently */
  }
}

// ── Product / list ──
export function gaViewItem(p: ProductLike): void {
  const item = toGaItem(p, 1);
  gaEvent('view_item', { currency: CURRENCY, value: item.price, items: [item] });
}

export function gaViewItemList(products: ProductLike[], listId: string, listName: string): void {
  const items = products.map((p, i) => ({ ...toGaItem(p, 1), item_list_id: listId, item_list_name: listName, index: i }));
  gaEvent('view_item_list', { item_list_id: listId, item_list_name: listName, items });
}

export function gaSelectItem(p: ProductLike, listId: string, listName: string, index?: number): void {
  const item: GaItem = { ...toGaItem(p, 1), item_list_id: listId, item_list_name: listName, ...(index != null ? { index } : {}) };
  gaEvent('select_item', { item_list_id: listId, item_list_name: listName, items: [item] });
}

// ── Cart ──
export function gaAddToCart(p: ProductLike, quantity = 1): void {
  const item = toGaItem(p, quantity);
  gaEvent('add_to_cart', { currency: CURRENCY, value: item.price * item.quantity, items: [item] });
}

export function gaRemoveFromCart(p: ProductLike, quantity?: number): void {
  const item = toGaItem(p, quantity);
  gaEvent('remove_from_cart', { currency: CURRENCY, value: item.price * item.quantity, items: [item] });
}

export function gaViewCart(items: GaItem[]): void {
  gaEvent('view_cart', { currency: CURRENCY, value: sumValue(items), items });
}

// ── Checkout journey ──
export function gaBeginCheckout(items: GaItem[], value?: number): void {
  gaEvent('begin_checkout', { currency: CURRENCY, value: value ?? sumValue(items), items });
}

export function gaAddShippingInfo(items: GaItem[], value: number, shippingTier?: string): void {
  gaEvent('add_shipping_info', {
    currency: CURRENCY,
    value,
    ...(shippingTier ? { shipping_tier: shippingTier } : {}),
    items,
  });
}

export function gaAddPaymentInfo(items: GaItem[], value: number, paymentType?: string): void {
  gaEvent('add_payment_info', {
    currency: CURRENCY,
    value,
    ...(paymentType ? { payment_type: paymentType } : {}),
    items,
  });
}

// Custom: fired when the order is created (before payment is confirmed). The real
// `purchase` is sent server-side only once payment is confirmed.
export function gaOrderCreated(orderId: string, items: GaItem[], value: number): void {
  gaEvent('order_created', { transaction_id: orderId, currency: CURRENCY, value, items });
}

// ── Promotions ──
export function gaViewPromotion(promotionId: string, promotionName: string, creativeSlot?: string): void {
  gaEvent('view_promotion', {
    promotion_id: promotionId,
    promotion_name: promotionName,
    ...(creativeSlot ? { creative_slot: creativeSlot } : {}),
  });
}

export function gaSelectPromotion(promotionId: string, promotionName: string, creativeSlot?: string): void {
  gaEvent('select_promotion', {
    promotion_id: promotionId,
    promotion_name: promotionName,
    ...(creativeSlot ? { creative_slot: creativeSlot } : {}),
  });
}
