import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import {
  getAllCollections,
  getCollectionById,
  getCollectionProductIds,
  type AdminCollection,
} from '@/lib/admin/collections-data';
import { getAllProducts } from '@/lib/admin/products-data';
import { AdminShell } from '../_components/AdminShell';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { BUCKETS } from '@/lib/admin/storage';
import {
  actionCreateCollection,
  actionUpdateCollection,
  actionDeleteCollection,
} from './actions';
import type { AdminProduct } from '@/lib/admin/types';

function CollectionForm({
  collection,
  products,
  assignedIds,
  submitLabel,
}: {
  collection?: AdminCollection;
  products: AdminProduct[];
  assignedIds: Set<string>;
  submitLabel: string;
}) {
  const action = collection ? actionUpdateCollection : actionCreateCollection;
  return (
    <form action={action} className="admin-form">
      {collection && <input type="hidden" name="id" value={collection.id} />}
      <div className="admin-form__grid">
        <div className="admin-form__field">
          <label className="admin-form__label">Tên bộ sưu tập *</label>
          <input name="name" required defaultValue={collection?.name ?? ''} className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Slug *</label>
          <input name="slug" required defaultValue={collection?.slug ?? ''} className="admin-form__input" placeholder="new-drop" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Thứ tự</label>
          <input name="sort_order" type="number" defaultValue={collection?.sort_order ?? 0} className="admin-form__input" />
        </div>
        <div className="admin-form__field admin-form__field--checks">
          <label className="admin-form__check">
            <input type="checkbox" name="is_active" defaultChecked={collection?.is_active !== false} />
            Active
          </label>
        </div>
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label">Mô tả</label>
          <textarea name="description" rows={2} defaultValue={collection?.description ?? ''} className="admin-form__textarea" />
        </div>
        <div className="admin-form__field">
          <ImageDropzone
            bucket={BUCKETS.collection}
            label="Ảnh đại diện (cover)"
            defaultUrl={collection?.image_url ?? ''}
            defaultAlt={collection?.image_alt ?? ''}
            pathName="image_path"
          />
        </div>
        <div className="admin-form__field">
          <ImageDropzone
            bucket={BUCKETS.collection}
            label="Ảnh hero (banner)"
            name="hero_image_url"
            altName="hero_image_alt_unused"
            defaultUrl={collection?.hero_image_url ?? ''}
            pathName="hero_image_path"
          />
        </div>
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label">Sản phẩm trong bộ sưu tập</label>
          <div className="admin-checkbox-grid">
            {products.length === 0 && <span style={{ color: '#bbb' }}>Chưa có sản phẩm.</span>}
            {products.map((p) => (
              <label key={p.id} className="admin-form__check">
                <input
                  type="checkbox"
                  name="product_ids"
                  value={p.id}
                  defaultChecked={assignedIds.has(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary">{submitLabel}</button>
        <a href="/admin/collections" className="admin-btn admin-btn--ghost">Hủy</a>
      </div>
    </form>
  );
}

export default async function AdminCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string; success?: string; error?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const [collections, products] = await Promise.all([
    getAllCollections().catch(() => []),
    getAllProducts().catch(() => []),
  ]);

  let editCollection: AdminCollection | null = null;
  let assignedIds = new Set<string>();
  if (sp.edit) {
    editCollection = await getCollectionById(sp.edit);
    if (!editCollection) redirect('/admin/collections');
    assignedIds = new Set(await getCollectionProductIds(editCollection.id));
  }

  const showNew = sp.new === '1';
  const showEdit = !!editCollection;

  return (
    <AdminShell email={email} activePath="/admin/collections">
      <header className="admin-header">
        <h1 className="admin-header__title">Collections / BST</h1>
        <p className="admin-header__subtitle">{collections.length} bộ sưu tập</p>
      </header>

      {sp.success && (
        <div className="admin-banner">✓ Đã {sp.success === 'created' ? 'tạo' : sp.success === 'deleted' ? 'xoá' : 'cập nhật'} bộ sưu tập.</div>
      )}
      {sp.error && (
        <div className="admin-banner admin-banner--error">⚠️ {decodeURIComponent(sp.error)}</div>
      )}

      {!showNew && !showEdit && (
        <div style={{ marginBottom: 16 }}>
          <a href="/admin/collections?new=1" className="admin-btn admin-btn--primary">+ Thêm bộ sưu tập</a>
        </div>
      )}

      {showNew && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Thêm bộ sưu tập</h2>
          <CollectionForm products={products} assignedIds={assignedIds} submitLabel="Tạo bộ sưu tập" />
        </section>
      )}

      {showEdit && editCollection && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Chỉnh sửa: {editCollection.name}</h2>
          <CollectionForm collection={editCollection} products={products} assignedIds={assignedIds} submitLabel="Lưu thay đổi" />
        </section>
      )}

      <section className="admin-section">
        <h2 className="admin-section__heading">Danh sách bộ sưu tập</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Tên</th><th>Slug</th><th>Active</th><th>Thứ tự</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {collections.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#bbb' }}>
                  Chưa có bộ sưu tập. Trang /collection sẽ dùng nhóm mặc định.
                </td></tr>
              ) : (
                collections.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td><code style={{ fontSize: 12 }}>{c.slug}</code></td>
                    <td>{c.is_active ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>{c.sort_order}</td>
                    <td>
                      <a href={`/admin/collections?edit=${c.id}`} className="admin-link">Sửa</a>
                      {' · '}
                      <form action={actionDeleteCollection} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={c.id} />
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
