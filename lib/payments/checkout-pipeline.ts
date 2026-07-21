import 'server-only';
// SERVER-ONLY — shared validation/calculation pipeline used by both the QR
// prepare and confirm routes. Never import in client components.
//
// Returns a validated, server-authoritative order summary or throws with a
// user-facing error string. No DB writes are performed here.

import { validateDiscountCode } from '@/lib/payments/discount';
import { readShippingConfig } from '@/lib/payments/shipping';
import { validateCheckoutInput } from '@/lib/validation/checkout';
import { buildVietQrImageUrl } from '@/lib/payments/vietqr';
import type { CartItem } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Re-exported so routes only need one import.
export { readShippingConfig } from '@/lib/payments/shipping';

export type CheckoutPipelineInput = {
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
  discountCodes?: string[];
  userId: string;
  isAdmin?: boolean;
};

export type ValidatedOrderSummary = {
  name: string;
  phone: string;
  email: string | null;
  orderNote: string | null;
  deliveryMode: string;
  deliveryTime: string | null;
  shippingAddress: string;
  isCod: boolean;
  // Validated cart
  validatedItems: {
    productId: string | null;
    productName: string;
    unitPrice: number;
    quantity: number;
  }[];
  // Financial
  subtotal: number;
  shippingFee: number;
  shippingDiscount: number;
  discount: number;
  discountType: string | null;
  validatedDiscountCode: string | null;
  validatedDiscountCodeId: string | null;
  shippingPayable: number;
  totalAmount: number;
  // Location ids (for DB reference)
  provinceId: string | null;
  districtId: string | null;
  wardId: string | null;
};

export class CheckoutError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly status: number = 400,
    public readonly outOfStockIds?: string[],
  ) {
    super(userMessage);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = SupabaseClient<any, any, any>;

export async function runCheckoutPipeline(
  db: AnyDb,
  input: CheckoutPipelineInput,
  settings: Record<string, string>,
): Promise<ValidatedOrderSummary> {
  const {
    name, phone, email, address, province, district, ward,
    provinceId, districtId, wardId, orderNote, deliveryMode,
    deliveryTime, paymentMethod, cart, discountCodes = [],
    userId, isAdmin = false,
  } = input;

  const isCod = paymentMethod === 'cod';

  // ── 1. Lightweight form validation ──
  const validation = validateCheckoutInput({ name, phone, email, address, province, orderNote, deliveryMode });
  if (!validation.ok) throw new CheckoutError(validation.error ?? 'Dữ liệu không hợp lệ.');
  if (!Array.isArray(cart) || cart.length === 0) throw new CheckoutError('Giỏ hàng trống.');

  // Validate quantities server-side. A crafted request could send a negative or
  // non-integer quantity: negatives slip past the `stock < quantity` check and
  // drag the subtotal below zero (→ totalAmount clamped to 0 = a "free" order).
  for (const item of cart) {
    const q = item?.quantity;
    if (typeof q !== 'number' || !Number.isInteger(q) || q < 1 || q > 1000) {
      throw new CheckoutError('Số lượng sản phẩm không hợp lệ.');
    }
  }

  // ── 2. Per-province/district allowed payment method (delivery only) ──
  if (deliveryMode !== 'pickup' && provinceId) {
    const payIds = [provinceId, districtId].filter((x): x is string => typeof x === 'string' && !!x);
    const { data: payRows } = await db
      .from('location_options')
      .select('id, payment_methods')
      .in('id', payIds);
    const payMap = new Map(
      ((payRows ?? []) as unknown as { id: string; payment_methods: string | null }[]).map(
        (r) => [r.id, r.payment_methods ?? 'both'],
      ),
    );
    const provinceAllowed = payMap.get(provinceId) ?? 'both';
    const districtAllowed = districtId ? (payMap.get(districtId) ?? 'both') : 'both';
    const allowed = districtId && districtAllowed !== 'both' ? districtAllowed : provinceAllowed;
    const methodOk =
      allowed === 'both' ||
      (allowed === 'qr' && !isCod) ||
      (allowed === 'cod' && isCod);
    if (!methodOk) {
      throw new CheckoutError(
        allowed === 'qr'
          ? 'Khu vực này chỉ hỗ trợ thanh toán chuyển khoản qua QR.'
          : 'Khu vực này chỉ hỗ trợ thanh toán COD.',
      );
    }
  }

  // ── 3. Server-side price + stock validation ──
  const realIds = cart.filter((i) => i.id && !i.id.startsWith('demo-')).map((i) => i.id);
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
  const outOfStockIds: string[] = [];
  const validatedItems = cart.map((item) => {
    const db_product = item.id && !item.id.startsWith('demo-') ? priceMap.get(item.id) : undefined;
    const unitPrice = db_product ? db_product.price : item.price;
    if (db_product && db_product.stock < item.quantity) {
      outOfStock.push(db_product.name);
      outOfStockIds.push(item.id);
    }
    return {
      productId:   db_product ? item.id : null,
      productName: item.name,
      unitPrice,
      quantity:    item.quantity,
    };
  });

  if (outOfStock.length > 0) {
    throw new CheckoutError(
      `Một số sản phẩm đã hết hàng hoặc không đủ số lượng: ${outOfStock.join(', ')}.`,
      409,
      outOfStockIds,
    );
  }

  const subtotal = validatedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  // ── 4. Server-authoritative shipping fee ──
  const shippingConfig = readShippingConfig(settings);
  let shippingFee = 0;
  if (deliveryMode !== 'pickup' && shippingConfig.enabled) {
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
      throw new CheckoutError(`Vui lòng chọn ${need}.`);
    }
    const freeByThreshold = shippingConfig.freeThreshold > 0 && subtotal >= shippingConfig.freeThreshold;
    if (!freeByThreshold) {
      const ids = [provinceId, districtId, wardId].filter((x): x is string => typeof x === 'string' && !!x);
      const { data: locs } = await db.from('location_options').select('shipping_fee').in('id', ids);
      shippingFee = ((locs ?? []) as { shipping_fee: number | null }[])
        .reduce((s, l) => s + (l.shipping_fee ?? 0), 0);
    }
  }

  // ── 5. Discount code validation ──
  let discount = 0;
  let shippingDiscount = 0;
  const appliedCodeNames: string[] = [];
  const appliedCodeIds: string[] = [];
  const appliedCodeTypes: string[] = [];

  // Deduplicate codes (case-insensitive) before validating. Without this, a
  // customer sending ["CODE_50", "CODE_50"] would apply the same 50% discount
  // twice, effectively getting 100% off (capped at subtotal).
  //
  // Only ONE code per order is supported: orders.discount_code_id is a single uuid
  // column, so storing several comma-joined ids would make the INSERT fail and
  // break checkout entirely. We therefore keep at most the first code. (The UI also
  // limits the customer to a single code.)
  const uniqueDiscountCodes = [...new Set(discountCodes.map((c) => c.toUpperCase().trim()))].slice(0, 1);

  for (const rawCode of uniqueDiscountCodes) {
    const result = await validateDiscountCode(db, rawCode, subtotal, shippingFee, userId, isAdmin);
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

  const discountType = appliedCodeTypes.length === 0 ? null
    : appliedCodeTypes.length === 1 ? appliedCodeTypes[0]
    : 'stacked';
  const validatedDiscountCode = appliedCodeNames.length > 0 ? appliedCodeNames.join(',') : null;
  const validatedDiscountCodeId = appliedCodeIds.length > 0 ? appliedCodeIds.join(',') : null;

  const shippingPayable = Math.max(0, shippingFee - shippingDiscount);
  const totalAmount = Math.max(0, subtotal - discount + shippingPayable);
  const shippingAddress =
    deliveryMode === 'pickup'
      ? (address || 'Nhận tại cửa hàng')
      : [address, ward, district, province].filter(Boolean).join(', ') || 'Nhận tại cửa hàng';

  return {
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || null,
    orderNote: orderNote?.trim() || null,
    deliveryMode: deliveryMode ?? 'delivery',
    deliveryTime: deliveryMode === 'pickup' ? (deliveryTime?.trim() || null) : null,
    shippingAddress,
    isCod,
    validatedItems,
    subtotal,
    shippingFee,
    shippingDiscount,
    discount,
    discountType,
    validatedDiscountCode,
    validatedDiscountCodeId,
    shippingPayable,
    totalAmount,
    provinceId: provinceId || null,
    districtId: districtId || null,
    wardId: wardId || null,
  };
}

// ── Bank settings helpers ──

export async function getBankSettings(db: AnyDb): Promise<Record<string, string>> {
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
      'checkout_payment_expiry_minutes',
      'shipping_enabled',
      'shipping_default_fee',
      'shipping_free_threshold',
      'shipping_pickup_enabled',
      'shipping_hcm_fee',
      'shipping_other_province_fee',
    ]);
  const settings: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string | null }[]) {
    settings[row.key] = row.value ?? '';
  }
  return settings;
}

export function buildDynamicQrImageUrl(
  settings: Record<string, string>,
  amount: number,
  paymentCode: string,
): string {
  const bankId      = settings['checkout_bank_id']             || process.env.BANK_QR_BANK_ID      || '970403';
  const accountNo   = settings['checkout_bank_account_number'] || process.env.BANK_QR_ACCOUNT_NO   || '';
  const accountName = settings['checkout_bank_account_name']   || process.env.BANK_QR_ACCOUNT_NAME || '';
  const template    = (
    settings['checkout_bank_qr_template'] || process.env.BANK_QR_TEMPLATE || 'compact2'
  ) as 'compact' | 'compact2' | 'qr_only';
  return buildVietQrImageUrl({ bankId, accountNo, accountName, amount, addInfo: paymentCode, template });
}
