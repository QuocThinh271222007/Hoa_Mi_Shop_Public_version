import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getCustomers } from '@/lib/admin/customers-data';
import { AdminShell } from '../_components/AdminShell';
import { formatDateVN } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { email } = await requireAdmin();
  const { q } = await searchParams;
  const customers = await getCustomers(q).catch(() => []);

  return (
    <AdminShell email={email} activePath="/admin/customers">
      <header className="admin-header">
        <h1 className="admin-header__title">Khách hàng</h1>
        <p className="admin-header__subtitle">{customers.length} kết quả</p>
      </header>

      <form method="get" className="admin-search-row">
        <input name="q" defaultValue={q ?? ''} placeholder="Tìm theo tên, email, SĐT..." className="admin-search-input" />
        <button type="submit" className="admin-btn admin-btn--primary">Tìm</button>
        {q && <a href="/admin/customers" className="admin-btn admin-btn--ghost">Xóa lọc</a>}
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>SĐT</th>
              <th>Giới tính</th>
              <th>Ngày tạo</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={6} className="admin-table__empty">Không tìm thấy khách hàng.</td></tr>
            )}
            {customers.map(c => (
              <tr key={c.id}>
                <td>{c.full_name || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.gender || '-'}</td>
                <td>{formatDateVN(c.created_at)}</td>
                <td><a href={`/admin/customers/${c.id}`} className="admin-btn admin-btn--sm admin-btn--ghost">Xem</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
