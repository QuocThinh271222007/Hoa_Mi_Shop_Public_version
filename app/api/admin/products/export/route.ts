import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth-check';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

export const dynamic = 'force-dynamic';

function escapeCsv(val: unknown): string {
  let str = val == null ? '' : String(val);
  // Neutralize CSV formula injection: a cell beginning with = + - @ (or a
  // leading tab/CR) is executed as a formula by Excel/Sheets. Product name/SKU
  // can contain admin- or import-supplied text, so prefix a single quote.
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
    .from('products')
    .select('id, slug, name, sku, category, price, stock, low_stock_threshold, is_bestseller, is_new, is_active, created_at, updated_at')
    .order('name', { ascending: true })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    'ID', 'Slug', 'Tên', 'SKU', 'Danh mục', 'Giá', 'Tồn kho',
    'Ngưỡng thấp', 'Bestseller', 'Mới', 'Hoạt động', 'Ngày tạo',
  ];

  const rows = (data ?? []).map((p) =>
    rowToCsv([
      p.id, p.slug, p.name, p.sku, p.category, p.price, p.stock,
      p.low_stock_threshold, p.is_bestseller, p.is_new, p.is_active, p.created_at,
    ])
  );

  const csv = [rowToCsv(headers), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
