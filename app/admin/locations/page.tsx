import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import {
  getLocationOptions,
  createLocationOption,
  updateLocationOption,
  deleteLocationOption,
} from '@/lib/admin/settings-data';
import type { AdminLocationOption } from '@/lib/admin/types';
import { AdminShell } from '../_components/AdminShell';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return `${(n ?? 0).toLocaleString('vi-VN')}đ`; }

// ── Server actions ──
async function createLoc(formData: FormData) {
  'use server';
  await requireAdmin();
  const name = ((formData.get('name') as string | null) ?? '').trim();
  const type = (formData.get('type') as string) || 'province';
  const parentId = ((formData.get('parent_id') as string | null) ?? '').trim() || null;
  const fee = Math.max(0, parseInt((formData.get('shipping_fee') as string) || '0', 10) || 0);
  if (!name) redirect('/admin/locations?error=required');
  try {
    await createLocationOption({ type, name, parent_id: parentId, shipping_fee: fee, sort_order: 0, is_active: true });
  } catch {
    redirect('/admin/locations?error=duplicate');
  }
  revalidatePath('/admin/locations');
  redirect('/admin/locations');
}

async function updateFee(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const fee = Math.max(0, parseInt((formData.get('shipping_fee') as string) || '0', 10) || 0);
  await updateLocationOption(id, { shipping_fee: fee });
  revalidatePath('/admin/locations');
}

async function updateRequiredLevels(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const raw = parseInt((formData.get('required_levels') as string) || '2', 10);
  const levels = Math.min(3, Math.max(1, Number.isFinite(raw) ? raw : 2));
  await updateLocationOption(id, { required_levels: levels });
  revalidatePath('/admin/locations');
}

async function updatePaymentMethods(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  const raw = (formData.get('payment_methods') as string) || 'both';
  const value = ['both', 'qr', 'cod'].includes(raw) ? raw : 'both';
  await updateLocationOption(id, { payment_methods: value });
  revalidatePath('/admin/locations');
}

async function deleteLoc(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await deleteLocationOption(id);
  revalidatePath('/admin/locations');
}

// ── Small reusable UI ──
function FeeEditor({ loc }: { loc: AdminLocationOption }) {
  return (
    <form action={updateFee} className="admin-inline-form">
      <input type="hidden" name="id" value={loc.id} />
      <span style={{ fontSize: 12, color: '#9ca3af' }}>+phí</span>
      <input name="shipping_fee" type="number" min={0} defaultValue={loc.shipping_fee ?? 0} className="admin-form__input" style={{ width: 110 }} />
      <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost">Lưu phí</button>
    </form>
  );
}

function RequiredLevelsEditor({ loc }: { loc: AdminLocationOption }) {
  return (
    <form action={updateRequiredLevels} className="admin-inline-form">
      <input type="hidden" name="id" value={loc.id} />
      <span style={{ fontSize: 12, color: '#9ca3af' }}>Bắt buộc chọn</span>
      <select name="required_levels" defaultValue={String(loc.required_levels ?? 2)} className="admin-form__select" style={{ width: 230 }}>
        <option value="1">Chỉ Tỉnh/TP</option>
        <option value="2">Tỉnh/TP + Quận/Huyện</option>
        <option value="3">Tỉnh/TP + Quận/Huyện + Phường/Xã</option>
      </select>
      <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost">Lưu cấp</button>
    </form>
  );
}

function PaymentMethodsEditor({ loc }: { loc: AdminLocationOption }) {
  return (
    <form action={updatePaymentMethods} className="admin-inline-form">
      <input type="hidden" name="id" value={loc.id} />
      <span style={{ fontSize: 12, color: '#9ca3af' }}>Thanh toán</span>
      <select name="payment_methods" defaultValue={loc.payment_methods ?? 'both'} className="admin-form__select" style={{ width: 180 }}>
        <option value="both">QR + COD</option>
        <option value="qr">Chỉ QR</option>
        <option value="cod">Chỉ COD</option>
      </select>
      <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost">Lưu TT</button>
    </form>
  );
}

function DeleteBtn({ id }: { id: string }) {
  return (
    <form action={deleteLoc} style={{ display: 'inline' }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="admin-btn admin-btn--sm" style={{ color: '#dc2626' }}>Xóa</button>
    </form>
  );
}

function AddForm({ type, parentId, placeholder }: { type: string; parentId?: string; placeholder: string }) {
  return (
    <form action={createLoc} className="admin-inline-form" style={{ marginTop: 8 }}>
      <input type="hidden" name="type" value={type} />
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <input name="name" placeholder={placeholder} className="admin-form__input" required style={{ minWidth: 200 }} />
      <input name="shipping_fee" type="number" min={0} defaultValue={0} placeholder="Phí (đ)" className="admin-form__input" style={{ width: 120 }} />
      <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">+ Thêm</button>
    </form>
  );
}

export default async function AdminLocationsPage() {
  const { email } = await requireAdmin();
  const [provinces, districts, wards] = await Promise.all([
    getLocationOptions('province'),
    getLocationOptions('district'),
    getLocationOptions('ward'),
  ]);

  const districtsOf = (provinceId: string) => districts.filter((d) => d.parent_id === provinceId);
  const wardsOf = (districtId: string) => wards.filter((w) => w.parent_id === districtId);

  return (
    <AdminShell email={email} activePath="/admin/locations">
      <header className="admin-header">
        <h1 className="admin-header__title">Khu vực giao hàng & phí ship</h1>
        <p className="admin-header__subtitle">
          Phí giao = <strong>tổng phí của cả 3 lớp</strong> khách chọn (Tỉnh/TP + Quận/Huyện + Phường/Xã).
        </p>
      </header>

      <div className="admin-banner">
        💡 Thêm Tỉnh/TP trước, rồi thêm Quận/Huyện trong từng Tỉnh, rồi Phường/Xã trong từng Quận. Mỗi cấp có phí riêng.
        Dùng <strong>&quot;Bắt buộc chọn&quot;</strong> để quy định khách phải chọn đến cấp nào (vd: TP.HCM cần cả Quận, Hà Nội chỉ cần Thành phố).
      </div>

      {provinces.map((p) => (
        <section key={p.id} className="admin-section" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="admin-section__heading" style={{ margin: 0 }}>🏙️ {p.name} <span style={{ fontSize: 12, color: '#16a34a' }}>({fmt(p.shipping_fee)})</span></h2>
            <FeeEditor loc={p} />
            <RequiredLevelsEditor loc={p} />
            <PaymentMethodsEditor loc={p} />
            <DeleteBtn id={p.id} />
          </div>

          <div style={{ paddingLeft: 20, marginTop: 10 }}>
            {districtsOf(p.id).map((d) => (
              <div key={d.id} style={{ borderLeft: '2px solid #fce4ef', paddingLeft: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong>{d.name}</strong>
                  <span style={{ fontSize: 12, color: '#16a34a' }}>({fmt(d.shipping_fee)})</span>
                  <FeeEditor loc={d} />
                  <PaymentMethodsEditor loc={d} />
                  <DeleteBtn id={d.id} />
                </div>

                <div style={{ paddingLeft: 18, marginTop: 6 }}>
                  {wardsOf(d.id).map((w) => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span>{w.name}</span>
                      <span style={{ fontSize: 12, color: '#16a34a' }}>({fmt(w.shipping_fee)})</span>
                      <FeeEditor loc={w} />
                      <DeleteBtn id={w.id} />
                    </div>
                  ))}
                  <AddForm type="ward" parentId={d.id} placeholder="Tên Phường/Xã" />
                </div>
              </div>
            ))}
            <AddForm type="district" parentId={p.id} placeholder="Tên Quận/Huyện" />
          </div>
        </section>
      ))}

      <section className="admin-section">
        <h2 className="admin-section__heading">Thêm Tỉnh / Thành phố</h2>
        <AddForm type="province" placeholder="Tên Tỉnh/Thành phố" />
      </section>
    </AdminShell>
  );
}
