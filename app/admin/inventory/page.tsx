import { requireAdmin } from '@/lib/admin/auth-check';
import { getInventoryProducts, stockStatus, getAllRecentMovements } from '@/lib/admin/inventory-data';
import { AdminShell } from '../_components/AdminShell';
import { actionAdjustStock } from './actions';
import { formatDateTimeVN } from '@/lib/time';

const STATUS_LABEL: Record<string, string> = {
  out: 'Hết hàng',
  low: 'Sắp hết',
  ok:  'Còn hàng',
};

const STATUS_COLOR: Record<string, string> = {
  out: '#dc2626',
  low: '#d97706',
  ok:  '#16a34a',
};

export default async function AdminInventoryPage() {
  const { email } = await requireAdmin();
  const [products, movements] = await Promise.all([
    getInventoryProducts(),
    getAllRecentMovements(100).catch(() => []),
  ]);

  const outCount = products.filter((p) => stockStatus(p.stock, p.low_stock_threshold) === 'out').length;
  const lowCount = products.filter((p) => stockStatus(p.stock, p.low_stock_threshold) === 'low').length;

  return (
    <AdminShell email={email} activePath="/admin/inventory">
      <header className="admin-header">
        <h1 className="admin-header__title">Inventory</h1>
        <p className="admin-header__subtitle">
          {outCount > 0 && <span style={{ color: '#dc2626', marginRight: 12 }}>⚠️ {outCount} hết hàng</span>}
          {lowCount > 0 && <span style={{ color: '#d97706' }}>⚠️ {lowCount} sắp hết</span>}
        </p>
      </header>

      <section className="admin-section">
        <h2 className="admin-section__heading">Tồn kho tất cả sản phẩm</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th><th>SKU</th><th>Tồn kho</th>
                <th>Ngưỡng thấp</th><th>Trạng thái</th><th>Điều chỉnh</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const st = stockStatus(p.stock, p.low_stock_threshold);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ color: '#bbb', fontSize: 11 }}>{p.sku ?? '–'}</td>
                    <td style={{ fontWeight: 600 }}>{p.stock ?? 0}</td>
                    <td>{p.low_stock_threshold ?? 3}</td>
                    <td>
                      <span style={{ color: STATUS_COLOR[st], fontWeight: 600, fontSize: 11 }}>
                        {STATUS_LABEL[st]}
                      </span>
                    </td>
                    <td>
                      <form action={actionAdjustStock} className="admin-inline-form">
                        <input type="hidden" name="productId" value={p.id} />
                        <input type="hidden" name="reason" value="manual_adjustment" />
                        <input
                          name="delta"
                          type="number"
                          className="admin-form__input admin-form__input--sm"
                          placeholder="±"
                          style={{ width: 64 }}
                        />
                        <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">OK</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section__heading">Lịch sử điều chỉnh kho (100 gần nhất)</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Thay đổi</th>
                <th>Tồn sau</th>
                <th>Lý do</th>
                <th>Ghi chú</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr><td colSpan={6} className="admin-table__empty">Chưa có lịch sử điều chỉnh.</td></tr>
              )}
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{m.product_name}</td>
                  <td style={{ color: m.delta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    {m.delta >= 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td>{m.stock_after}</td>
                  <td style={{ fontSize: 12 }}>{m.reason}</td>
                  <td style={{ fontSize: 12, color: '#888' }}>{m.admin_note ?? '–'}</td>
                  <td style={{ fontSize: 12 }}>{formatDateTimeVN(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
