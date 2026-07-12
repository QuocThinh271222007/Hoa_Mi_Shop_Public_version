import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth-check';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

export const dynamic = 'force-dynamic';

function escapeCsv(val: unknown): string {
  let str = val == null ? '' : String(val);
  // Neutralize CSV formula injection: a cell beginning with = + - @ (or a
  // leading tab/CR) is executed as a formula by Excel/Sheets. Customer-supplied
  // fields (name, note, address) flow into this export, so prefix a single quote.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(values: unknown[]): string {
  return values.map(escapeCsv).join(',');
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from('orders')
    .select('id, customer_name, customer_phone, customer_email, shipping_address, subtotal, shipping_fee, discount_amount, total_amount, discount_code, payment_method, payment_status, status, order_note, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    'ID', 'Họ tên', 'SĐT', 'Email', 'Địa chỉ', 'Subtotal',
    'Phí ship', 'Giảm giá', 'Tổng tiền', 'Mã giảm giá',
    'Phương thức TT', 'Trạng thái TT', 'Trạng thái đơn', 'Ghi chú', 'Ngày tạo',
  ];

  const rows = (data ?? []).map((o) =>
    rowToCsv([
      o.id, o.customer_name, o.customer_phone, o.customer_email, o.shipping_address,
      o.subtotal, o.shipping_fee, o.discount_amount, o.total_amount, o.discount_code,
      o.payment_method, o.payment_status, o.status, o.order_note, o.created_at,
    ])
  );

  const csv = [rowToCsv(headers), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
