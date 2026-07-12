import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export async function getRevenueStats() {
  const db = createAdminSupabaseClient();

  const [today7d, last30d, allTime] = await Promise.all([
    db.from('orders').select('total_amount').eq('payment_status', 'paid').gte('created_at', isoDate(7)),
    db.from('orders').select('total_amount').eq('payment_status', 'paid').gte('created_at', isoDate(30)),
    db.from('orders').select('total_amount').eq('payment_status', 'paid'),
  ]);

  const sum = (rows: { total_amount: number | null }[] | null) =>
    (rows ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);

  return {
    revenue7d: sum(today7d.data),
    revenue30d: sum(last30d.data),
    revenueAllTime: sum(allTime.data),
    orders7d: today7d.data?.length ?? 0,
    orders30d: last30d.data?.length ?? 0,
  };
}

export async function getOrdersByStatus() {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('orders').select('status');
  const counts: Record<string, number> = {};
  (data ?? []).forEach(r => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
  return counts;
}

export async function getTopProducts(limit = 10) {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('order_items')
    .select('product_name, unit_price, quantity')
    .limit(500);
  // Aggregate
  const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
  (data ?? []).forEach(r => {
    if (!agg[r.product_name]) agg[r.product_name] = { name: r.product_name, qty: 0, revenue: 0 };
    agg[r.product_name].qty += r.quantity;
    agg[r.product_name].revenue += r.unit_price * r.quantity;
  });
  return Object.values(agg)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

export async function getDiscountUsage() {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('discount_codes').select('code, use_count, is_active').order('use_count', { ascending: false });
  return data ?? [];
}
