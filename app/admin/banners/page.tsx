import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getAllBanners, getBannerById, type AdminBanner } from '@/lib/banners/banners-data';
import { getAllCollections, type AdminCollection } from '@/lib/admin/collections-data';
import { AdminShell } from '../_components/AdminShell';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { BUCKETS } from '@/lib/admin/storage';
import { actionCreateBanner, actionUpdateBanner, actionDeleteBanner } from './actions';

function BannerForm({
  banner,
  collections,
  submitLabel,
}: {
  banner?: AdminBanner;
  collections: AdminCollection[];
  submitLabel: string;
}) {
  const action = banner ? actionUpdateBanner : actionCreateBanner;
  return (
    <form action={action} className="admin-form">
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <div className="admin-form__grid">
        <div className="admin-form__field">
          <label className="admin-form__label">Tên banner</label>
          <input name="name" defaultValue={banner?.name ?? ''} className="admin-form__input" placeholder="VD: Bộ sưu tập mùa hè" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Tag — trỏ tới bộ sưu tập</label>
          <select name="collection_id" defaultValue={banner?.collection_id ?? ''} className="admin-form__input">
            <option value="">(Chưa gắn bộ sưu tập)</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Thứ tự</label>
          <input name="sort_order" type="number" defaultValue={banner?.sort_order ?? 0} className="admin-form__input" />
        </div>
        <div className="admin-form__field admin-form__field--checks">
          <label className="admin-form__check">
            <input type="checkbox" name="is_active" defaultChecked={banner?.is_active !== false} />
            Active
          </label>
        </div>
        <div className="admin-form__field admin-form__field--full">
          <ImageDropzone
            bucket={BUCKETS.banner}
            label="Ảnh banner *"
            name="image_url"
            altName="alt"
            pathName="image_path"
            defaultUrl={banner?.image_url ?? ''}
            defaultAlt={banner?.alt ?? ''}
          />
        </div>
      </div>
      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary">{submitLabel}</button>
        <a href="/admin/banners" className="admin-btn admin-btn--ghost">Hủy</a>
      </div>
    </form>
  );
}

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string; success?: string; error?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const [banners, collections] = await Promise.all([
    getAllBanners().catch(() => []),
    getAllCollections().catch(() => []),
  ]);

  const collectionName = new Map(collections.map((c) => [c.id, c.name]));

  let editBanner: AdminBanner | null = null;
  if (sp.edit) {
    editBanner = await getBannerById(sp.edit);
    if (!editBanner) redirect('/admin/banners');
  }

  const showNew = sp.new === '1';
  const showEdit = !!editBanner;

  return (
    <AdminShell email={email} activePath="/admin/banners">
      <header className="admin-header">
        <h1 className="admin-header__title">Banners — Bộ sưu tập</h1>
        <p className="admin-header__subtitle">
          {banners.length} banner · hiển thị dạng carousel ở trang /collection
        </p>
      </header>

      {sp.success && (
        <div className="admin-banner">✓ Đã {sp.success === 'created' ? 'tạo' : sp.success === 'deleted' ? 'xoá' : 'cập nhật'} banner.</div>
      )}
      {sp.error && (
        <div className="admin-banner admin-banner--error">⚠️ {decodeURIComponent(sp.error)}</div>
      )}

      {!showNew && !showEdit && (
        <div style={{ marginBottom: 16 }}>
          <a href="/admin/banners?new=1" className="admin-btn admin-btn--primary">+ Thêm banner</a>
        </div>
      )}

      {showNew && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Thêm banner</h2>
          <BannerForm collections={collections} submitLabel="Tạo banner" />
        </section>
      )}

      {showEdit && editBanner && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Chỉnh sửa banner</h2>
          <BannerForm banner={editBanner} collections={collections} submitLabel="Lưu thay đổi" />
        </section>
      )}

      <section className="admin-section">
        <h2 className="admin-section__heading">Danh sách banner</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Ảnh</th><th>Tên</th><th>Tag (BST)</th><th>Active</th><th>Thứ tự</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {banners.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#bbb' }}>
                  Chưa có banner. Trang /collection sẽ hiện placeholder &quot;Ảnh bộ sưu tập&quot;.
                </td></tr>
              ) : (
                banners.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.image_url} alt={b.alt || ''} style={{ width: 84, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                      ) : <span className="admin-dash">–</span>}
                    </td>
                    <td style={{ fontWeight: 500 }}>{b.name || <span className="admin-dash">–</span>}</td>
                    <td>{b.collection_id ? (collectionName.get(b.collection_id) ?? '?') : <span className="admin-dash">–</span>}</td>
                    <td>{b.is_active ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>{b.sort_order}</td>
                    <td>
                      <a href={`/admin/banners?edit=${b.id}`} className="admin-link">Sửa</a>
                      {' · '}
                      <form action={actionDeleteBanner} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" className="admin-link" style={{ color: '#c0392b' }}>Xoá</button>
                      </form>
                    </td>
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
