import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminLocationOption, AdminSiteSetting } from './types';

export async function getSiteSettings(groupName?: string | string[]): Promise<AdminSiteSetting[]> {
  const db = createAdminSupabaseClient();
  let query = db
    .from('site_settings')
    .select('id, key, value, type, label, group_name')
    .order('group_name')
    .order('key');
  if (Array.isArray(groupName)) {
    query = query.in('group_name', groupName);
  } else if (groupName) {
    query = query.eq('group_name', groupName);
  }
  const { data } = await query;
  return (data ?? []) as AdminSiteSetting[];
}

export async function getSettingsMap(keys: string[]): Promise<Record<string, string>> {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('site_settings').select('key, value').in('key', keys);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string | null }[]) {
    map[row.key] = row.value ?? '';
  }
  return map;
}

export async function upsertSiteSetting(key: string, value: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export async function getLocationOptions(type?: string): Promise<AdminLocationOption[]> {
  const db = createAdminSupabaseClient();
  let query = db
    .from('location_options')
    .select('id, type, name, parent_id, sort_order, is_active, shipping_fee, required_levels, payment_methods')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (type) query = query.eq('type', type);
  const { data } = await query;
  // Cast via unknown: the generated Supabase types don't include the additive
  // required_levels column (migration 20260705_location_required_levels.sql).
  return (data ?? []) as unknown as AdminLocationOption[];
}

export async function createLocationOption(fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('location_options').insert(fields as any);
  if (error) throw new Error(error.message);
}

export async function updateLocationOption(id: string, fields: Record<string, unknown>): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await db.from('location_options').update(fields as any).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteLocationOption(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db.from('location_options').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Pickup day-offset overrides ───────────────────────────────────────────
// Override a specific position (1-based offset from today) within the pickup
// offset window. day_offset=3 means "3 days from today".

export type PickupDayOverride = {
  id: string;
  day_offset: number;
  mode: 'blocked' | 'custom';
  custom_times: string[] | null;
  note: string | null;
  created_at: string;
};

/** Returns all day-offset overrides ordered by day_offset ascending. */
export async function getPickupDayOverrides(): Promise<PickupDayOverride[]> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from('pickup_day_overrides')
    .select('id, day_offset, mode, custom_times, note, created_at')
    .order('day_offset', { ascending: true });
  return (data ?? []) as PickupDayOverride[];
}

/** Returns overrides keyed by day_offset number for O(1) lookup. */
export async function getPickupDayOverrideMap(): Promise<Record<number, PickupDayOverride>> {
  const rows = await getPickupDayOverrides();
  const map: Record<number, PickupDayOverride> = {};
  for (const r of rows) map[r.day_offset] = r;
  return map;
}

export async function upsertPickupDayOverride(fields: {
  day_offset: number;
  mode: 'blocked' | 'custom';
  custom_times?: string[] | null;
  note?: string | null;
}): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from('pickup_day_overrides')
    .upsert(fields, { onConflict: 'day_offset' });
  if (error) throw new Error(error.message);
}

export async function deletePickupDayOverride(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from('pickup_day_overrides').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Pickup weekday rules ───────────────────────────────────────────────────
// Recurring rules keyed by JS weekday (0=Sun .. 6=Sat).
// Day-offset overrides take precedence over weekday rules when both apply.

export type PickupWeekdayRule = {
  id: string;
  weekday: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  mode: 'blocked' | 'custom';
  custom_times: string[] | null;
  note: string | null;
  created_at: string;
};

export async function getPickupWeekdayRules(): Promise<PickupWeekdayRule[]> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from('pickup_weekday_rules')
    .select('id, weekday, mode, custom_times, note, created_at')
    .order('weekday', { ascending: true });
  return (data ?? []) as PickupWeekdayRule[];
}

/** Returns weekday rules keyed by weekday number (0–6) for O(1) lookup. */
export async function getPickupWeekdayRuleMap(): Promise<Record<number, PickupWeekdayRule>> {
  const rows = await getPickupWeekdayRules();
  const map: Record<number, PickupWeekdayRule> = {};
  for (const r of rows) map[r.weekday] = r;
  return map;
}

export async function upsertPickupWeekdayRule(fields: {
  weekday: number;
  mode: 'blocked' | 'custom';
  custom_times?: string[] | null;
  note?: string | null;
}): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from('pickup_weekday_rules')
    .upsert(fields, { onConflict: 'weekday' });
  if (error) throw new Error(error.message);
}

export async function deletePickupWeekdayRule(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from('pickup_weekday_rules').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
