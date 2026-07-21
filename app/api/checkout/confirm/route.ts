// POST /api/checkout/confirm
//
// Called when the customer clicks "Tôi đã chuyển khoản" on the QR pending page.
//
// The `orders` + `order_items` + `payment_requests` rows already exist —
// they were created by /api/checkout/prepare so that the SePay webhook always
// has a payment_requests row to match incoming bank transactions against, even
// before the customer clicks this button.
//
// This route only reconciles against the SePay bank_transactions table:
//
//   • paid          → a SePay credit matches the payment code AND the amount.
//                     The existing order is marked PAID/confirmed, stock is
//                     deducted, and the customer is sent to the success page.
//   • wrong_content → a transfer exists but the memo/amount does not match.
//                     The order/payment_request are marked awaiting_verification
//                     so admin can see and manually reconcile them.
//   • not_paid      → no matching transfer found. Same awaiting_verification
//                     marking; customer is told the payment was not received.

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { CheckoutError } from '@/lib/payments/checkout-pipeline';
import { findSePayMatch } from '@/lib/payments/sepay-match';
import { applyOrderStock } from '@/lib/admin/order-stock';
import { countDiscountUsageForPaidOrder } from '@/lib/payments/discount-usage';
import { incrementSePayQuota, currentQuotaMonth } from '@/lib/payments/provider-quota';
import { sendPurchaseForOrder } from '@/lib/analytics/ga-server';
import { isBeyondRecordingGrace } from '@/lib/payments/order-expiry';

const WRONG_CONTENT_MESSAGE =
  'Chúng mình đã nhận được một giao dịch nhưng nội dung hoặc số tiền chưa khớp. ' +
  'Vui lòng liên hệ admin hoặc fanpage để được hỗ trợ.';
const NOT_PAID_MESSAGE =
  'Chưa ghi nhận được giao dịch chuyển khoản của bạn. Nếu bạn vừa chuyển, vui lòng đợi ' +
  'một chút rồi thử lại; nếu chưa, vui lòng hoàn tất chuyển khoản đúng nội dung và số tiền.';
const SESSION_INVALID_MESSAGE =
  'Phiên thanh toán không hợp lệ hoặc đã hết hạn. Vui lòng đặt lại đơn hàng.';
const MANUAL_PENDING_MESSAGE =
  'Đã ghi nhận yêu cầu của bạn. Đơn hàng đang chờ shop xác nhận chuyển khoản thủ công — ' +
  'bạn có thể theo dõi trạng thái trong Lịch sử đơn hàng.';
const EXPIRED_MESSAGE =
  'Đơn hàng này đã quá hạn thanh toán (3 ngày) và không còn hiệu lực. Vui lòng đặt lại đơn hàng mới.';

type ExistingOrder = {
  id: string;
  user_id: string | null;
  payment_status: string;
  status: string;
  total_amount: number;
  payment_code: string | null;
  created_at: string | null;
};

type PaymentRequestRow = {
  id: string;
  amount: number;
  status: string;
  payment_mode: string;
  quota_month: string | null;
  quota_counted: boolean;
  provider: string | null;
};

export async function POST(req: NextRequest) {
  try {
    // Auth required
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    const body = await req.json();
    const { paymentCode } = body as { paymentCode: string };

    const code = paymentCode?.trim();
    if (!code) {
      return NextResponse.json({ error: 'Missing paymentCode.' }, { status: 400 });
    }

    // Verify the payment code was issued by /prepare for THIS user.
    // Prevents User B from using User A's payment code to claim User A's transaction.
    // Verification is skipped gracefully when the secret is not configured (feature disabled)
    // or when the client is on an old session pre-dating this feature (no codeSignature stored).
    const codeSecret = process.env.PAYMENT_CODE_SECRET || process.env.SEPAY_WEBHOOK_SECRET || '';
    const codeSignature = (body.codeSignature as string | undefined)?.trim() || '';
    if (codeSecret && codeSignature) {
      const expected = createHmac('sha256', codeSecret)
        .update(`${user.id}:${code}`)
        .digest('hex');
      const valid = codeSignature.length === expected.length
        && timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(codeSignature, 'utf8'));
      if (!valid) {
        return NextResponse.json(
          { error: 'Mã thanh toán không hợp lệ hoặc không thuộc về tài khoản này.' },
          { status: 403 },
        );
      }
    }

    const db = createAdminSupabaseClient();

    // The order was already created by /api/checkout/prepare. Look it up by
    // payment_code, scoped to this user (never trust client-supplied ids).
    const { data: existingOrderData } = await db
      .from('orders')
      .select('id, user_id, payment_status, status, total_amount, payment_code, created_at')
      .eq('payment_code', code)
      .eq('user_id', user.id)
      .maybeSingle();

    const existingOrder = existingOrderData as ExistingOrder | null;
    if (!existingOrder) {
      return NextResponse.json({ error: SESSION_INVALID_MESSAGE }, { status: 400 });
    }

    const orderId = existingOrder.id;

    // Latest payment_request for this order.
    const { data: prData } = await db
      .from('payment_requests')
      .select('id, amount, status, payment_mode, quota_month, quota_counted, provider')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const paymentRequest = prData as PaymentRequestRow | null;
    const paymentRequestId = paymentRequest?.id ?? null;

    // ── Already paid (previous confirm call, or the webhook auto-confirmed in
    // the background) → idempotent success response, same shape as a fresh paid. ──
    if (existingOrder.payment_status === 'paid') {
      const params = new URLSearchParams({ orderId, code });
      if (paymentRequestId) params.set('paymentRequestId', paymentRequestId);
      return NextResponse.json({
        ok:              true,
        status:          'paid',
        orderId,
        paymentRequestId,
        paymentCode:     code,
        amount:          paymentRequest?.amount ?? existingOrder.total_amount,
        redirectTo:      `/checkout/success?${params.toString()}`,
      });
    }

    // Stored amount — never recompute at confirm-time (avoids false amount
    // mismatches if a product price/discount changed between prepare and confirm).
    const storedAmount = paymentRequest?.amount ?? existingOrder.total_amount;

    // ── P4. Recording window ──
    // We deliberately do NOT reject on payment_requests.expires_at (~30 min): that
    // is only the auto-confirm window, and a late transfer is still real money.
    // The order dies only after the 3-day grace period.
    if (isBeyondRecordingGrace(existingOrder.created_at)) {
      return NextResponse.json(
        { ok: false, status: 'expired', message: EXPIRED_MESSAGE },
        { status: 200 },
      );
    }

    // ── P2 / P3. Manual mode never auto-confirms ──
    // Only sepay_auto requests may be settled by this route. A manual-mode request
    // (SePay disabled, or the monthly auto-confirm quota is used up) is RECORDED for
    // admin review instead — and the customer is told exactly that, rather than the
    // misleading red "chưa ghi nhận giao dịch" the SePay-centric path would return.
    const paymentMode = paymentRequest?.payment_mode ?? 'manual_bank_transfer';
    if (paymentMode !== 'sepay_auto') {
      const now = new Date().toISOString();
      await db.from('orders').update({
        payment_status:                'awaiting_verification',
        customer_reported_transfer_at: now,
        updated_at:                    now,
      } as never).eq('id', orderId);

      if (paymentRequestId) {
        await db.from('payment_requests').update({
          status:                        'awaiting_verification',
          customer_reported_transfer_at: now,
          updated_at:                    now,
        } as never).eq('id', paymentRequestId);
      }

      // If the money is already visible, link it so admin sees "tiền đã về" —
      // still without confirming (that stays an explicit admin decision).
      const manualMatch = await findSePayMatch(db, code, storedAmount);
      if (manualMatch.outcome === 'paid') {
        await db.from('bank_transactions').update({
          status:                     'matched_pending_admin',
          matched_order_id:           orderId,
          matched_payment_request_id: paymentRequestId,
        } as never)
          .eq('id', manualMatch.transaction.id)
          .in('status', ['unmatched']);
        if (paymentRequestId) {
          await db.from('payment_requests').update({
            provider_status: 'matched_pending_admin',
            updated_at:      now,
          } as never).eq('id', paymentRequestId);
        }
      }

      return NextResponse.json(
        { ok: true, status: 'pending_admin', orderId, paymentRequestId, message: MANUAL_PENDING_MESSAGE },
        { status: 200 },
      );
    }

    // ── Reconcile against SePay bank_transactions ──
    // Retry a few times to absorb webhook lag (bank → SePay → our webhook can take
    // a few seconds). Only 'not_paid' is worth retrying; the other states are stable.
    let match = await findSePayMatch(db, code, storedAmount);
    for (let i = 0; i < 2 && match.outcome === 'not_paid'; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      match = await findSePayMatch(db, code, storedAmount);
    }

    const now = new Date().toISOString();

    // ── Not paid → mark awaiting_verification so admin can see/reconcile, red label ──
    if (match.outcome === 'not_paid') {
      await db.from('orders').update({
        payment_status:                'awaiting_verification',
        customer_reported_transfer_at: now,
        updated_at:                    now,
      } as never).eq('id', orderId);
      if (paymentRequestId) {
        await db.from('payment_requests').update({
          status:                        'awaiting_verification',
          customer_reported_transfer_at: now,
          updated_at:                    now,
        } as never).eq('id', paymentRequestId);
      }
      return NextResponse.json(
        { ok: false, status: 'not_paid', message: NOT_PAID_MESSAGE },
        { status: 200 },
      );
    }

    // ── Transfer found but memo/amount wrong → mark awaiting_verification, yellow label ──
    if (match.outcome === 'wrong_content') {
      await db.from('orders').update({
        payment_status:                'awaiting_verification',
        customer_reported_transfer_at: now,
        updated_at:                    now,
      } as never).eq('id', orderId);
      if (paymentRequestId) {
        await db.from('payment_requests').update({
          status:                        'awaiting_verification',
          customer_reported_transfer_at: now,
          updated_at:                    now,
        } as never).eq('id', paymentRequestId);
      }
      return NextResponse.json(
        { ok: false, status: 'wrong_content', reason: match.reason, message: WRONG_CONTENT_MESSAGE },
        { status: 200 },
      );
    }

    // ── Paid → atomically claim the bank transaction first ──
    // This prevents a race condition where two concurrent confirm requests both
    // see the same transaction and confirm the same order twice. The UPDATE only
    // succeeds if the row is still in an unclaimed status; 0 rows returned = already claimed.
    const bankTxn = match.transaction;
    const { data: claimed } = await db
      .from('bank_transactions')
      .update({ status: 'processing' } as never)
      .eq('id', bankTxn.id)
      .in('status', ['unmatched', 'matched_pending_admin'])
      .select('id')
      .maybeSingle();

    if (!claimed) {
      // Another concurrent request already claimed this transaction.
      return NextResponse.json(
        { ok: false, status: 'not_paid', message: 'Giao dịch đang được xử lý. Vui lòng đợi giây lát rồi thử lại.' },
        { status: 200 },
      );
    }

    // ── Order already existed (created at prepare-time) → update it to paid ──
    const { error: orderErr } = await db
      .from('orders')
      .update({
        payment_status:      'paid',
        paid_at:              now,
        bank_transaction_id:  bankTxn.id,
        status:               'confirmed',
        updated_at:           now,
      } as never)
      .eq('id', orderId);

    if (orderErr) {
      console.error('checkout/confirm order update error:', orderErr.message);
      // Roll back the claim so the customer (or a retry) can try again.
      await db.from('bank_transactions')
        .update({ status: 'unmatched' } as never)
        .eq('id', bankTxn.id);
      return NextResponse.json({ error: 'Không thể xác nhận đơn hàng. Vui lòng thử lại.' }, { status: 500 });
    }

    // order_items were already inserted at prepare-time — do not insert again here.

    // ── payment_request (already exists from prepare) → update to paid ──
    if (paymentRequestId) {
      const { error: prErr } = await db
        .from('payment_requests')
        .update({
          status:                 'paid',
          paid_at:                now,
          matched_transaction_id: bankTxn.id,
          provider_status:        'confirmed',
          quota_counted:          true,
          updated_at:             now,
        } as never)
        .eq('id', paymentRequestId);
      if (prErr) console.error('checkout/confirm payment_request update error:', prErr.message);
    }

    // ── Consume the bank transaction so it can't pay for another order ──
    await db.from('bank_transactions').update({
      status:                     'matched',
      matched_order_id:           orderId,
      matched_payment_request_id: paymentRequestId,
      matched_at:                 now,
    } as never).eq('id', bankTxn.id);

    // ── Payment confirmed → deduct stock + count discount usage (idempotent) ──
    await applyOrderStock(orderId, 'deduct');
    await countDiscountUsageForPaidOrder(orderId);

    // ── GA4 purchase (server-side, sent exactly once via the dedup guard) ──
    await sendPurchaseForOrder(db, orderId);

    // ── Increment monthly SePay quota — only for requests that were actually
    // eligible for auto-confirm at prepare-time, and only once per payment. ──
    if (paymentRequest && paymentRequest.payment_mode === 'sepay_auto' && !paymentRequest.quota_counted) {
      const quotaMonth   = paymentRequest.quota_month ?? currentQuotaMonth();
      const defaultLimit = parseInt(process.env.SEPAY_MONTHLY_FREE_QUOTA ?? '50', 10);
      await incrementSePayQuota('sepay', quotaMonth, defaultLimit);
    }

    const params = new URLSearchParams({ orderId, code });
    if (paymentRequestId) params.set('paymentRequestId', paymentRequestId);

    return NextResponse.json({
      ok:              true,
      status:          'paid',
      orderId,
      paymentRequestId,
      paymentCode:     code,
      amount:          storedAmount,
      redirectTo:      `/checkout/success?${params.toString()}`,
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.userMessage }, { status: err.status });
    }
    console.error('checkout/confirm error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
  }
}
