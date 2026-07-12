import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminCustomer } from './types';

export async function getCustomers(search?: string): Promise<AdminCustomer[]> {
  const db = createAdminSupabaseClient();
  let q = db.from('customer_profiles')
    .select('id, user_id, full_name, phone, email, birthday, gender, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (search) {
    q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const { data } = await q;
  return (data ?? []) as AdminCustomer[];
}

export async function getCustomerById(id: string): Promise<AdminCustomer | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('customer_profiles')
    .select('id, user_id, full_name, phone, email, birthday, gender, created_at')
    .eq('id', id).single();
  return data as AdminCustomer ?? null;
}

export async function getCustomerOrders(userId: string) {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('orders')
    .select('id, status, payment_status, total_amount, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getCustomerWishlistCount(userId: string): Promise<number> {
  const db = createAdminSupabaseClient();
  const { count } = await db.from('wishlist_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}
