import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { validateDiscountCode } from '@/lib/payments/discount';
import { rateLimit } from '@/lib/api/rate-limit';
import { getClientIp } from '@/lib/api/request-context';

// POST /api/discounts/validate
// Body: { code: string, subtotal: number, shippingFee?: number }
// Server-side discount validation for the checkout UI. The order-creation route
// re-validates independently, so this endpoint is display-only and safe.
export async function POST(req: NextRequest) {
  try {
    // Throttle to stop brute-force enumeration of discount codes.
    const rl = await rateLimit('discount_validate', getClientIp(req), 30, 60);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, message: 'Bạn thử quá nhiều lần. Vui lòng chờ giây lát.' },
        { status: 429 },
      );
    }
    const body = await req.json();
    const code        = typeof body?.code === 'string' ? body.code : '';
    const subtotal    = Number(body?.subtotal ?? 0) || 0;
    const shippingFee = Number(body?.shippingFee ?? 0) || 0;

    // Get current user (optional — unauthenticated users still get global validation)
    let userId: string | null = null;
    let isAdmin = false;
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const db = createAdminSupabaseClient();
        const { data: adminRow } = await db
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        isAdmin = !!adminRow;
      }
    } catch {
      // Non-fatal: proceed without per-user check
    }

    const db = createAdminSupabaseClient();
    const result = await validateDiscountCode(db, code, subtotal, shippingFee, userId, isAdmin);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Discount validate error:', err);
    return NextResponse.json(
      { ok: false, message: 'Không thể kiểm tra mã giảm giá. Vui lòng thử lại.' },
      { status: 500 },
    );
  }
}
