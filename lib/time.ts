// Central time/timezone helpers. The DB stores UTC (timestamptz); all display and
// business-day math is done in a configured timezone, defaulting to Vietnam time.
// Never rely on the browser/server local timezone for business logic.

export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
// Backward-compatible alias (existing imports use APP_TIME_ZONE).
export const APP_TIME_ZONE = DEFAULT_TIME_ZONE;

export const SUPPORTED_TIME_ZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Hà Nội / TP.HCM (UTC+7)' },
  { value: 'UTC', label: 'UTC' },
] as const;

/**
 * Resolves the configured timezone from a settings map (site_timezone), falling
 * back to Vietnam time. Accepts any record so callers can pass raw settings.
 */
export function getConfiguredTimeZone(settings?: Record<string, unknown> | null): string {
  const tz = settings?.['site_timezone'];
  if (typeof tz === 'string' && tz.trim()) return tz.trim();
  return DEFAULT_TIME_ZONE;
}

type FormatOpts = { timeZone?: string };

export function nowUtcIso(): string {
  return new Date().toISOString();
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateVN(value: string | Date | null | undefined, opts?: FormatOpts): string {
  const d = toDate(value);
  if (!d) return 'Chưa có thông tin';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: opts?.timeZone ?? DEFAULT_TIME_ZONE,
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d);
  } catch {
    return 'Chưa có thông tin';
  }
}

export function formatDateTimeVN(value: string | Date | null | undefined, opts?: FormatOpts): string {
  const d = toDate(value);
  if (!d) return 'Chưa có thông tin';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: opts?.timeZone ?? DEFAULT_TIME_ZONE,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return 'Chưa có thông tin';
  }
}

export function formatTimeVN(value: string | Date | null | undefined, opts?: FormatOpts): string {
  const d = toDate(value);
  if (!d) return 'Chưa có thông tin';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: opts?.timeZone ?? DEFAULT_TIME_ZONE,
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return 'Chưa có thông tin';
  }
}

/** The clock hour (0–23) of a date as observed in the given timezone. */
export function getHourInTimeZone(value: string | Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const d = toDate(value) ?? new Date();
  try {
    const h = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false }).format(d);
    const n = parseInt(h, 10);
    return Number.isFinite(n) ? n % 24 : d.getHours();
  } catch {
    return d.getHours();
  }
}

/**
 * UTC offset in minutes for a timezone at a given instant (e.g. +420 for
 * Asia/Ho_Chi_Minh). Positive means ahead of UTC.
 */
function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(at)) {
    if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
  }
  // hour '24' can appear at midnight in some environments; normalize to 0.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * Converts a wall-clock day (YYYY-MM-DD) in the given timezone to the UTC ISO
 * string for the start of that day (00:00 local). Returns null on invalid input.
 */
export function zonedDayStartUtcIso(dateStr: string, timeZone: string = DEFAULT_TIME_ZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const approx = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0));
  const offset = tzOffsetMinutes(timeZone, approx);
  return new Date(approx.getTime() - offset * 60000).toISOString();
}

/**
 * UTC ISO for the start of the day AFTER dateStr (00:00 local next day) — use as
 * an exclusive upper bound so the whole of dateStr is included. Null on invalid input.
 */
export function zonedDayEndUtcIso(dateStr: string, timeZone: string = DEFAULT_TIME_ZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const approx = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1, 0, 0, 0));
  const offset = tzOffsetMinutes(timeZone, approx);
  return new Date(approx.getTime() - offset * 60000).toISOString();
}

export function addBusinessDaysVN(value: string | Date, days: number): Date {
  const start = toDate(value) ?? new Date();
  const d = new Date(start.getTime());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

const HCM_KEYWORDS = ['hồ chí minh', 'ho chi minh', 'tp hcm', 'tp.hcm', 'hcm', 'sài gòn', 'saigon'];

function isHCMAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  const lower = address.toLowerCase();
  return HCM_KEYWORDS.some((k) => lower.includes(k));
}

export interface DeliveryEstimate {
  minDate: Date;
  maxDate: Date;
  label: string;
}

/**
 * Estimates the delivery window. Counts business days from the most relevant base
 * time (shipped → paid → created). If the order was placed/paid after the cutoff
 * hour (in the configured timezone), processing starts the next day.
 *
 * minDays/maxDays override the HCM/other-province defaults when provided (these are
 * the configured shipping_estimated_min/max_days). Backward-compatible aliases
 * deliveryMinDays/deliveryMaxDays are still accepted.
 */
export function calculateEstimatedDeliveryDate(params: {
  createdAt?: string | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  status?: string | null;
  province?: string | null;
  timeZone?: string;
  minDays?: number;
  maxDays?: number;
  cutoffHour?: number;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
}): DeliveryEstimate {
  const { createdAt, paidAt, shippedAt, status, province } = params;
  const timeZone = params.timeZone ?? DEFAULT_TIME_ZONE;
  const hcm = isHCMAddress(province);
  const minDays = params.minDays ?? params.deliveryMinDays ?? (hcm ? 1 : 3);
  const maxDays = params.maxDays ?? params.deliveryMaxDays ?? (hcm ? 2 : 7);

  if (status === 'pending' && !paidAt) {
    const fallback = new Date();
    return {
      minDate: fallback,
      maxDate: fallback,
      label: 'Dự kiến giao sau khi thanh toán được xác nhận.',
    };
  }

  const base = shippedAt ?? paidAt ?? createdAt ?? new Date().toISOString();

  // After-cutoff orders start processing the next day.
  let extraDay = 0;
  if (params.cutoffHour != null && !shippedAt) {
    if (getHourInTimeZone(base, timeZone) >= params.cutoffHour) extraDay = 1;
  }

  const min = addBusinessDaysVN(base, minDays + extraDay);
  const max = addBusinessDaysVN(base, maxDays + extraDay);
  return {
    minDate: min,
    maxDate: max,
    label: `Dự kiến giao từ ${formatDateVN(min, { timeZone })} – ${formatDateVN(max, { timeZone })}`,
  };
}
