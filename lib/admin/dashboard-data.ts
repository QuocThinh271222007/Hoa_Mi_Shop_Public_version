import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminProduct, AdminOrder, AdminSupportMessage } from './types';

export type DashboardStats = {
  totalProducts: number;
  outOfStockProducts: number;
  bestsellerProducts: number;
  newProducts: number;
  totalOrders: number;
  pendingOrders: number;
  supportMessages: number;
  wishlistItems: number;
  cartItems: number;
  // Analytics
  todayViews: number;
  sevenDayViews: number;
  uniqueVisitors30d: number;
};

export type { AdminProduct, AdminOrder, AdminSupportMessage };

export type DashboardData = {
  stats: DashboardStats;
  recentProducts: AdminProduct[];
  recentOrders: AdminOrder[];
  recentSupportMessages: AdminSupportMessage[];
  errors: {
    stats?: string;
    products?: string;
    orders?: string;
    support?: string;
  };
};

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createAdminSupabaseClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    prodTotal, prodOutOfStock, prodBestseller, prodNew,
    orderTotal, orderPending,
    supportTotal,
    wishlistTotal, cartTotal,
    recentProducts, recentOrders, recentSupport,
    analyticsToday, analytics7d, analyticsVisitors,
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('stock', 0),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_bestseller', true),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_new', true),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('support_messages').select('*', { count: 'exact', head: true }),
    supabase.from('wishlist_items').select('*', { count: 'exact', head: true }),
    supabase.from('cart_items').select('*', { count: 'exact', head: true }),
    supabase
      .from('products')
      .select('id, slug, name, category, price, stock, is_bestseller, is_new, is_active, image_url, sku, low_stock_threshold, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('orders')
      .select('id, customer_name, customer_phone, customer_email, shipping_address, subtotal, shipping_fee, discount_amount, total_amount, discount_code, payment_method, payment_status, payment_code, paid_at, status, order_note, admin_note, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('support_messages')
      .select('id, name, email, message, status, admin_note, resolved_at, archived_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    // Analytics
    supabase.from('web_analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('web_analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', isoDate(7)),
    supabase.from('web_analytics_events').select('visitor_id').gte('created_at', isoDate(30)),
  ]);

  const uniqueSet = new Set(
    (analyticsVisitors.data ?? []).map((r: { visitor_id: string | null }) => r.visitor_id).filter(Boolean)
  );

  const statsError =
    prodTotal.error?.message ||
    orderTotal.error?.message ||
    supportTotal.error?.message ||
    undefined;

  return {
    stats: {
      totalProducts: prodTotal.count ?? 0,
      outOfStockProducts: prodOutOfStock.count ?? 0,
      bestsellerProducts: prodBestseller.count ?? 0,
      newProducts: prodNew.count ?? 0,
      totalOrders: orderTotal.count ?? 0,
      pendingOrders: orderPending.count ?? 0,
      supportMessages: supportTotal.count ?? 0,
      wishlistItems: wishlistTotal.count ?? 0,
      cartItems: cartTotal.count ?? 0,
      todayViews: analyticsToday.count ?? 0,
      sevenDayViews: analytics7d.count ?? 0,
      uniqueVisitors30d: uniqueSet.size,
    },
    recentProducts: (recentProducts.data ?? []) as AdminProduct[],
    recentOrders: (recentOrders.data ?? []) as AdminOrder[],
    recentSupportMessages: (recentSupport.data ?? []) as AdminSupportMessage[],
    errors: {
      stats: statsError,
      products: recentProducts.error?.message,
      orders: recentOrders.error?.message,
      support: recentSupport.error?.message,
    },
  };
}
