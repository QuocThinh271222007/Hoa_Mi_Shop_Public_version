import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { isOrderCancelledLike } from '@/lib/orders/status-mapping';

// GET /api/payments/status?orderId=...&paymentRequestId=...
//   (legacy alias: ?id=<paymentRequestId>)
//
// Returns the latest order + payment-request state for the authenticated owner.
// Used by the checkout "Tôi đã chuyển khoản" decision flow and for short polling.
//
// Security:
//   - Requires an authenticated session.
//   - The caller may only read an order/payment request they own (orders.user_id).
//   - Never marks anything paid; read-only. Does NOT expose bank/secret fields.

const PAID_PAYMENT_STATUS = new Set(['paid']);
const CONFIRMED_ORDER_STATUS = new Set(['confirmed', 'packing', 'packed', 'shipping', 'shipped', 'delivering', 'delivered']);
const FAILED_STATUS = new Set(['failed', 'cancelled', 'canceled', 'expired']);
const AWAITING_STATUS = new Set(['awaiting_payment', 'awaiting_verification']);

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();

export async function GET(req: NextRequest) {
  // 1. Require authenticated user.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const orderId = sp.get('orderId');
  const paymentRequestId = sp.get('paymentRequestId') ?? sp.get('id');

  if (!orderId && !paymentRequestId) {
    return NextResponse.json({ ok: false, error: 'Missing orderId or paymentRequestId' }, { status: 400 });
  }

  const db = createAdminSupabaseClient();

  type PrStatusRow = {
    id: string; order_id: string; status: string; amount: number;
    paid_at: string | null; expires_at: string | null;
    payment_mode: string; provider_status: string | null;
    auto_confirm_eligible: boolean; manual_required_reason: string | null;
  };
  const PR_SELECT =
    'id, order_id, status, amount, paid_at, expires_at, payment_mode, provider_status, auto_confirm_eligible, manual_required_reason';

  try {
    // 2. Resolve the payment request (latest for the order if only orderId given).
    let pr: PrStatusRow | null = null;

    if (paymentRequestId) {
      const { data } = await db
        .from('payment_requests')
        .select(PR_SELECT)
        .eq('id', paymentRequestId)
        .maybeSingle();
      pr = (data as unknown as PrStatusRow | null) ?? null;
    } else if (orderId) {
      const { data } = await db
        .from('payment_requests')
        .select(PR_SELECT)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      pr = (data as unknown as PrStatusRow | null) ?? null;
    }

    const resolvedOrderId = orderId ?? pr?.order_id ?? null;
    if (!resolvedOrderId) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    // 3. Load the order and enforce ownership.
    const { data: orderRow } = await db
      .from('orders')
      .select('id, user_id, status, payment_status, payment_code')
      .eq('id', resolvedOrderId)
      .maybeSingle();

    const order = orderRow as { id: string; user_id: string | null; status: string; payment_status: string; payment_code: string | null } | null;
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    if (order.user_id !== user.id) {
      // Do not leak existence of other users' orders.
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    // 4. Compute effective statuses (treat an expired-but-awaiting request as expired).
    const orderStatus = norm(order.status);
    const paymentStatus = norm(order.payment_status);
    let prStatus = norm(pr?.status);
    if (pr && pr.expires_at && AWAITING_STATUS.has(prStatus) && new Date(pr.expires_at) < new Date()) {
      prStatus = 'expired';
    }
    const paymentMode = pr?.payment_mode ?? null;
    const providerStatus = pr?.provider_status ?? null;

    const isPaid =
      PAID_PAYMENT_STATUS.has(paymentStatus) ||
      prStatus === 'paid';
    const isConfirmed = isPaid || CONFIRMED_ORDER_STATUS.has(orderStatus);

    const isFailedOrCancelled =
      !isPaid && (
        FAILED_STATUS.has(paymentStatus) ||
        FAILED_STATUS.has(prStatus) ||
        isOrderCancelledLike({ status: orderStatus, payment_status: paymentStatus })
      );

    const isAwaitingManualVerification =
      !isPaid && !isFailedOrCancelled && (
        norm(providerStatus) === 'matched_pending_admin' ||
        paymentMode === 'manual_bank_transfer' ||
        AWAITING_STATUS.has(paymentStatus) ||
        AWAITING_STATUS.has(prStatus)
      );

    // 5. Decide the next action. Paid wins; then failed; then pending.
    let nextAction: 'success' | 'pending' | 'failed' | 'unknown';
    if (isPaid || isConfirmed) {
      nextAction = 'success';
    } else if (isFailedOrCancelled) {
      nextAction = 'failed';
    } else if (isAwaitingManualVerification) {
      nextAction = 'pending';
    } else {
      nextAction = 'unknown';
    }

    const params = new URLSearchParams({ orderId: resolvedOrderId });
    if (pr?.id) params.set('paymentRequestId', pr.id);
    if (order.payment_code) params.set('code', order.payment_code);
    const redirectTo =
      nextAction === 'success'
        ? `/checkout/success?${params.toString()}`
        : `/checkout/pending?${params.toString()}`;

    return NextResponse.json({
      ok: true,
      orderId: resolvedOrderId,
      paymentRequestId: pr?.id ?? null,
      orderStatus,
      paymentStatus,
      paymentRequestStatus: prStatus,
      providerStatus,
      paymentMode,
      autoConfirmEligible: pr?.auto_confirm_eligible ?? null,
      manualRequiredReason: pr?.manual_required_reason ?? null,
      isPaid,
      isConfirmed,
      isAwaitingManualVerification,
      isFailedOrCancelled,
      nextAction,
      redirectTo,
    });
  } catch (err) {
    console.error('Payment status error:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
