// Shared shipping-fee logic. Safe to import from both server (authoritative
// recompute in /api/checkout) and client (checkout display). Contains no secrets.

export type ShippingConfig = {
  enabled: boolean;
  defaultFee: number;
  freeThreshold: number;      // 0/null disables the free-shipping threshold
  pickupEnabled: boolean;
  hcmFee: number;
  otherProvinceFee: number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  cutoffHour: number;
};

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  enabled: true,
  defaultFee: 30000,
  freeThreshold: 0,
  pickupEnabled: true,
  hcmFee: 20000,
  otherProvinceFee: 35000,
  estimatedMinDays: 2,
  estimatedMaxDays: 5,
  cutoffHour: 16,
};

const HCM_KEYWORDS = ['hồ chí minh', 'ho chi minh', 'tp hcm', 'tp.hcm', 'hcm', 'sài gòn', 'saigon'];

export function isHcmProvince(province: string | null | undefined): boolean {
  if (!province) return false;
  const lower = province.toLowerCase();
  return HCM_KEYWORDS.some((k) => lower.includes(k));
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return fallback;
}

/**
 * Builds a ShippingConfig from raw site_settings values. Falls back to the legacy
 * `checkout_shipping_fee` key for the default fee so existing setups keep working.
 */
export function readShippingConfig(settings: Record<string, string | null | undefined>): ShippingConfig {
  const legacyFee = settings['checkout_shipping_fee'];
  return {
    enabled:          bool(settings['shipping_enabled'], DEFAULT_SHIPPING_CONFIG.enabled),
    defaultFee:       num(settings['shipping_default_fee'] ?? legacyFee, DEFAULT_SHIPPING_CONFIG.defaultFee),
    freeThreshold:    num(settings['shipping_free_threshold'], DEFAULT_SHIPPING_CONFIG.freeThreshold),
    pickupEnabled:    bool(settings['shipping_pickup_enabled'], DEFAULT_SHIPPING_CONFIG.pickupEnabled),
    hcmFee:           num(settings['shipping_hcm_fee'], DEFAULT_SHIPPING_CONFIG.hcmFee),
    otherProvinceFee: num(settings['shipping_other_province_fee'], DEFAULT_SHIPPING_CONFIG.otherProvinceFee),
    estimatedMinDays: num(settings['shipping_estimated_min_days'], DEFAULT_SHIPPING_CONFIG.estimatedMinDays),
    estimatedMaxDays: num(settings['shipping_estimated_max_days'], DEFAULT_SHIPPING_CONFIG.estimatedMaxDays),
    cutoffHour:       num(settings['shipping_cutoff_hour'], DEFAULT_SHIPPING_CONFIG.cutoffHour),
  };
}

/**
 * Computes the base shipping fee (before any free-shipping discount code) from the
 * configuration, the destination province, the subtotal, and the delivery mode.
 * Pure function — identical result on server and client.
 */
export function computeShippingFee(
  config: ShippingConfig,
  params: { province?: string | null; subtotal: number; deliveryMode?: string | null },
): number {
  const { province, subtotal, deliveryMode } = params;

  // Store pickup is always free when enabled.
  if (deliveryMode === 'pickup' && config.pickupEnabled) return 0;

  // Shipping disabled globally → no fee.
  if (!config.enabled) return 0;

  // No address yet → no shipping line shown.
  if (!province) return 0;

  // Free-shipping threshold reached.
  if (config.freeThreshold > 0 && subtotal >= config.freeThreshold) return 0;

  return isHcmProvince(province) ? config.hcmFee : config.otherProvinceFee;
}
