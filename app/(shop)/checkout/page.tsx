import CheckoutClient from './CheckoutClient';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { readShippingConfig, type ShippingConfig } from '@/lib/payments/shipping';
import { getPickupDayOverrideMap, getPickupWeekdayRuleMap } from '@/lib/admin/settings-data';
import './checkout.css';

// Always read fresh admin settings (shipping fees, pickup stores/times, and the
// pickup date offset). Without this the page can be statically rendered and serve
// stale/default values, so admin changes to min/max pickup days never show up.
export const dynamic = 'force-dynamic';

async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const db = createAdminSupabaseClient();
    const { data } = await db
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'checkout_shipping_fee',
        'shipping_enabled',
        'shipping_default_fee',
        'shipping_free_threshold',
        'shipping_pickup_enabled',
        'shipping_hcm_fee',
        'shipping_other_province_fee',
        'shipping_estimated_min_days',
        'shipping_estimated_max_days',
        'shipping_cutoff_hour',
      ]);
    const settings: Record<string, string> = {};
    for (const row of (data ?? []) as { key: string; value: string | null }[]) {
      settings[row.key] = row.value ?? '';
    }
    return readShippingConfig(settings);
  } catch {
    return readShippingConfig({});
  }
}

async function getPickupStores(): Promise<{ id: string; name: string }[]> {
  try {
    const db = createAdminSupabaseClient();
    const { data } = await db
      .from('location_options')
      .select('id, name')
      .eq('type', 'store')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    return (data ?? []) as { id: string; name: string }[];
  } catch {
    return [];
  }
}

// Times are stored per store: location_options rows with type='pickup_time'
// whose parent_id is the store id, name = time only (e.g. "8h30").
async function getPickupTimesByStore(): Promise<Record<string, string[]>> {
  try {
    const db = createAdminSupabaseClient();
    const { data } = await db
      .from('location_options')
      .select('name, parent_id')
      .eq('type', 'pickup_time')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    const map: Record<string, string[]> = {};
    for (const r of (data ?? []) as { name: string; parent_id: string | null }[]) {
      if (!r.parent_id) continue;
      (map[r.parent_id] ??= []).push(r.name);
    }
    return map;
  } catch {
    return {};
  }
}

async function getPickupOffset(): Promise<{ min: number; max: number }> {
  try {
    const db = createAdminSupabaseClient();
    const { data } = await db
      .from('site_settings')
      .select('key, value')
      .in('key', ['pickup_offset_min_days', 'pickup_offset_max_days']);
    const map: Record<string, string> = {};
    for (const r of (data ?? []) as { key: string; value: string | null }[]) map[r.key] = r.value ?? '';
    const min = parseInt(map['pickup_offset_min_days'] || '2', 10);
    const max = parseInt(map['pickup_offset_max_days'] || '3', 10);
    const safeMin = Number.isFinite(min) ? Math.max(0, min) : 2;
    const safeMax = Number.isFinite(max) ? Math.max(safeMin, max) : Math.max(safeMin, 3);
    return { min: safeMin, max: safeMax };
  } catch {
    return { min: 2, max: 3 };
  }
}

export default async function CheckoutPage() {
  type SlotOverride = { mode: 'blocked' | 'custom'; custom_times?: string[] | null };
  const [shippingConfig, pickupStores, pickupTimesByStore, pickupOffset, dayOverrides, weekdayRules] = await Promise.all([
    getShippingConfig(),
    getPickupStores(),
    getPickupTimesByStore(),
    getPickupOffset(),
    getPickupDayOverrideMap().catch(() => ({} as Record<number, SlotOverride>)),
    getPickupWeekdayRuleMap().catch(() => ({} as Record<number, SlotOverride>)),
  ]);
  return (
    <CheckoutClient
      shippingConfig={shippingConfig}
      pickupStores={pickupStores}
      pickupTimesByStore={pickupTimesByStore}
      pickupOffset={pickupOffset}
      dayOverrides={dayOverrides}
      weekdayRules={weekdayRules}
    />
  );
}
