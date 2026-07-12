import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

export type AnalyticsOverview = {
  totalViews: number;
  uniqueVisitors: number;
  todayViews: number;
  sevenDayViews: number;
  thirtyDayViews: number;
};

export type TopPage = { path: string; views: number };
export type DeviceRow = { device_type: string; count: number };
export type RecentVisit = {
  path: string;
  device_type: string | null;
  browser: string | null;
  referrer: string | null;
  created_at: string;
};
export type DayRow = { day: string; views: number };

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export async function getAnalyticsOverview(from?: string, to?: string): Promise<AnalyticsOverview> {
  const db = createAdminSupabaseClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, todayCount, sevenCount, thirtyCount, unique] = await Promise.all([
    from
      ? db
          .from('web_analytics_events')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', from)
          .lte('created_at', to ?? new Date().toISOString())
      : db.from('web_analytics_events').select('*', { count: 'exact', head: true }),

    db
      .from('web_analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),

    db
      .from('web_analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', isoDate(7)),

    db
      .from('web_analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', isoDate(30)),

    db
      .from('web_analytics_events')
      .select('visitor_id')
      .gte('created_at', isoDate(30)),
  ]);

  const uniqueSet = new Set(
    (unique.data ?? []).map((r: { visitor_id: string | null }) => r.visitor_id).filter(Boolean)
  );

  return {
    totalViews: total.count ?? 0,
    todayViews: todayCount.count ?? 0,
    sevenDayViews: sevenCount.count ?? 0,
    thirtyDayViews: thirtyCount.count ?? 0,
    uniqueVisitors: uniqueSet.size,
  };
}

export async function getTopPages(from?: string, to?: string, limit = 20): Promise<TopPage[]> {
  const db = createAdminSupabaseClient();
  let query = db
    .from('web_analytics_events')
    .select('path')
    .limit(5000);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data } = await query;
  if (!data) return [];

  const counts: Record<string, number> = {};
  for (const row of data as { path: string }[]) {
    counts[row.path] = (counts[row.path] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path, views]) => ({ path, views }));
}

export async function getDeviceBreakdown(from?: string, to?: string): Promise<DeviceRow[]> {
  const db = createAdminSupabaseClient();
  let query = db.from('web_analytics_events').select('device_type').limit(5000);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data } = await query;
  if (!data) return [];

  const counts: Record<string, number> = {};
  for (const row of data as { device_type: string | null }[]) {
    const k = row.device_type ?? 'unknown';
    counts[k] = (counts[k] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([device_type, count]) => ({ device_type, count }));
}

export async function getRecentVisits(limit = 50): Promise<RecentVisit[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('web_analytics_events')
    .select('path, device_type, browser, referrer, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as RecentVisit[];
}

export type DaySeriesRow = { day: string; views: number; visitors: number };

// Continuous daily series (views + unique visitors) for the last `days`,
// with zero-filled gaps so charts have an unbroken x-axis.
export async function getDailySeries(days = 30): Promise<DaySeriesRow[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('web_analytics_events')
    .select('created_at, visitor_id')
    .gte('created_at', isoDate(days))
    .order('created_at', { ascending: true })
    .limit(20000);

  const views: Record<string, number> = {};
  const visitorsByDay: Record<string, Set<string>> = {};
  for (const row of (data ?? []) as { created_at: string; visitor_id: string | null }[]) {
    const day = row.created_at.slice(0, 10);
    views[day] = (views[day] ?? 0) + 1;
    (visitorsByDay[day] ??= new Set()).add(row.visitor_id ?? '');
  }

  const out: DaySeriesRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const vset = visitorsByDay[day];
    out.push({
      day,
      views: views[day] ?? 0,
      visitors: vset ? [...vset].filter(Boolean).length : 0,
    });
  }
  return out;
}

export type ReferrerRow = { referrer: string; count: number };

// Aggregate referrers; empty/null referrers are bucketed as "Trực tiếp" (direct).
export async function getReferrerBreakdown(from?: string, to?: string, limit = 10): Promise<ReferrerRow[]> {
  const db = createAdminSupabaseClient();
  let query = db.from('web_analytics_events').select('referrer').limit(5000);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data } = await query;
  if (!data) return [];

  const counts: Record<string, number> = {};
  for (const row of data as { referrer: string | null }[]) {
    let key = (row.referrer ?? '').trim();
    if (!key) {
      key = 'Trực tiếp';
    } else {
      try { key = new URL(key).hostname || key; } catch { /* keep raw */ }
    }
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([referrer, count]) => ({ referrer, count }));
}

export async function getTrafficByDay(days = 30): Promise<DayRow[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('web_analytics_events')
    .select('created_at')
    .gte('created_at', isoDate(days))
    .order('created_at', { ascending: true });

  if (!data) return [];

  const counts: Record<string, number> = {};
  for (const row of data as { created_at: string }[]) {
    const day = row.created_at.slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, views]) => ({ day, views }));
}
