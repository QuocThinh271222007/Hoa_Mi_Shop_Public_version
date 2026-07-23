import { NextRequest, NextResponse } from 'next/server';
import { expireStaleAwaitingOrders, ORDER_RECORDING_GRACE_DAYS } from '@/lib/payments/order-expiry';

// POST|GET /api/cron/expire-orders
//
// Cancels ABANDONED bank/QR checkouts older than the recording grace period
// (3 days), releasing their discount-code slot and clearing the Payments queue.
//
// Scope is deliberately narrow (see lib/payments/order-expiry.ts): COD orders,
// orders past `pending`, and pickup bookings dated in the future are never
// touched. This is the ONLY trigger for the sweep — it is intentionally not run
// from page loads, so a destructive action can never fire from just browsing.
//
// Protected by CRON_SECRET (header `x-cron-secret` or `?secret=`). If CRON_SECRET
// is not configured the endpoint is disabled — never leave a public mutation open.
// Safe to call repeatedly; it only touches orders past the grace window.

export const dynamic = 'force-dynamic';

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const provided = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret') ?? '';
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cancelled = await expireStaleAwaitingOrders();
  return NextResponse.json({ ok: true, cancelled, graceDays: ORDER_RECORDING_GRACE_DAYS });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
