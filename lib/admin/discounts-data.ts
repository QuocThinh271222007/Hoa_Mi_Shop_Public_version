import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminDiscountCode } from './types';

const FIELDS = 'id, code, type, value, min_order_amount, max_uses, use_count, is_active, is_reusable, expires_at, description, created_at';

export async function getDiscountCodes(): Promise<AdminDiscountCode[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('discount_codes')
    .select(FIELDS)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as AdminDiscountCode[];
}

export async function getDiscountCodeById(id: string): Promise<AdminDiscountCode | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('discount_codes').select(FIELDS).eq('id', id).single();
  return (data as unknown as AdminDiscountCode) ?? null;
}

export async function createDiscountCode(fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('discount_codes').insert(fields as any);
  if (error) throw new Error(error.message);
}

export async function updateDiscountCode(id: string, fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('discount_codes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...fields, updated_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db.from('discount_codes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
