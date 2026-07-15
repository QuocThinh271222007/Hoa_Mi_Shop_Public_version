import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { choosePaymentModeForNewRequest } from '@/lib/payments/provider-quota';
import { generatePaymentCode } from '@/lib/payments/payment-code';
import { validateDiscountCode } from '@/lib/payments/discount';
import { buildVietQrImageUrl } from '@/lib/payments/vietqr';
import { readShippingConfig } from '@/lib/payments/shipping';
import { applyOrderStock } from '@/lib/admin/order-stock';
import { validateCheckoutInput } from '@/lib/validation/checkout';
import { extractGaIds, sendPurchaseForOrder } from '@/lib/analytics/ga-server';
import type { CartItem } from '@/lib/types';

/**
 * Builds the VietQR image URL for this specific order.
 * Priority: site_settings checkout_bank_id → env BANK_QR_BANK_ID → hardcoded Sacombank BIN.
 * checkout_bank_id stores the VietQR BIN (e.g. "970403"), NOT the display name.
 * Falls back to '' if required data is still missing after all sources.
 */
function buildDynamicQrImageUrl(
  settings: Record<string, string>,
  amount: number,
  paymentCode: string,
): string {
  // Use checkout_bank_id (BIN) for the VietQR URL — NOT checkout_bank_name (display name)
  // No hardcoded account fallback: an unconfigured shop must NOT silently route
  // payments to some default account. Configure bank details in Admin → Settings
  // (or the BANK_QR_* env vars).
  const bankId      = settings['checkout_bank_id']             || process.env.BANK_QR_BANK_ID       || '';
  const accountNo   = settings['checkout_bank_account_number'] || process.env.BANK_QR_ACCOUNT_NO    || '';
  const accountName = settings['checkout_bank_account_name']   || process.env.BANK_QR_ACCOUNT_NAME  || '';
  const template    = (
    settings['checkout_bank_qr_template'] ||
    process.env.BANK_QR_TEMPLATE ||
    'compact2'
  ) as 'compact' | 'compact2' | 'qr_only';

  return buildVietQrImageUrl({ bankId, accountNo, accountName, amount, addInfo: paymentCode, template });
}

async function getBankSettings(db: ReturnType<typeof createAdminSupabaseClient>) {
  const { data } = await db
    .from('site_settings')
    .select('key, value')
    .in('key', [
      'checkout_bank_id',
      'checkout_bank_name',
      'checkout_bank_account_number',
      'checkout_bank_account_name',
      'checkout_bank_branch',
      'checkout_bank_transfer_instruction',
      'checkout_bank_qr_template',
      'checkout_qr_payload_template',
      'checkout_qr_image_url',
      'checkout_shipping_fee',
      'checkout_payment_expiry_minutes',
      // Shipping configuration (group 'shipping')
      'shipping_enabled',
      'shipping_default_fee',
      'shipping_free_threshold',
      'shipping_pickup_enabled',
      'shipping_hcm_fee',
      'shipping_other_province_fee',
      'shipping_estimated_min_days',
      'shipping_estimated_max_days',
      'shipping_cutoff_hour',
    ]);

  const settings: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string | null }[]) {
    settings[row.key] = row.value ?? '';
  }
  return settings;
}

export async function POST(req: NextRequest) {
  try {
    // Require authenticated user — do not trust user id from request body
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const body = await req.json();

    const { name, phone, email, address, province, district, ward, provinceId, districtId, wardId, orderNote, deliveryMode, deliveryTime, paymentMethod, cart } = body as {
      name: string;
      phone: string;
      email?: string;
      address?: string;
      province?: string;
      district?: string;
      ward?: string;
      provinceId?: string;
      districtId?: string;
      wardId?: string;
      orderNote?: string;
      deliveryMode?: string;
      deliveryTime?: string;
      paymentMethod?: string;
      cart: CartItem[];
    };

    // Only two methods are supported; anything else falls back to bank transfer.
    const isCod = paymentMethod === 'cod';

    // Support both single discountCode (legacy) and array discountCodes (new).
    // Deduplicate (case-insensitive) to prevent stacking the same code twice.
    // Only ONE code per order is kept — orders.discount_code_id is a single uuid
    // column, so multiple comma-joined ids would break the order INSERT.
    const rawCodes: string[] = [
      ...new Set(
        (Array.isArray(body.discountCodes)
          ? (body.discountCodes as string[]).filter((c) => typeof c === 'string' && c.trim())
          : typeof body.discountCode === 'string' && body.discountCode.trim()
          ? [body.discountCode.trim()]
          : []
        ).map((c) => c.toUpperCase().trim()),
      ),
    ].slice(0, 1);

    // Server-side input validation (mirrors client checks; cannot be bypassed).
    const validation = validateCheckoutInput({ name, phone, email, address, province, orderNote, deliveryMode });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Giỏ hàng trống.' }, { status: 400 });
    }
    // Validate quantities: a negative/non-integer quantity would slip past the
    // stock check and could drive the total to 0 (a "free" order).
    for (const item of cart) {
      const q = item?.quantity;
      if (typeof q !== 'number' || !Number.isInteger(q) || q < 1 || q > 1000) {
        return NextResponse.json({ error: 'Số lượng sản phẩm không hợp lệ.' }, { status: 400 });
      }
    }

    const db = createAdminSupabaseClient();

    // Enforce per-province allowed payment method for delivery orders (never
    // trust the client — a province may allow only QR or only COD). A district
    // set to 'qr'/'cod' overrides its province ('both' inherits the province).
    if (deliveryMode !== 'pickup' && provinceId) {
      const payIds = [provinceId, districtId].filter((x): x is string => typeof x === 'string' && !!x);
      const { data: payRows } = await db
        .from('location_options')
        .select('id, payment_methods')
        .in('id', payIds);
      // Cast via unknown: generated Supabase types don't include the additive
      // payment_methods column (migration for per-area payment methods).
      const payMap = new Map(
        ((payRows ?? []) as unknown as { id: string; payment_methods: string | null }[]).map((r) => [r.id, r.payment_methods ?? 'both']),
      );
      const provinceAllowed = payMap.get(provinceId) ?? 'both';
      const districtAllowed = districtId ? (payMap.get(districtId) ?? 'both') : 'both';
      const allowed = districtId && districtAllowed !== 'both' ? districtAllowed : provinceAllowed;
      const methodOk =
        allowed === 'both' ||
        (allowed === 'qr' && !isCod) ||
        (allowed === 'cod' && isCod);
      if (!methodOk) {
        return NextResponse.json(
          {
            error: allowed === 'qr'
              ? 'Khu vực này chỉ hỗ trợ thanh toán chuyển khoản qua QR.'
              : 'Khu vực này chỉ hỗ trợ thanh toán COD.',
          },
          { status: 400 }
        );
      }
    }

    // Detect admin to skip per-user discount usage limit
    const { data: adminRow } = await db
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const isAdmin = !!adminRow;

    const [settings, paymentMode] = await Promise.all([
      getBankSettings(db),
      choosePaymentModeForNewRequest(),
    ]);

    // Server-side price + stock validation — never trust client-supplied prices.
    // Real products (non-demo ids) are re-priced from the products table and
    // stock-checked; demo/fallback products keep the client price (no DB row).
    const realIds = cart
      .filter((i) => i.id && !i.id.startsWith('demo-'))
      .map((i) => i.id);

    const priceMap = new Map<string, { price: number; stock: number; name: string }>();
    if (realIds.length > 0) {
      const { data: prodRows } = await db
        .from('products')
        .select('id, price, stock, name')
        .in('id', realIds);
      for (const p of (prodRows ?? []) as { id: string; price: number; stock: number; name: string }[]) {
        priceMap.set(p.id, { price: p.price, stock: p.stock ?? 0, name: p.name });
      }
    }

    const outOfStock: string[] = [];
    const validatedItems = cart.map((item) => {
      const dbProduct = item.id && !item.id.startsWith('demo-') ? priceMap.get(item.id) : undefined;
      // Use the trusted DB price when the product exists; otherwise (demo/fallback
      // catalog) fall back to the client price since there is no row to validate.
      const unitPrice = dbProduct ? dbProduct.price : item.price;
      if (dbProduct && dbProduct.stock < item.quantity) {
        outOfStock.push(dbProduct.name);
      }
      return {
        productId:   dbProduct ? item.id : null,
        productName: item.name,
        unitPrice,
        quantity:    item.quantity,
      };
    });

    if (outOfStock.length > 0) {
      return NextResponse.json(
        { error: `Một số sản phẩm đã hết hàng hoặc không đủ số lượng: ${outOfStock.join(', ')}.` },
        { status: 409 }
      );
    }

    const subtotal = validatedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

    // Server-authoritative shipping fee. For delivery it is the SUM of the
    // selected province + district + ward fees (fetched by id from the DB, never
    // trusted from the client). Pickup is free; free-shipping threshold applies.
    const shippingConfig = readShippingConfig(settings);
    let shippingFee = 0;
    if (deliveryMode !== 'pickup' && shippingConfig.enabled) {
      // Required cascade levels are configured per-province (admin). Fetch the
      // selected province's setting and enforce it server-side (never trust the client).
      let requiredLevels = 2;
      if (provinceId) {
        const { data: provRow } = await db
          .from('location_options')
          .select('required_levels')
          .eq('id', provinceId)
          .maybeSingle();
        const rl = (provRow as { required_levels: number | null } | null)?.required_levels;
        requiredLevels = Math.min(3, Math.max(1, rl ?? 2));
      }
      const missingLevel =
        !provinceId ||
        (requiredLevels >= 2 && !districtId) ||
        (requiredLevels >= 3 && !wardId);
      if (missingLevel) {
        const need =
          requiredLevels >= 3 ? 'Tỉnh/TP, Quận/Huyện và Phường/Xã'
          : requiredLevels >= 2 ? 'Tỉnh/TP và Quận/Huyện'
          : 'Tỉnh/TP';
        return NextResponse.json(
          { error: `Vui lòng chọn ${need}.` },
          { status: 400 }
        );
      }
      const freeByThreshold = shippingConfig.freeThreshold > 0 && subtotal >= shippingConfig.freeThreshold;
      if (!freeByThreshold) {
        const ids = [provinceId, districtId, wardId].filter((x): x is string => typeof x === 'string' && !!x);
        const { data: locs } = await db
          .from('location_options')
          .select('shipping_fee')
          .in('id', ids);
        shippingFee = ((locs ?? []) as { shipping_fee: number | null }[])
          .reduce((s, l) => s + (l.shipping_fee ?? 0), 0);
      }
    }

    // Server-side discount validation — validate all codes via the shared helper.
    // Supports stacked codes: amounts are summed. Per-user usage is checked for
    // non-admin accounts. use_count is NOT incremented here (only on payment confirm).
    let discount = 0;
    let shippingDiscount = 0;
    const appliedCodeNames: string[] = [];
    const appliedCodeIds: string[] = [];
    const appliedCodeTypes: string[] = [];

    for (const rawCode of rawCodes) {
      const result = await validateDiscountCode(db, rawCode, subtotal, shippingFee, user.id, isAdmin);
      if (result.ok) {
        discount += result.discountAmount;
        shippingDiscount += result.shippingDiscountAmount;
        appliedCodeNames.push(result.code);
        appliedCodeIds.push(result.discountCodeId);
        appliedCodeTypes.push(result.discountType);
      }
    }

    discount = Math.min(discount, subtotal);
    shippingDiscount = Math.min(shippingDiscount, shippingFee);

    const discountType: string | null = appliedCodeTypes.length === 0
      ? null
      : appliedCodeTypes.length === 1
      ? appliedCodeTypes[0]
      : 'stacked';
    const validatedDiscountCode: string | null = appliedCodeNames.length > 0
      ? appliedCodeNames.join(',')
      : null;
    const validatedDiscountCodeId: string | null = appliedCodeIds.length > 0
      ? appliedCodeIds.join(',')
      : null;

    const shippingPayable = Math.max(0, shippingFee - shippingDiscount);
    const totalAmount     = Math.max(0, subtotal - discount + shippingPayable);
    const shippingAddress = [address, ward, district, province].filter(Boolean).join(', ') || 'Nhận tại cửa hàng';

    // GA4 attribution ids from the browser's _ga cookies — let the server-side
    // Measurement Protocol purchase join the same GA4 user/session.
    const { clientId: gaClientId, sessionId: gaSessionId } = extractGaIds(req);

    // Create order — always stores authenticated user id
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        user_id:          user.id,
        customer_name:    name.trim(),
        customer_phone:   phone.trim(),
        customer_email:   email?.trim() || null,
        shipping_address: shippingAddress,
        subtotal,
        shipping_fee:             shippingFee,
        shipping_discount_amount: shippingDiscount,
        discount_amount:          discount,
        discount_type:            discountType,
        discount_code:            validatedDiscountCode,
        discount_code_id:         validatedDiscountCodeId,
        total_amount:             totalAmount,
        payment_method:   isCod ? 'cod' : 'bank_transfer',
        payment_status:   'awaiting_payment',
        order_note:       orderNote?.trim() || null,
        status:           'pending',
        ga_client_id:     gaClientId,
        ga_session_id:    gaSessionId,
      } as never)
      .select('id')
      .single();

    if (orderErr || !order) {
      console.error('Order insert error:', orderErr?.message);
      return NextResponse.json({ error: 'Không thể tạo đơn hàng. Vui lòng thử lại.' }, { status: 500 });
    }

    const orderId     = (order as { id: string }).id;
    const paymentCode = generatePaymentCode();

    // Create order_items — uses server-validated prices/product ids
    const orderItems = validatedItems.map((item) => ({
      order_id:     orderId,
      product_id:   item.productId,
      product_name: item.productName,
      unit_price:   item.unitPrice,
      quantity:     item.quantity,
    }));

    const { error: itemsErr } = await db.from('order_items').insert(orderItems);
    if (itemsErr) {
      console.error('Order items insert error:', itemsErr.message);
      // Order was created — continue even if items log fails
    }

    // Save payment_code + chosen pickup time on the orders row.
    // pickup_time is cast because the generated types may not include the
    // freshly-added column yet (migration 20260701_order_pickup_time.sql).
    await db
      .from('orders')
      .update({
        payment_code: paymentCode,
        pickup_time: deliveryMode === 'pickup' ? (deliveryTime?.trim() || null) : null,
      } as never)
      .eq('id', orderId);

    // COD (Trả tiền khi nhận hàng): không tạo payment_request.
    // Đơn đi thẳng vào orders → deduct stock → thành công.
    if (isCod) {
      await applyOrderStock(orderId, 'deduct');
      // COD counts as a conversion at placement (marketing measurement). Real
      // cash collection is signalled later via a separate custom event.
      await sendPurchaseForOrder(db, orderId);
      return NextResponse.json({
        success:    true,
        cod:        true,
        orderId,
        redirectTo: `/checkout/success?orderId=${orderId}&cod=1&code=${encodeURIComponent(paymentCode)}`,
      });
    }

    // Calculate expiry
    const expiryMinutes = parseInt(settings['checkout_payment_expiry_minutes'] || '30');
    const expiresAt     = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // Build QR payload from template if configured
    const qrTemplate = settings['checkout_qr_payload_template'] || '';
    const qrPayload  = qrTemplate
      .replace('{amount}', String(totalAmount))
      .replace('{code}', paymentCode)
      .replace('{account}', settings['checkout_bank_account_number'] || '') || null;

    // Create payment_request with quota-aware payment mode
    const { data: pr, error: prErr } = await db
      .from('payment_requests')
      .insert({
        order_id:               orderId,
        amount:                 totalAmount,
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
      console.error('Payment request insert error:', prErr?.message);
      // Still return success — order exists, but payment request creation failed
    }

    // Zero-amount orders (fully discounted): auto-confirm immediately, no QR needed.
    if (totalAmount === 0) {
      await Promise.all([
        db.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', orderId),
        pr ? db.from('payment_requests').update({ status: 'paid' }).eq('id', (pr as { id: string }).id) : Promise.resolve(),
      ]);
      // Fully-discounted order is confirmed → deduct stock.
      await applyOrderStock(orderId, 'deduct');
      // Zero-amount order is confirmed at creation → purchase (value 0).
      await sendPurchaseForOrder(db, orderId);
      return NextResponse.json({
        success:       true,
        autoCompleted: true,
        orderId,
        redirectTo:    `/checkout/success?orderId=${orderId}&code=${encodeURIComponent(paymentCode)}`,
      });
    }

    const modeInstruction =
      paymentMode.paymentMode === 'sepay_auto'
        ? 'Đơn hàng đã được tạo. Vui lòng chuyển khoản đúng số tiền và nội dung bên dưới. Hệ thống sẽ tự động xác nhận qua SePay khi ngân hàng ghi nhận giao dịch.'
        : paymentMode.manualRequiredReason === 'sepay_monthly_quota_exceeded'
        ? 'Gói xác nhận tự động miễn phí trong tháng đã hết lượt. Đơn hàng này sẽ được xác nhận thủ công sau khi admin kiểm tra giao dịch.'
        : 'Đơn hàng đã được tạo. Vui lòng chuyển khoản đúng số tiền và nội dung bên dưới. Hiện hệ thống đang ở chế độ xác nhận thủ công, admin sẽ kiểm tra và xác nhận thanh toán.';

    return NextResponse.json({
      success:               true,
      orderId,
      paymentRequestId:      pr ? (pr as { id: string }).id : null,
      paymentCode,
      amount:                totalAmount,
      subtotal,
      shippingFee,
      shippingDiscount,
      productDiscount:       discount,
      discountType,
      bankName:              settings['checkout_bank_name'] || '',
      bankAccountNumber:     settings['checkout_bank_account_number'] || '',
      bankAccountName:       settings['checkout_bank_account_name'] || '',
      bankBranch:            settings['checkout_bank_branch'] || '',
      transferInstruction:   settings['checkout_bank_transfer_instruction'] || 'Nhập đúng nội dung chuyển khoản.',
      qrPayload,
      qrImageUrl:            buildDynamicQrImageUrl(settings, totalAmount, paymentCode),
      expiresAt,
      expiryMinutes,
      paymentMode:           paymentMode.paymentMode,
      provider:              paymentMode.provider,
      autoConfirmEligible:   paymentMode.autoConfirmEligible,
      manualRequiredReason:  paymentMode.manualRequiredReason,
      modeInstruction,
    });
  } catch (err) {
    console.error('Checkout route error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
  }
}
