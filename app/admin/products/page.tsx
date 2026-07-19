import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getAllProducts, getProductById } from '@/lib/admin/products-data';
import { getProductImages } from '@/lib/admin/product-images';
import { AdminShell } from '../_components/AdminShell';
import { StatusBadge } from '../_components/StatusBadge';
import { actionCreateProduct, actionUpdateProduct, actionToggleProductActive } from './actions';
import { DeleteProductButton } from './DeleteProductButton';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { ProductGalleryManager, type GalleryImage } from '@/components/admin/product-gallery/ProductGalleryManager';
import { BUCKETS } from '@/lib/admin/storage';
import type { AdminProduct } from '@/lib/admin/types';
import { formatDateVN } from '@/lib/time';

function formatVND(n: number) { return `${n.toLocaleString('vi-VN')}đ`; }
function formatDate(s: string) { try { return formatDateVN(s); } catch { return s; } }

function ProductForm({
  product,
  submitLabel,
  galleryImages = [],
}: {
  product?: AdminProduct;
  submitLabel: string;
  galleryImages?: GalleryImage[];
}) {
  const action = product ? actionUpdateProduct : actionCreateProduct;
  return (
    <form action={action} className="admin-form">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="admin-form__grid">
        <div className="admin-form__field">
          <label className="admin-form__label">Tên sản phẩm *</label>
          <input name="name" required defaultValue={product?.name ?? ''} className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Slug *</label>
          <input name="slug" required defaultValue={product?.slug ?? ''} className="admin-form__input" placeholder="day-ao-example" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Giá (VND) *</label>
          <input name="price" type="number" required min={0} defaultValue={product?.price ?? 0} className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Tồn kho</label>
          {product ? (
            // Edit mode: stock is owned solely by the Inventory page (single source of
            // truth + audit log). Show it read-only so saving a product edit can never
            // overwrite an inventory adjustment. Manage stock via /admin/inventory.
            <>
              <input type="number" value={product.stock ?? 0} readOnly disabled className="admin-form__input" />
              <small className="admin-form__hint">Chỉnh tồn kho tại trang <a href="/admin/inventory">Kho hàng</a> (có ghi lịch sử).</small>
            </>
          ) : (
            <input name="stock" type="number" min={0} defaultValue={0} className="admin-form__input" />
          )}
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Ngưỡng tồn thấp</label>
          <input name="low_stock_threshold" type="number" min={0} defaultValue={product?.low_stock_threshold ?? 3} className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">SKU</label>
          <input name="sku" defaultValue={product?.sku ?? ''} className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Category</label>
          <input name="category" defaultValue={product?.category ?? 'Dây áo'} className="admin-form__input" />
        </div>
        <div className="admin-form__field admin-form__field--full">
          <ImageDropzone
            bucket={BUCKETS.product}
            label="Ảnh sản phẩm (ảnh bìa)"
            defaultUrl={product?.image_url ?? ''}
            defaultAlt={product?.image_alt ?? ''}
            pathName="image_path"
          />
        </div>
        <div className="admin-form__field admin-form__field--full">
          <ProductGalleryManager bucket={BUCKETS.product} defaultImages={galleryImages} />
        </div>
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label">Mô tả</label>
          <textarea name="description" rows={3} defaultValue={product?.description ?? ''} className="admin-form__textarea" />
        </div>
        <div className="admin-form__field admin-form__field--checks">
          <label className="admin-form__check">
            <input type="checkbox" name="is_active" defaultChecked={product?.is_active !== false} />
            Hiển thị (Active)
          </label>
          <label className="admin-form__check">
            <input type="checkbox" name="is_bestseller" defaultChecked={!!product?.is_bestseller} />
            Bestseller
          </label>
          <label className="admin-form__check">
            <input type="checkbox" name="is_new" defaultChecked={!!product?.is_new} />
            New
          </label>
        </div>
      </div>
      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary">{submitLabel}</button>
        <a href="/admin/products" className="admin-btn admin-btn--ghost">Hủy</a>
      </div>
    </form>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string; success?: string; error?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const products = await getAllProducts();

  let editProduct: AdminProduct | null = null;
  let editGallery: GalleryImage[] = [];
  if (sp.edit) {
    editProduct = await getProductById(sp.edit);
    if (!editProduct) redirect('/admin/products');
    editGallery = (await getProductImages(editProduct.id)).map((img) => ({
      url: img.url,
      path: img.path,
      alt: img.alt,
    }));
  }

  const showNew  = sp.new === '1';
  const showEdit = !!editProduct;

  return (
    <AdminShell email={email} activePath="/admin/products">
      <header className="admin-header">
        <h1 className="admin-header__title">Products</h1>
        <p className="admin-header__subtitle">{products.length} sản phẩm</p>
      </header>

      {sp.success && (
        <div className="admin-banner">
          ✓ {sp.success === 'created' ? 'Đã tạo sản phẩm.' : sp.success === 'deleted' ? 'Đã xóa sản phẩm.' : 'Đã cập nhật.'}
        </div>
      )}
      {sp.error && (
        <div className="admin-banner admin-banner--error">⚠️ {decodeURIComponent(sp.error)}</div>
      )}

      {!showNew && !showEdit && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <a href="/admin/products?new=1" className="admin-btn admin-btn--primary">+ Thêm sản phẩm</a>
          <a href="/api/admin/products/export" className="admin-btn admin-btn--ghost">Export CSV</a>
        </div>
      )}

      {showNew && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Thêm sản phẩm mới</h2>
          <ProductForm submitLabel="Tạo sản phẩm" />
        </section>
      )}

      {showEdit && editProduct && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Chỉnh sửa: {editProduct.name}</h2>
          <ProductForm product={editProduct} submitLabel="Lưu thay đổi" galleryImages={editGallery} />
        </section>
      )}

      <section className="admin-section">
        <h2 className="admin-section__heading">Danh sách sản phẩm</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th><th>Giá</th><th>Stock</th><th>Active</th>
                <th>Best</th><th>New</th><th>Ngày tạo</th><th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#bbb' }}>Chưa có sản phẩm</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#bbb' }}>{p.slug}</div>
                    </td>
                    <td>{formatVND(p.price)}</td>
                    <td>
                      <span style={{ color: (p.stock ?? 0) <= 0 ? '#e00' : (p.stock ?? 0) <= (p.low_stock_threshold ?? 3) ? '#d97706' : 'inherit' }}>
                        {p.stock ?? 0}
                      </span>
                    </td>
                    <td>
                      <form action={actionToggleProductActive} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="value" value={String(p.is_active === false ? true : false)} />
                        <button type="submit" className={`admin-toggle${p.is_active !== false ? ' admin-toggle--on' : ''}`}>
                          {p.is_active !== false ? 'ON' : 'OFF'}
                        </button>
                      </form>
                    </td>
                    <td>{p.is_bestseller ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>{p.is_new ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>{formatDate(p.created_at)}</td>
                    <td style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <a href={`/admin/products?edit=${p.id}`} className="admin-link">Sửa</a>
                      <DeleteProductButton id={p.id} name={p.name} />
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
