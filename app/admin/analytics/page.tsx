import { requireAdmin } from '@/lib/admin/auth-check';
import {
  getAnalyticsOverview,
  getTopPages,
  getDeviceBreakdown,
  getRecentVisits,
  getTrafficByDay,
  getDailySeries,
  getReferrerBreakdown,
} from '@/lib/admin/analytics-data';
import { AdminShell } from '../_components/AdminShell';
import { StatCard } from '../_components/StatCard';
import { TrendChart, BarList } from '@/components/admin/AnalyticsCharts';
import { formatDateTimeVN } from '@/lib/time';

function fmtDate(s: string) { try { return formatDateTimeVN(s); } catch { return s; } }

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const [overview, topPages, devices, recentVisits, dailyTraffic, dailySeries, referrers] = await Promise.all([
    getAnalyticsOverview(sp.from, sp.to),
    getTopPages(sp.from, sp.to, 20),
    getDeviceBreakdown(sp.from, sp.to),
    getRecentVisits(50),
    getTrafficByDay(30),
    getDailySeries(30),
    getReferrerBreakdown(sp.from, sp.to, 10),
  ]);

  return (
    <AdminShell email={email} activePath="/admin/analytics">
      <header className="admin-header">
        <h1 className="admin-header__title">Analytics</h1>
        <p className="admin-header__subtitle">Thống kê lượng truy cập website</p>
      </header>

      {/* Date filter */}
      <form method="get" className="admin-filter-bar" style={{ marginBottom: 20 }}>
        <label className="admin-form__label" style={{ margin: 0 }}>Từ</label>
        <input type="date" name="from" className="admin-form__input admin-form__input--sm" defaultValue={sp.from ?? ''} />
        <label className="admin-form__label" style={{ margin: 0 }}>Đến</label>
        <input type="date" name="to" className="admin-form__input admin-form__input--sm" defaultValue={sp.to ?? ''} />
        <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lọc</button>
        <a href="/admin/analytics" className="admin-btn admin-btn--sm admin-btn--ghost">Reset</a>
      </form>

      {/* KPI cards */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Tổng quan</h2>
        <div className="admin-stat-grid">
          <StatCard label="Hôm nay"           value={overview.todayViews} variant="accent" />
          <StatCard label="7 ngày gần nhất"   value={overview.sevenDayViews} />
          <StatCard label="30 ngày gần nhất"  value={overview.thirtyDayViews} />
          <StatCard label="Unique visitors 30d" value={overview.uniqueVisitors} variant="accent" />
          <StatCard label="Tổng page views"   value={overview.totalViews} />
        </div>
      </section>

      {/* Trend chart: views + unique visitors over time */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Lượt xem &amp; khách duy nhất (30 ngày)</h2>
        <TrendChart series={dailySeries} />
      </section>

      {/* Top pages + referrers as charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <section className="admin-section" style={{ margin: 0 }}>
          <h2 className="admin-section__heading">Top trang (biểu đồ)</h2>
          <BarList items={topPages.slice(0, 8).map((p) => ({ label: p.path, value: p.views }))} />
        </section>
        <section className="admin-section" style={{ margin: 0 }}>
          <h2 className="admin-section__heading">Nguồn truy cập</h2>
          <BarList items={referrers.map((r) => ({ label: r.referrer, value: r.count }))} />
        </section>
      </div>

      {/* Device breakdown chart */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Thiết bị (biểu đồ)</h2>
        <BarList items={devices.map((d) => ({ label: d.device_type, value: d.count }))} />
      </section>

      {/* Top pages + devices side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <section className="admin-section" style={{ margin: 0 }}>
          <h2 className="admin-section__heading">Top trang truy cập</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Đường dẫn</th><th>Lượt xem</th></tr></thead>
              <tbody>
                {topPages.length === 0 ? (
                  <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>Chưa có dữ liệu</td></tr>
                ) : (
                  topPages.map((p) => (
                    <tr key={p.path}>
                      <td style={{ fontSize: 12 }}>{p.path}</td>
                      <td>{p.views}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section" style={{ margin: 0 }}>
          <h2 className="admin-section__heading">Thiết bị</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Thiết bị</th><th>Lượt</th></tr></thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>Chưa có</td></tr>
                ) : (
                  devices.map((d) => (
                    <tr key={d.device_type}>
                      <td style={{ textTransform: 'capitalize' }}>{d.device_type}</td>
                      <td>{d.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Traffic by day */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Lưu lượng theo ngày (30 ngày)</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Ngày</th><th>Lượt xem</th></tr></thead>
            <tbody>
              {dailyTraffic.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>Chưa có dữ liệu</td></tr>
              ) : (
                dailyTraffic.slice().reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{d.views}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent visits */}
      <section className="admin-section">
        <h2 className="admin-section__heading">50 lượt truy cập gần nhất</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Đường dẫn</th><th>Thiết bị</th><th>Browser</th><th>Referrer</th><th>Thời gian</th></tr></thead>
            <tbody>
              {recentVisits.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>Chưa có dữ liệu</td></tr>
              ) : (
                recentVisits.map((v, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11 }}>{v.path}</td>
                    <td style={{ fontSize: 11, textTransform: 'capitalize' }}>{v.device_type ?? '–'}</td>
                    <td style={{ fontSize: 11 }}>{v.browser ?? '–'}</td>
                    <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.referrer || '–'}
                    </td>
                    <td style={{ fontSize: 11 }}>{fmtDate(v.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
