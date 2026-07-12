import { requireAdmin } from '@/lib/admin/auth-check';
import { getDiscountCodes, getDiscountCodeById } from '@/lib/admin/discounts-data';
import { AdminShell } from '../_components/AdminShell';
import { actionCreateDiscount, actionUpdateDiscount, actionDeleteDiscount } from './actions';
import type { AdminDiscountCode } from '@/lib/admin/types';
import { formatDateVN } from '@/lib/time';

function formatDate(s: string | null) {
  if (!s) return '–';
  return formatDateVN(s);
}

function DiscountForm({ code }: { code?: AdminDiscountCode }) {
  const action = code ? actionUpdateDiscount : actionCreateDiscount;
  return (
    <form action={action} className="admin-form">
      {code && <input type="hidden" name="id" value={code.id} />}
      <div className="admin-form__grid">
        <div className="admin-form__field">
          <label className="admin-form__label">Mã giảm giá *</label>
          <input name="code" required defaultValue={code?.code ?? ''} className="admin-form__input" placeholder="VD: CUC20" style={{ textTransform: 'uppercase' }} />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Loại</label>
          <select name="type" className="admin-form__select" defaultValue={code?.type ?? 'fixed'}>
            <option value="fixed">Giảm tiền cố định (VND)</option>
            <option value="percent">Giảm theo % (%)</option>
            <option value="free_shipping">Miễn phí giao hàng</option>
          </select>
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Giá trị</label>
          <input name="value" type="number" min={0} defaultValue={code?.value ?? 0} className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Đơn tối thiểu (VND)</label>
          <input name="min_order_amount" type="number" min={0} defaultValue={code?.min_order_amount ?? 0} className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Hạn sử dụng</label>
          <input name="expires_at" type="date" defaultValue={code?.expires_at?.slice(0, 10) ?? ''} className="admin-form__input" />
        </div>
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label">Mô tả</label>
          <input name="description" defaultValue={code?.description ?? ''} className="admin-form__input" />
        </div>
        <div className="admin-form__field admin-form__field--checks">
          <label className="admin-form__check">
            <input type="checkbox" name="is_active" defaultChecked={code?.is_active !== false} />
            Kích hoạt
          </label>
          <label className="admin-form__check" style={{ marginTop: 8 }}>
            <input type="checkbox" name="is_reusable" defaultChecked={code?.is_reusable === true} />
            Tái sử dụng (mỗi đơn dùng 1 lần, không giới hạn số đơn)
          </label>
        </div>
      </div>
      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary">
          {code ? 'Lưu thay đổi' : 'Tạo mã'}
        </button>
        <a href="/admin/discounts" className="admin-btn admin-btn--ghost">Hủy</a>
      </div>
    </form>
  );
}

export default async function AdminDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string; success?: string; error?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;
  const codes = await getDiscountCodes();

  let editCode: AdminDiscountCode | null = null;
  if (sp.edit) editCode = await getDiscountCodeById(sp.edit);

  return (
    <AdminShell email={email} activePath="/admin/discounts">
      <header className="admin-header">
        <h1 className="admin-header__title">Discounts</h1>
        <p className="admin-header__subtitle">{codes.length} mã giảm giá</p>
      </header>

      {sp.success && <div className="admin-banner">✓ {sp.success === 'created' ? 'Đã tạo mã.' : 'Đã cập nhật.'}</div>}
      {sp.error   && <div className="admin-banner admin-banner--error">⚠️ {decodeURIComponent(sp.error)}</div>}

      {!sp.new && !sp.edit && (
        <div style={{ marginBottom: 16 }}>
          <a href="/admin/discounts?new=1" className="admin-btn admin-btn--primary">+ Tạo mã mới</a>
        </div>
      )}

      {sp.new === '1' && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Tạo mã giảm giá mới</h2>
          <DiscountForm />
        </section>
      )}

      {editCode && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Chỉnh sửa: {editCode.code}</h2>
          <DiscountForm code={editCode} />
        </section>
      )}

      <section className="admin-section">
        <h2 className="admin-section__heading">Danh sách mã giảm giá</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã</th><th>Loại</th><th>Giá trị</th><th>Đơn tối thiểu</th>
                <th>Đã dùng</th><th>Active</th><th>Tái sử dụng</th><th>Hết hạn</th><th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.code}</td>
                  <td>{c.type === 'free_shipping' ? 'Miễn phí ship' : c.type === 'percent' ? 'Phần trăm' : 'Giảm tiền'}</td>
                  <td>{c.type === 'free_shipping' ? 'Free ship' : c.type === 'percent' ? `${c.value}%` : `${c.value.toLocaleString('vi-VN')}đ`}</td>
                  <td>{c.min_order_amount > 0 ? `${c.min_order_amount.toLocaleString('vi-VN')}đ` : '–'}</td>
                  <td>{c.use_count}</td>
                  <td>{c.is_active ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                  <td>{c.is_reusable ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                  <td>{formatDate(c.expires_at)}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <a href={`/admin/discounts?edit=${c.id}`} className="admin-link">Sửa</a>
                    <form action={actionDeleteDiscount} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="admin-link" style={{ color: '#dc2626' }}
                        onClick={undefined}>Xóa</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
