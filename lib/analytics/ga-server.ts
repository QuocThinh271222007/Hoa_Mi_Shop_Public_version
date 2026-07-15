// Server-side GA4 ecommerce via the Measurement Protocol.
//
// Used for money events that MUST NOT be missed or duplicated (purchase, refund).
// They are sent from the server the moment payment/refund is truly confirmed —
// never from the browser — and are de-duplicated with a per-order timestamp
// column (orders.ga_purchase_sent_at / ga_refund_sent_at).
//
// Required env (server-only):
//   NEXT_PUBLIC_GA_MEASUREMENT_ID  — the GA4 stream id, e.g. "G-XXXXXXXXXX"
//   GA4_API_SECRET                 — Measurement Protocol API secret (server env only)
//
// Everything here fails silently: analytics must never break checkout.

import type { NextRequest } from 'next/server';
import type { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

type Db = ReturnType<typeof createAdminSupabaseClient>;

const MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

function gaConfig(): { measurementId: string; apiSecret: string } | null {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return null;
  return { measurementId, apiSecret };
}

// The `_ga_<stream>` cookie name drops the leading "G-" from the measurement id.
function sessionCookieName(measurementId: string): string {
  return `_ga_${measurementId.replace(/^G-/, '')}`;
}

export interface GaIds {
  clientId: string | null;
  sessionId: string | null;
}

// Extract the GA4 client_id and session_id from the request cookies.
//   _ga            = "GA1.1.<clientId=random.timestamp>"   → last two dot-segments
//   _ga_<stream>   = "GS1.1.<sessionId>.<count>...."       → 3rd dot-segment
export function extractGaIds(req: NextRequest): GaIds {
  try {
    const cfg = gaConfig();
    const gaRaw = req.cookies.get('_ga')?.value ?? '';
    let clientId: string | null = null;
    if (gaRaw) {
      const parts = gaRaw.split('.');
      if (parts.length >= 4) clientId = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    }
    let sessionId: string | null = null;
    if (cfg) {
      const sessRaw = req.cookies.get(sessionCookieName(cfg.measurementId))?.value ?? '';
      if (sessRaw) {
        const parts = sessRaw.split('.');
        if (parts.length >= 3) sessionId = parts[2];
      }
    }
    return { clientId, sessionId };
  } catch {
    return { clientId: null, sessionId: null };
  }
}

type GaEvent = { name: string; params: Record<string, unknown> };

// Low-level Measurement Protocol send. Fire-and-forget; never throws.
async function sendGa4({
  clientId,
  sessionId,
  events,
}: {
  clientId: string | null;
  sessionId: string | null;
  events: GaEvent[];
}): Promise<boolean> {
  try {
    const cfg = gaConfig();
    if (!cfg) return false;
    // Without a browser client_id we can't attribute to a session, but we still
    // want the revenue recorded — synthesise a stable-ish anonymous client_id.
    const cid = clientId || `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;

    const enriched = events.map((e) => ({
      name: e.name,
      params: {
        // engagement_time_msec + session_id let GA4 attach the event to the session.
        engagement_time_msec: 1,
        ...(sessionId ? { session_id: sessionId } : {}),
        ...e.params,
      },
    }));

    const url = `${MP_ENDPOINT}?measurement_id=${encodeURIComponent(cfg.measurementId)}&api_secret=${encodeURIComponent(cfg.apiSecret)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cid, events: enriched }),
      // Don't let a slow GA endpoint hold up the request path.
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

type OrderItemRow = { product_id: string | null; product_name: string; unit_price: number; quantity: number };
type OrderRow = {
  id: string;
  total_amount: number | null;
  subtotal: number | null;
  ga_client_id: string | null;
  ga_session_id: string | null;
  ga_purchase_sent_at: string | null;
  ga_refund_sent_at: string | null;
};

async function loadOrderForGa(db: Db, orderId: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  const { data: order } = await anyDb
    .from('orders')
    .select('id, total_amount, subtotal, ga_client_id, ga_session_id, ga_purchase_sent_at, ga_refund_sent_at')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;
  const { data: items } = await anyDb
    .from('order_items')
    .select('product_id, product_name, unit_price, quantity')
    .eq('order_id', orderId);
  return { order: order as OrderRow, items: (items ?? []) as OrderItemRow[] };
}

function toGaItems(items: OrderItemRow[]) {
  return items.map((it) => ({
    item_id: it.product_id ?? it.product_name,
    item_name: it.product_name,
    price: it.unit_price,
    quantity: it.quantity,
  }));
}

// Send the GA4 `purchase` exactly once for a paid order. Safe to call from any
// path that confirms payment (COD placement, zero-amount, SePay webhook, customer
// confirm, admin confirm) — the ga_purchase_sent_at guard prevents duplicates.
export async function sendPurchaseForOrder(db: Db, orderId: string): Promise<void> {
  try {
    if (!gaConfig()) return;
    const loaded = await loadOrderForGa(db, orderId);
    if (!loaded) return;
    const { order, items } = loaded;
    if (order.ga_purchase_sent_at) return; // already sent

    const value = order.total_amount ?? order.subtotal ?? 0;
    const ok = await sendGa4({
      clientId: order.ga_client_id,
      sessionId: order.ga_session_id,
      events: [
        {
          name: 'purchase',
          params: {
            transaction_id: order.id, // unique order id
            currency: 'VND',
            value,
            items: toGaItems(items),
          },
        },
      ],
    });
    if (ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.from('orders') as any)
        .update({ ga_purchase_sent_at: new Date().toISOString() })
        .eq('id', orderId)
        .is('ga_purchase_sent_at', null);
    }
  } catch {
    /* never break the caller */
  }
}

// Send the GA4 `refund` exactly once, only when a refund is truly completed.
export async function sendRefundForOrder(db: Db, orderId: string): Promise<void> {
  try {
    if (!gaConfig()) return;
    const loaded = await loadOrderForGa(db, orderId);
    if (!loaded) return;
    const { order, items } = loaded;
    if (order.ga_refund_sent_at) return; // already sent

    const value = order.total_amount ?? order.subtotal ?? 0;
    const ok = await sendGa4({
      clientId: order.ga_client_id,
      sessionId: order.ga_session_id,
      events: [
        {
          name: 'refund',
          params: {
            transaction_id: order.id,
            currency: 'VND',
            value,
            items: toGaItems(items),
          },
        },
      ],
    });
    if (ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.from('orders') as any)
        .update({ ga_refund_sent_at: new Date().toISOString() })
        .eq('id', orderId)
        .is('ga_refund_sent_at', null);
    }
  } catch {
    /* never break the caller */
  }
}

// A non-money custom event tied to an order (e.g. COD cash collected on delivery).
// Not de-duplicated — callers should fire it on a one-shot admin action.
export async function sendOrderCustomEvent(
  db: Db,
  orderId: string,
  name: string,
  extraParams: Record<string, unknown> = {},
): Promise<void> {
  try {
    if (!gaConfig()) return;
    const loaded = await loadOrderForGa(db, orderId);
    if (!loaded) return;
    const { order } = loaded;
    await sendGa4({
      clientId: order.ga_client_id,
      sessionId: order.ga_session_id,
      events: [
        {
          name,
          params: {
            transaction_id: order.id,
            currency: 'VND',
            value: order.total_amount ?? order.subtotal ?? 0,
            ...extraParams,
          },
        },
      ],
    });
  } catch {
    /* never break the caller */
  }
}
