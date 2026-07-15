// POST /api/checkout/prepare
//
// QR-only pre-order step. Validates the full cart/shipping/discount pipeline on
// the server, creates the `orders` + `order_items` + `payment_requests` rows
// (status: awaiting_payment), and returns bank info + QR data.
//
// Creating the order/payment_request here (instead of in /api/checkout/confirm)
// ensures the SePay webhook always has a payment_requests row to match against,
// even if the bank transaction arrives before the customer clicks
// "Tôi đã chuyển khoản" (or while confirm's retry loop is still running).
//
// COD and zero-amount orders must still go through /api/checkout directly.

import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { generatePaymentCode } from '@/lib/payments/payment-code';
import { choosePaymentModeForNewRequest } from '@/lib/payments/provider-quota';
import {
  runCheckoutPipeline,
  getBankSettings,
  buildDynamicQrImageUrl,
  CheckoutError,
} from '@/lib/payments/checkout-pipeline';
import { extractGaIds } from '@/lib/analytics/ga-server';
import type { CartItem } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    // Auth required
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    const body = await req.json();
    const {
      name, phone, email, address, province, district, ward,
      provinceId, districtId, wardId, orderNote, deliveryMode,
      deliveryTime, cart,
    } = body as {
      name: string; phone: string; email?: string; address?: string;
      province?: string; district?: string; ward?: string;
      provinceId?: string; districtId?: string; wardId?: string;
      orderNote?: string; deliveryMode?: string; deliveryTime?: string;
      cart: CartItem[];
    };

    const discountCodes: string[] = Array.isArray(body.discountCodes)
      ? (body.discountCodes as string[]).filter((c) => typeof c === 'string' && c.trim())
      : [];

    // Refuse COD — it goes through /api/checkout directly.
    if (body.paymentMethod === 'cod') {
      return NextResponse.json({ error: 'Use /api/checkout for COD orders.' }, { status: 400 });
    }

    const db = createAdminSupabaseClient();

    // Admin flag (skips per-user discount usage limit)
    const { data: adminRow } = await db
      .from('admin_users').select('id').eq('user_id', user.id).maybeSingle();
    const isAdmin = !!adminRow;

    const settings = await getBankSettings(db);

    // Full server-side validation (prices, stock, shipping, discounts)
    const summary = await runCheckoutPipeline(db, {
      name, phone, email, address, province, district, ward,
      provinceId, districtId, wardId, orderNote, deliveryMode, deliveryTime,
      paymentMethod: 'bank_transfer',
      cart, discountCodes, userId: user.id, isAdmin,
    }, settings);

    // Zero-amount: no QR needed — redirect to /api/checkout instead.
    if (summary.totalAmount === 0) {
      return NextResponse.json({
        error: 'Zero-amount orders should use /api/checkout directly.',
      }, { status: 400 });
    }

    // Generate payment code (stored in localStorage; re-verified on confirm).
    const paymentCode = generatePaymentCode();

    // Sign the code with the user's ID so confirm can verify this code was
    // issued to THIS user — prevents User B claiming User A's bank transaction
    // by reusing User A's payment code.
    // PAYMENT_CODE_SECRET must be set in production. Falls back to SEPAY_WEBHOOK_SECRET
    // so sites that already have a webhook secret don't need a second env var.
    const codeSecret = process.env.PAYMENT_CODE_SECRET || process.env.SEPAY_WEBHOOK_SECRET || '';
    const codeSignature = codeSecret
      ? createHmac('sha256', codeSecret).update(`${user.id}:${paymentCode}`).digest('hex')
      : null;

    // Build QR payload from template if configured
    const qrTemplate = settings['checkout_qr_payload_template'] || '';
    const qrPayload = qrTemplate
      .replace('{amount}', String(summary.totalAmount))
      .replace('{code}', paymentCode)
      .replace('{account}', settings['checkout_bank_account_number'] || '') || null;

    // ── Choose payment mode (quota-aware) and persist order + payment_request now,
    // so the SePay webhook always has a payment_requests row to match against,
    // even if the transfer arrives before the customer clicks "Tôi đã chuyển khoản". ──
    const paymentMode = await choosePaymentModeForNewRequest();

    // GA4 attribution ids from the browser's _ga cookies, stored so the
    // server-side purchase (sent when this order is later confirmed paid) joins
    // the same GA4 user/session.
    const { clientId: gaClientId, sessionId: gaSessionId } = extractGaIds(req);

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        user_id:                  user.id,
        customer_name:            summary.name,
        customer_phone:           summary.phone,
        customer_email:           summary.email,
        shipping_address:         summary.shippingAddress,
        subtotal:                 summary.subtotal,
        shipping_fee:             summary.shippingFee,
        shipping_discount_amount: summary.shippingDiscount,
        discount_amount:          summary.discount,
        discount_type:            summary.discountType,
        discount_code:            summary.validatedDiscountCode,
        discount_code_id:         summary.validatedDiscountCodeId,
        total_amount:             summary.totalAmount,
        payment_method:           'bank_transfer',
        payment_status:           'awaiting_payment',
        order_note:               summary.orderNote,
        status:                   'pending',
        payment_code:             paymentCode,
        ga_client_id:             gaClientId,
        ga_session_id:            gaSessionId,
        ...(summary.deliveryTime ? { pickup_time: summary.deliveryTime } : {}),
      } as never)
      .select('id')
      .single();

    if (orderErr || !order) {
      console.error('checkout/prepare order insert error:', orderErr?.message);
      throw new CheckoutError('Không thể chuẩn bị đơn hàng. Vui lòng thử lại.', 500);
    }

    const orderId = (order as { id: string }).id;

    const orderItems = summary.validatedItems.map((item) => ({
      order_id:     orderId,
      product_id:   item.productId,
      product_name: item.productName,
      unit_price:   item.unitPrice,
      quantity:     item.quantity,
    }));
    const { error: itemsErr } = await db.from('order_items').insert(orderItems);
    if (itemsErr) console.error('checkout/prepare order_items error:', itemsErr.message);

    // Calculate expiry (same as legacy /api/checkout route)
    const expiryMinutes = parseInt(settings['checkout_payment_expiry_minutes'] || '30');
    const expiresAt     = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    const { data: pr, error: prErr } = await db
      .from('payment_requests')
      .insert({
        order_id:               orderId,
        amount:                 summary.totalAmount,
        currency:               'VND',
        method:                 'bank_transfer',
        status:                 'awaiting_payment',
        payment_code:           paymentCode,
        bank_account_name:      settings['checkout_bank_account_name'] || null,
        bank_account_number:    settings['checkout_bank_account_number'] || null,
        bank_name:              settings['checkout_bank_name'] || null,
        bank_branch:            settings['checkout_bank_branch'] || null,
        qr_payload:             qrPayload,
        expires_at:             expiresAt,
        payment_mode:           paymentMode.paymentMode,
        provider:               paymentMode.provider,
        quota_month:            paymentMode.quotaMonth,
        auto_confirm_eligible:  paymentMode.autoConfirmEligible,
        manual_required_reason: paymentMode.manualRequiredReason,
      })
      .select('id')
      .single();

    if (prErr || !pr) {
      console.error('checkout/prepare payment_request insert error:', prErr?.message);
      // Roll back the order/order_items so we don't leave a half-written order
      // with no payment_request for the customer/admin to reconcile against.
      await db.from('order_items').delete().eq('order_id', orderId);
      await db.from('orders').delete().eq('id', orderId);
      throw new CheckoutError('Không thể chuẩn bị đơn hàng. Vui lòng thử lại.', 500);
    }

    const paymentRequestId = (pr as { id: string }).id;

    return NextResponse.json({
      ok: true,
      paymentCode,
      codeSignature,
      orderId,
      paymentRequestId,
      amount:            summary.totalAmount,
      subtotal:          summary.subtotal,
      shippingFee:       summary.shippingFee,
      shippingDiscount:  summary.shippingDiscount,
      productDiscount:   summary.discount,
      bankName:          settings['checkout_bank_name'] || '',
      bankAccountNumber: settings['checkout_bank_account_number'] || '',
      bankAccountName:   settings['checkout_bank_account_name'] || '',
      qrPayload,
      qrImageUrl:        buildDynamicQrImageUrl(settings, summary.totalAmount, paymentCode),
      transferInstruction: settings['checkout_bank_transfer_instruction'] || 'Nhập đúng nội dung chuyển khoản.',
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.userMessage }, { status: err.status });
    }
    console.error('checkout/prepare error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
  }
}
