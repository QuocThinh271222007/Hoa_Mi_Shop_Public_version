import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { getCustomerOrderBucket } from '@/lib/orders/status-mapping';

// Customer asks to cancel their own order. We only FLAG the request here
// (cancel_requested_at); an admin reviews and performs the actual cancellation.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
    if (!orderId) {
      return NextResponse.json({ error: 'Thiếu mã đơn hàng.' }, { status: 400 });
    }

    const db = createAdminSupabaseClient();
    const { data: order } = await db
      .from('orders')
      .select('id, user_id, status, payment_status, cancel_requested_at')
      .eq('id', orderId)
      .maybeSingle();

    // Same 404 for "not found" and "not yours" to avoid leaking order existence.
    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng.' }, { status: 404 });
    }

    if (order.cancel_requested_at) {
      return NextResponse.json({ ok: true, alreadyRequested: true });
    }

    const bucket = getCustomerOrderBucket({ status: order.status, payment_status: order.payment_status });
    // Only pre-shipping orders can be cancelled by the customer.
    if (bucket === 'shipping' || bucket === 'delivered' || bucket === 'returned' || bucket === 'cancelled') {
      return NextResponse.json(
        { error: 'Đơn hàng đang giao hoặc đã hoàn tất — không thể yêu cầu hủy. Vui lòng liên hệ shop.' },
        { status: 400 }
      );
    }

    const { error } = await db
      .from('orders')
      .update({ cancel_requested_at: new Date().toISOString(), cancel_reason: reason || null })
      .eq('id', orderId);
    if (error) {
      return NextResponse.json({ error: 'Không thể gửi yêu cầu. Vui lòng thử lại.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
  }
}
