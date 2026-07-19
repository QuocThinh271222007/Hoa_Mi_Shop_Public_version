import { redirect, notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getCustomerById, getCustomerOrders, getCustomerWishlistCount } from '@/lib/admin/customers-data';
import { AdminShell } from '../../_components/AdminShell';
import { formatDateVN } from '@/lib/time';

export const dynamic = 'force-dynamic';

function formatVND(n: number | null) {
  if (!n) return '0đ';
  return `${n.toLocaleString('vi-VN')}đ`;
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { email } = await requireAdmin();

  const customer = await getCustomerById(id).catch(() => null);
  if (!customer) notFound();

  const [orders, wishlistCount] = await Promise.all([
    customer.user_id ? getCustomerOrders(customer.user_id) : Promise.resolve([]),
    customer.user_id ? getCustomerWishlistCount(customer.user_id) : Promise.resolve(0),
  ]);

  return (
    <AdminShell email={email} activePath="/admin/customers">
      <header className="admin-header">
        <h1 className="admin-header__title">Chi tiết khách hàng</h1>
      </header>
      <a href="/admin/customers" className="admin-back-link">← Danh sách khách hàng</a>

      <div className="admin-card" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
        <p className="admin-section__heading">Thông tin cá nhân</p>
        <dl className="admin-detail-list">
          <dt>Họ tên</dt><dd>{customer.full_name || '-'}</dd>
          <dt>Email</dt><dd>{customer.email || '-'}</dd>
          <dt>SĐT</dt><dd>{customer.phone || '-'}</dd>
          <dt>Ngày sinh</dt><dd>{customer.birthday || '-'}</dd>
          <dt>Giới tính</dt><dd>{customer.gender || '-'}</dd>
          <dt>Wishlist</dt><dd>{wishlistCount} sản phẩm</dd>
          <dt>Ngày đăng ký</dt><dd>{formatDateVN(customer.created_at)}</dd>
        </dl>
      </div>

      <div className="admin-card">
        <p className="admin-section__heading">Lịch sử đơn hàng ({orders.length})</p>
        <table className="admin-table">
          <thead>
            <tr><th>Mã đơn</th><th>Trạng thái</th><th>Thanh toán</th><th>Tổng tiền</th><th>Ngày đặt</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={5} className="admin-table__empty">Chưa có đơn hàng.</td></tr>}
            {orders.map((o: { id: string; status: string; payment_status: string | null; total_amount: number | null; created_at: string }) => (
              <tr key={o.id}>
                <td><a href={`/admin/orders/${o.id}`} style={{ color: 'var(--pink, #e8689f)' }}>#{o.id.slice(0, 8)}</a></td>
                <td>{o.status}</td>
                <td>{o.payment_status || '-'}</td>
                <td>{formatVND(o.total_amount)}</td>
                <td>{formatDateVN(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
