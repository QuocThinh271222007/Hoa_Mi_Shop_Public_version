import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// POST /api/payments/report-transfer
// Called when customer clicks "Tôi đã chuyển khoản".
// Records the customer's claim without marking order as paid.
// Only admin or SePay webhook can set payment_status = 'paid'.
export async function POST(req: NextRequest) {
  // Require authenticated user
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const body = await req.json();
  const { orderId, paymentRequestId } = body as {
    orderId: string;
    paymentRequestId?: string | null;
  };

  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const db = createAdminSupabaseClient();
  const now = new Date().toISOString();

  // Verify ownership via user_id — do not allow cross-user updates
  const { data: order, error: orderFetchErr } = await db
    .from('orders')
    .select('id, user_id, status, payment_status, payment_code')
    .eq('id', orderId)
    .single();

  if (orderFetchErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const o = order as { id: string; user_id: string | null; status: string; payment_status: string; payment_code: string | null };
  if (o.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const params = new URLSearchParams({ orderId });
  if (paymentRequestId) params.set('paymentRequestId', paymentRequestId);
  if (o.payment_code) params.set('code', o.payment_code);
  const successRedirect = `/checkout/success?${params.toString()}`;
  const pendingRedirect = `/checkout/pending?${params.toString()}`;

  // Look up the payment request to branch on its real state.
  let prStatus = '';
  let providerStatus = '';
  if (paymentRequestId) {
    const { data: prRow } = await db
      .from('payment_requests')
      .select('status, provider_status')
      .eq('id', paymentRequestId)
      .eq('order_id', orderId) // scope to the owned order — never trust a client id alone
      .maybeSingle();
    const pr = prRow as { status: string; provider_status: string | null } | null;
    prStatus = (pr?.status ?? '').toLowerCase();
    providerStatus = (pr?.provider_status ?? '').toLowerCase();
  }

  // Already paid/confirmed (by SePay webhook or admin) — NOT an error.
  // Tell the client to go straight to the success page.
  if (o.payment_status === 'paid' || prStatus === 'paid') {
    return NextResponse.json({ ok: true, state: 'already_paid', redirectTo: successRedirect });
  }

  // Money already matched and waiting for an admin to confirm — pending, not error.
  if (providerStatus === 'matched_pending_admin') {
    return NextResponse.json({ ok: true, state: 'matched_pending_admin', redirectTo: pendingRedirect });
  }

  // Cancelled / failed / expired payment request — genuine terminal state.
  if (['cancelled', 'canceled', 'failed', 'expired'].includes(prStatus)) {
    return NextResponse.json({ error: 'PAYMENT_NOT_ACTIVE', state: prStatus }, { status: 409 });
  }

  // Awaiting state: record the customer's claim, shift to awaiting_verification.
  // customer_reported_transfer_at is added via migration 20260624_checkout_require_user_order_pending.sql
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: orderUpdateErr } = await (db.from('orders') as any).update({
    payment_status:                  'awaiting_verification',
    customer_reported_transfer_at:   now,
    updated_at:                      now,
  }).eq('id', orderId);

  if (orderUpdateErr) {
    console.error('report-transfer order update error:', orderUpdateErr.message);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }

  // Update payment_request if provided
  if (paymentRequestId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('payment_requests') as any).update({
      status:                          'awaiting_verification',
      customer_reported_transfer_at:   now,
      updated_at:                      now,
    }).eq('id', paymentRequestId).eq('order_id', orderId); // scope to the owned order
    // Non-fatal if this fails — order update succeeded
  }

  return NextResponse.json({ ok: true, success: true, state: 'reported_pending', redirectTo: pendingRedirect });
}
