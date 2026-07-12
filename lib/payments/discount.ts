import type { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// Single source of truth for discount validation. Used by both the checkout
// order-creation route and the /api/discounts/validate endpoint so the amount
// the customer sees always matches the amount the server stores.

type AdminDb = ReturnType<typeof createAdminSupabaseClient>;

// Normalized discount kinds. Legacy DB values are mapped onto these:
//   'fixed' | 'fixed_amount' → 'fixed'
//   'percent'                → 'percent'
//   'free_shipping'          → 'free_shipping'
export type DiscountKind = 'fixed' | 'percent' | 'free_shipping';

export type DiscountValidation =
  | {
      ok: true;
      code: string;
      discountCodeId: string;
      discountType: DiscountKind;
      discountAmount: number;          // discount applied to the product subtotal
      shippingDiscountAmount: number;  // discount applied to the shipping fee
      message?: string;
    }
  | { ok: false; message: string };

type DiscountRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order_amount: number;
  max_uses: number | null;
  use_count: number;
  is_reusable: boolean;
  expires_at: string | null;
};

/** Maps any stored/legacy type string onto a normalized DiscountKind. */
export function normalizeDiscountType(type: string | null | undefined): DiscountKind {
  const t = (type ?? '').trim().toLowerCase();
  if (t === 'percent' || t === 'percentage') return 'percent';
  if (t === 'free_shipping' || t === 'freeship' || t === 'shipping') return 'free_shipping';
  // 'fixed', 'fixed_amount', or anything else → fixed amount.
  return 'fixed';
}

/**
 * Validate a discount code against the DB for a given order subtotal and shipping
 * fee. Case-insensitive, trims whitespace, checks active/expiry/min-order/max-uses,
 * and recomputes the discount amount (never trusts a client-supplied amount).
 *
 * - fixed / fixed_amount → reduces the product subtotal by `value`.
 * - percent              → reduces the product subtotal by `value`%.
 * - free_shipping        → reduces the shipping fee to 0 (product subtotal unchanged).
 *
 * When userId is provided and isAdmin is false, also checks per-user usage: a code
 * can only be used once per non-admin account (across non-cancelled orders).
 */
export async function validateDiscountCode(
  db: AdminDb,
  rawCode: string | null | undefined,
  subtotal: number,
  shippingFee = 0,
  userId?: string | null,
  isAdmin = false,
): Promise<DiscountValidation> {
  const code = (rawCode ?? '').trim();
  if (!code) return { ok: false, message: 'Vui lòng nhập mã giảm giá.' };

  // Case-insensitive exact match (ilike without wildcards), active only.
  const { data } = await db
    .from('discount_codes')
    .select('id, code, type, value, min_order_amount, max_uses, use_count, is_reusable, expires_at')
    .ilike('code', code)
    .eq('is_active', true)
    .maybeSingle();

  const dc = data as DiscountRow | null;
  if (!dc) return { ok: false, message: `Mã giảm giá "${code}" không hợp lệ.` };

  if (dc.expires_at && new Date(dc.expires_at) <= new Date()) {
    return { ok: false, message: 'Mã giảm giá đã hết hạn.' };
  }
  if (dc.max_uses != null && dc.use_count >= dc.max_uses) {
    return { ok: false, message: 'Mã giảm giá đã hết lượt sử dụng.' };
  }

  // Per-user check: each code can only be used once per non-admin account,
  // unless the code is marked is_reusable (same user may apply it on multiple orders).
  // Only count PAID orders — pending/awaiting orders that never completed payment
  // should not block the customer from retrying with the same code.
  if (userId && !isAdmin && !dc.is_reusable) {
    const { count } = await db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('discount_code_id', dc.id)
      .eq('payment_status', 'paid');
    if ((count ?? 0) > 0) {
      return { ok: false, message: 'Bạn đã sử dụng mã giảm giá này rồi.' };
    }
  }

  if (subtotal < dc.min_order_amount) {
    return {
      ok: false,
      message: `Đơn hàng tối thiểu ${dc.min_order_amount.toLocaleString('vi-VN')}đ để dùng mã này.`,
    };
  }

  const kind = normalizeDiscountType(dc.type);
  let discountAmount = 0;
  let shippingDiscountAmount = 0;
  let message: string | undefined;

  if (kind === 'free_shipping') {
    shippingDiscountAmount = Math.max(0, shippingFee);
    message = shippingFee > 0 ? 'Đã áp dụng miễn phí vận chuyển.' : 'Đơn hàng đã được miễn phí vận chuyển.';
  } else if (kind === 'percent') {
    discountAmount = Math.round((subtotal * dc.value) / 100);
  } else {
    discountAmount = dc.value;
  }
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  return {
    ok: true,
    code: dc.code,
    discountCodeId: dc.id,
    discountType: kind,
    discountAmount,
    shippingDiscountAmount,
    message,
  };
}
