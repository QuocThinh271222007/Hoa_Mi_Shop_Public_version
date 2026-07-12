import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// Server-only. Counts a discount code's usage exactly once per order, and only
// after the order's payment is confirmed (SePay webhook or admin confirmation).
//
// Idempotency + race-safety live in the SQL function
// `count_discount_usage_for_paid_order` (see migration 20260624_discount_usage_counting.sql),
// which locks the order row, checks `discount_usage_counted_at`, and increments
// `discount_codes.use_count` atomically.
//
// Never throws — a counting failure must not block payment confirmation.
export async function countDiscountUsageForPaidOrder(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    const db = createAdminSupabaseClient();
    const { error } = await db.rpc('count_discount_usage_for_paid_order', {
      p_order_id: orderId,
    });
    if (error) {
      console.error('Discount usage counting failed:', error.message);
    }
  } catch (err) {
    console.error('Discount usage counting error:', err);
  }
}
