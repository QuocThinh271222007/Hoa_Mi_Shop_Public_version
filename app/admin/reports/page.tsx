import { requireAdmin } from '@/lib/admin/auth-check';
import { getRevenueStats, getOrdersByStatus, getTopProducts, getDiscountUsage } from '@/lib/admin/reports-data';
import { AdminShell } from '../_components/AdminShell';
import { StatCard } from '../_components/StatCard';

export const dynamic = 'force-dynamic';

function formatVND(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`;
}

export default async function AdminReportsPage() {
  const { email } = await requireAdmin();

  const [revenue, orderStatus, topProducts, discounts] = await Promise.all([
    getRevenueStats().catch(() => ({ revenue7d: 0, revenue30d: 0, revenueAllTime: 0, orders7d: 0, orders30d: 0 })),
    getOrdersByStatus().catch(() => ({} as Record<string, number>)),
    getTopProducts().catch(() => [] as { name: string; qty: number; revenue: number }[]),
    getDiscountUsage().catch(() => [] as { code: string; use_count: number; is_active: boolean }[]),
  ]);

  const statusLabels: Record<string, string> = {
    pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận',
    packing: 'Đang đóng gói', shipping: 'Đang giao',
    delivered: 'Đã giao', cancelled: 'Đã hủy', refunded: 'Hoàn trả',
  };

  return (
    <AdminShell email={email} activePath="/admin/reports">
      <header className="admin-header">
        <h1 className="admin-header__title">Báo cáo &amp; Thống kê</h1>
      </header>

      <p className="admin-section__heading">Doanh thu</p>
      <div className="admin-stat-grid" style={{ marginBottom: '2rem' }}>
        <StatCard label="7 ngày qua" value={formatVND(revenue.revenue7d)} />
        <StatCard label="30 ngày qua" value={formatVND(revenue.revenue30d)} />
        <StatCard label="Toàn thời gian" value={formatVND(revenue.revenueAllTime)} />
        <StatCard label="Đơn hàng (7 ngày)" value={String(revenue.orders7d)} />
        <StatCard label="Đơn hàng (30 ngày)" value={String(revenue.orders30d)} />
      </div>

      <p className="admin-section__heading">Đơn hàng theo trạng thái</p>
      <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
        <table className="admin-table">
          <thead><tr><th>Trạng thái</th><th>Số lượng</th></tr></thead>
          <tbody>
            {Object.entries(orderStatus).map(([status, count]) => (
              <tr key={status}>
                <td>{statusLabels[status] || status}</td>
                <td>{count as number}</td>
              </tr>
            ))}
            {Object.keys(orderStatus).length === 0 && (
              <tr><td colSpan={2} className="admin-table__empty">Chưa có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="admin-section__heading">Sản phẩm bán chạy</p>
      <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
        <table className="admin-table">
          <thead><tr><th>Sản phẩm</th><th>Số lượng bán</th><th>Doanh thu</th></tr></thead>
          <tbody>
            {topProducts.length === 0 && <tr><td colSpan={3} className="admin-table__empty">Chưa có dữ liệu</td></tr>}
            {topProducts.map(p => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.qty}</td>
                <td>{formatVND(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="admin-section__heading">Mã giảm giá</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Mã</th><th>Số lần dùng</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {discounts.length === 0 && <tr><td colSpan={3} className="admin-table__empty">Chưa có dữ liệu</td></tr>}
            {discounts.map((d: { code: string; use_count: number; is_active: boolean }) => (
              <tr key={d.code}>
                <td><code>{d.code}</code></td>
                <td>{d.use_count}</td>
                <td>{d.is_active ? 'Đang hoạt động' : 'Tắt'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
