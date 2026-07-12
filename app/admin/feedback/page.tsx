import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getFeedbackItems, createFeedbackItem, updateFeedbackItem, deleteFeedbackItem } from '@/lib/admin/feedback-data';
import { getSettingsMap, upsertSiteSetting } from '@/lib/admin/settings-data';
import { truncateWords } from '@/lib/feedback/truncate-words';
import { AdminShell } from '../_components/AdminShell';
import { StatusBadge } from '../_components/StatusBadge';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { BUCKETS } from '@/lib/admin/storage';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  const { email } = await requireAdmin();

  const items = await getFeedbackItems().catch(() => []);
  const settings = await getSettingsMap(['feedback_padlet_title']).catch(() => ({}) as Record<string, string>);
  const padletTitle = settings.feedback_padlet_title || 'PADLET';

  async function createAction(formData: FormData) {
    'use server';
    const fields = {
      customer_name: formData.get('customer_name') as string,
      message: formData.get('message') as string,
      image_url: (formData.get('image_url') as string) || null,
      image_path: (formData.get('image_path') as string) || null,
      image_alt: (formData.get('image_alt') as string) || null,
      rating: Number(formData.get('rating')) || null,
      description: truncateWords(((formData.get('description') as string) || '').trim(), 10) || null,
      detail_title: (formData.get('detail_title') as string) || null,
      detail_title_font_size: Number(formData.get('detail_title_font_size')) || null,
      reviewer_font_size: Number(formData.get('reviewer_font_size')) || null,
      is_featured: formData.get('is_featured') === 'on',
      is_published: formData.get('is_published') === 'on',
      sort_order: Number(formData.get('sort_order')) || 0,
    };
    await createFeedbackItem(fields);
    redirect('/admin/feedback');
  }

  async function saveFeedbackSettingsAction(formData: FormData) {
    'use server';
    await upsertSiteSetting('feedback_padlet_title', (formData.get('padlet_title') as string) || 'PADLET');
    redirect('/admin/feedback');
  }

  async function toggleAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const val = formData.get('is_published') === 'true';
    await updateFeedbackItem(id, { is_published: !val });
    redirect('/admin/feedback');
  }

  async function editAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (!id) return;
    await updateFeedbackItem(id, {
      customer_name: (formData.get('customer_name') as string)?.trim() || '',
      message: (formData.get('message') as string)?.trim() || '',
      rating: Number(formData.get('rating')) || null,
      image_alt: (formData.get('image_alt') as string) || null,
      description: truncateWords(((formData.get('description') as string) || '').trim(), 10) || null,
      detail_title: (formData.get('detail_title') as string) || null,
      detail_title_font_size: Number(formData.get('detail_title_font_size')) || null,
      reviewer_font_size: Number(formData.get('reviewer_font_size')) || null,
      is_featured: formData.get('is_featured') === 'on',
      is_published: formData.get('is_published') === 'on',
      sort_order: Number(formData.get('sort_order')) || 0,
    });
    redirect('/admin/feedback');
  }

  async function deleteAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteFeedbackItem(id);
    redirect('/admin/feedback');
  }

  return (
    <AdminShell email={email} activePath="/admin/feedback">
      <header className="admin-header">
        <h1 className="admin-header__title">Feedback CMS</h1>
        <p className="admin-header__subtitle">{items.length} đánh giá</p>
      </header>

      <details className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem 0' }}>Cài đặt chung</summary>
        <form action={saveFeedbackSettingsAction} className="admin-form" style={{ marginTop: '1rem' }}>
          <div className="admin-form__field">
            <label className="admin-form__label">Tiêu đề PADLET</label>
            <input name="padlet_title" defaultValue={padletTitle} className="admin-form__input" />
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Lưu cài đặt</button>
          </div>
        </form>
      </details>

      <details className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem 0' }}>+ Thêm đánh giá</summary>
        <form action={createAction} className="admin-form" style={{ marginTop: '1rem' }}>
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label className="admin-form__label">Tên khách hàng *</label>
              <input name="customer_name" required className="admin-form__input" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Đánh giá (1-5)</label>
              <input name="rating" type="number" min={1} max={5} className="admin-form__input" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Mô tả ngắn (hiện bên phải trái tim, tối đa 10 từ)</label>
              <input name="description" style={{ fontFamily: 'var(--title-font)' }} className="admin-form__input" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Cỡ chữ mô tả (px)</label>
              <input name="reviewer_font_size" type="number" min={8} max={80} placeholder="mặc định" className="admin-form__input" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Nội dung *</label>
              <textarea name="message" required rows={3} className="admin-form__textarea" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Tiêu đề chi tiết</label>
              <textarea
                name="detail_title"
                rows={2}
                placeholder={'FEEDBACK CHI TIẾT\nCỦA NGƯỜI ĐÓ'}
                style={{ fontFamily: 'var(--title-font)' }}
                className="admin-form__textarea"
              />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Cỡ chữ tiêu đề chi tiết (px)</label>
              <input name="detail_title_font_size" type="number" placeholder="38 (mặc định)" className="admin-form__input" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <ImageDropzone bucket={BUCKETS.feedback} label="Ảnh feedback" pathName="image_path" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Thứ tự</label>
              <input name="sort_order" type="number" defaultValue={0} className="admin-form__input" />
            </div>
            <div className="admin-form__field admin-form__field--checks">
              <label className="admin-form__check"><input type="checkbox" name="is_featured" /> Nổi bật</label>
              <label className="admin-form__check"><input type="checkbox" name="is_published" defaultChecked /> Xuất bản</label>
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Tạo đánh giá</button>
          </div>
        </form>
      </details>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Nội dung</th>
              <th>Đánh giá</th>
              <th>Nổi bật</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="admin-table__empty">Chưa có đánh giá nào.</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.customer_name}</td>
                <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.message}>{item.message}</td>
                <td>{item.rating ? `${item.rating}/5` : '-'}</td>
                <td>{item.is_featured ? '⭐' : '-'}</td>
                <td><StatusBadge status={item.is_published ? 'published' : 'draft'} /></td>
                <td className="admin-table__actions">
                  <details className="admin-feedback-edit">
                    <summary className="admin-btn admin-btn--sm admin-btn--ghost" style={{ display: 'inline-block' }}>
                      Xem / Sửa
                    </summary>
                    <form action={editAction} className="admin-form" style={{ marginTop: 10, minWidth: 300 }}>
                      <input type="hidden" name="id" value={item.id} />
                      {item.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.image_alt ?? ''}
                          style={{ maxWidth: 180, borderRadius: 8, marginBottom: 8, display: 'block' }}
                        />
                      )}
                      <div className="admin-form__field">
                        <label className="admin-form__label">Tên khách hàng</label>
                        <input name="customer_name" defaultValue={item.customer_name} className="admin-form__input" />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Nội dung đầy đủ</label>
                        <textarea name="message" defaultValue={item.message} rows={5} className="admin-form__textarea" />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Đánh giá (1-5)</label>
                        <input name="rating" type="number" min={1} max={5} defaultValue={item.rating ?? ''} className="admin-form__input" />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Mô tả ngắn (hiện bên phải trái tim, tối đa 10 từ)</label>
                        <input
                          name="description"
                          defaultValue={item.description ?? ''}
                          style={{ fontFamily: 'var(--title-font)' }}
                          className="admin-form__input"
                        />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Cỡ chữ mô tả (px)</label>
                        <input
                          name="reviewer_font_size"
                          type="number"
                          min={8}
                          max={80}
                          defaultValue={item.reviewer_font_size ?? ''}
                          placeholder="mặc định"
                          className="admin-form__input"
                        />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Tiêu đề chi tiết</label>
                        <textarea
                          name="detail_title"
                          rows={2}
                          defaultValue={item.detail_title ?? ''}
                          placeholder={'FEEDBACK CHI TIẾT\nCỦA NGƯỜI ĐÓ'}
                          style={{ fontFamily: 'var(--title-font)' }}
                          className="admin-form__textarea"
                        />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Cỡ chữ tiêu đề chi tiết (px)</label>
                        <input
                          name="detail_title_font_size"
                          type="number"
                          defaultValue={item.detail_title_font_size ?? ''}
                          placeholder="38 (mặc định)"
                          className="admin-form__input"
                        />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Thứ tự</label>
                        <input name="sort_order" type="number" defaultValue={item.sort_order} className="admin-form__input" />
                      </div>
                      <div className="admin-form__field">
                        <label className="admin-form__label">Mô tả ảnh (alt)</label>
                        <input name="image_alt" defaultValue={item.image_alt ?? ''} className="admin-form__input" />
                      </div>
                      <div className="admin-form__field admin-form__field--checks">
                        <label className="admin-form__check"><input type="checkbox" name="is_featured" defaultChecked={item.is_featured} /> Nổi bật</label>
                        <label className="admin-form__check"><input type="checkbox" name="is_published" defaultChecked={item.is_published} /> Hiển thị</label>
                      </div>
                      <div className="admin-form__actions">
                        <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lưu thay đổi</button>
                      </div>
                    </form>
                  </details>
                  <form action={toggleAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="is_published" value={String(item.is_published)} />
                    <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost">
                      {item.is_published ? 'Ẩn' : 'Xuất bản'}
                    </button>
                  </form>
                  <form action={deleteAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="admin-btn admin-btn--sm admin-btn--danger">
                      Xóa
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
