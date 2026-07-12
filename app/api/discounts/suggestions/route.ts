import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { normalizeDiscountType } from '@/lib/payments/discount';

type DiscountRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order_amount: number;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
};

export type DiscountSuggestion = {
  code: string;
  type: 'fixed' | 'percent' | 'free_shipping';
  value: number;
  label: string;
};

// GET /api/discounts/suggestions?subtotal=150000&shippingFee=30000
// Returns active discount codes the cart already qualifies for.
// Only codes where min_order_amount <= subtotal are returned.
// Per-user used codes (paid orders) are excluded when the user is authenticated.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const subtotal    = Number(url.searchParams.get('subtotal') ?? 0) || 0;
    const shippingFee = Number(url.searchParams.get('shippingFee') ?? 0) || 0;

    let userId: string | null = null;
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* non-fatal */ }

    const db = createAdminSupabaseClient();

    // Fetch all active, non-expired codes with min_order_amount <= subtotal
    const now = new Date().toISOString();
    const { data } = await db
      .from('discount_codes')
      .select('id, code, type, value, min_order_amount, max_uses, use_count, expires_at')
      .eq('is_active', true)
      .lte('min_order_amount', subtotal)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('min_order_amount', { ascending: false })
      .limit(20);

    const rows = (data ?? []) as DiscountRow[];

    // Filter out exhausted codes
    const eligible = rows.filter((dc) => dc.max_uses == null || dc.use_count < dc.max_uses);

    // Exclude codes already used by this user (paid orders only)
    let usedCodeIds = new Set<string>();
    if (userId && eligible.length > 0) {
      const ids = eligible.map((d) => d.id);
      const { data: usedOrders } = await db
        .from('orders')
        .select('discount_code_id')
        .eq('user_id', userId)
        .eq('payment_status', 'paid')
        .in('discount_code_id', ids);
      usedCodeIds = new Set(
        (usedOrders ?? [])
          .map((o: { discount_code_id: string | null }) => o.discount_code_id)
          .filter((id): id is string => id != null)
      );
    }

    const suggestions: DiscountSuggestion[] = eligible
      .filter((dc) => !usedCodeIds.has(dc.id))
      .map((dc) => {
        const kind = normalizeDiscountType(dc.type);
        let label = '';
        if (kind === 'free_shipping') {
          label = shippingFee > 0
            ? `Miễn phí vận chuyển (${shippingFee.toLocaleString('vi-VN')}đ)`
            : 'Miễn phí vận chuyển';
        } else if (kind === 'percent') {
          label = `Giảm ${dc.value}% đơn hàng`;
        } else {
          label = `Giảm ${dc.value.toLocaleString('vi-VN')}đ`;
        }
        return { code: dc.code, type: kind, value: dc.value, label };
      });

    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    console.error('Discount suggestions error:', err);
    return NextResponse.json({ ok: true, suggestions: [] });
  }
}
