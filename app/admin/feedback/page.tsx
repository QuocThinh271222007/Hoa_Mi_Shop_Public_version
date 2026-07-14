import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getFeedbackItems, createFeedbackItem, updateFeedbackItem, deleteFeedbackItem } from '@/lib/admin/feedback-data';
import { getPadletPosts, createPadletPost, updatePadletPost, deletePadletPost } from '@/lib/admin/padlet-data';
import { getSettingsMap, upsertSiteSetting } from '@/lib/admin/settings-data';
import { truncateWords } from '@/lib/feedback/truncate-words';
import { AdminShell } from '../_components/AdminShell';
import { StatusBadge } from '../_components/StatusBadge';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { BUCKETS } from '@/lib/admin/storage';

export const dynamic = 'force-dynamic';

// Pastel card backgrounds for padlet posts (label + hex).
const PADLET_COLORS: { label: string; value: string }[] = [
  { label: 'Vàng kem', value: '#FFF4C2' },
  { label: 'Hồng',      value: '#FFE0EC' },
  { label: 'Mint',      value: '#D9F5E5' },
  { label: 'Xanh dương', value: '#DCEBFF' },
  { label: 'Tím',       value: '#ECE0FF' },
  { label: 'Cam',       value: '#FFE6CC' },
  { label: 'Trắng',     value: '#FFFFFF' },
];
const PADLET_DEFAULT_COLOR = PADLET_COLORS[0].value;

// Module-level so the 'use server' actions below reference it as a stable import
// binding instead of capturing it as a (non-serializable) closure variable.
function padletFieldsFromForm(formData: FormData) {
  return {
    author_name: (formData.get('author_name') as string)?.trim() || null,
    title: (formData.get('title') as string)?.trim() || null,
    body: (formData.get('body') as string)?.trim() || null,
    image_url: (formData.get('image_url') as string) || null,
    image_path: (formData.get('image_path') as string) || null,
    image_alt: (formData.get('image_alt') as string) || null,
    bg_color: (formData.get('bg_color') as string) || PADLET_DEFAULT_COLOR,
    sort_order: Number(formData.get('sort_order')) || 0,
    is_published: formData.get('is_published') === 'on',
  };
}

export default async function AdminFeedbackPage() {
  const { email } = await requireAdmin();

  const items = await getFeedbackItems().catch(() => []);
  const padletPosts = await getPadletPosts().catch(() => []);
  const settings = await getSettingsMap([
    'feedback_padlet_title',
    'feedback_padlet_bg_type',
    'feedback_padlet_bg_color',
    'feedback_padlet_bg_gradient',
    'feedback_padlet_bg_image',
  ]).catch(() => ({}) as Record<string, string>);
  const padletTitle = settings.feedback_padlet_title || 'PADLET';
  const bgType = settings.feedback_padlet_bg_type || 'gradient';
  const bgColor = settings.feedback_padlet_bg_color || '#ffd9ec';
  const bgGradient = settings.feedback_padlet_bg_gradient || 'linear-gradient(135deg, #ffd9ec 0%, #ffe9d6 45%, #ffd5ea 100%)';
  const bgImage = settings.feedback_padlet_bg_image || '';

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
    await upsertSiteSetting('feedback_padlet_bg_type', (formData.get('padlet_bg_type') as string) || 'gradient');
    await upsertSiteSetting('feedback_padlet_bg_color', (formData.get('padlet_bg_color') as string) || '#ffd9ec');
    await upsertSiteSetting('feedback_padlet_bg_gradient', (formData.get('padlet_bg_gradient') as string) || '');
    await upsertSiteSetting('feedback_padlet_bg_image', (formData.get('padlet_bg_image') as string) || '');
    redirect('/admin/feedback');
  }

  async function toggleAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const val = formData.get('is_published') === 'true';
    await updateFeedbackItem(id, { is_published: !val });
    redirect('/admin/feedback');
  }

  // ── Padlet wall actions ──
  async function createPadletAction(formData: FormData) {
    'use server';
    await createPadletPost(padletFieldsFromForm(formData));
    redirect('/admin/feedback');
  }

  async function editPadletAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    if (!id) return;
    // Keep the existing image if the edit form didn't upload a new one.
    const fields = padletFieldsFromForm(formData);
    if (!fields.image_url) {
      delete (fields as Partial<typeof fields>).image_url;
      delete (fields as Partial<typeof fields>).image_path;
    }
    await updatePadletPost(id, fields);
    redirect('/admin/feedback');
  }

  async function togglePadletAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const val = formData.get('is_published') === 'true';
    await updatePadletPost(id, { is_published: !val });
    redirect('/admin/feedback');
  }

  async function deletePadletAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deletePadletPost(id);
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
          <div className="admin-form__grid">
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Tiêu đề PADLET</label>
              <input name="padlet_title" defaultValue={padletTitle} className="admin-form__input" />
            </div>

            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Nền tường Padlet — chọn kiểu</label>
              <select name="padlet_bg_type" defaultValue={bgType} className="admin-form__input">
                <option value="color">Màu đơn sắc</option>
                <option value="gradient">Gradient</option>
                <option value="image">Ảnh nền (hiển thị nguyên, không làm mờ)</option>
              </select>
            </div>

            <div className="admin-form__field">
              <label className="admin-form__label">Màu nền (khi chọn &quot;Màu&quot;)</label>
              <input name="padlet_bg_color" type="color" defaultValue={bgColor} className="admin-form__input" style={{ height: 42, padding: 4 }} />
            </div>

            <div className="admin-form__field">
              <label className="admin-form__label">Gradient CSS (khi chọn &quot;Gradient&quot;)</label>
              <input
                name="padlet_bg_gradient"
                defaultValue={bgGradient}
                className="admin-form__input"
                placeholder="linear-gradient(135deg, #ffd9ec 0%, #ffe9d6 100%)"
              />
            </div>

            <div className="admin-form__field admin-form__field--full">
              <ImageDropzone
                bucket={BUCKETS.site}
                label="Ảnh nền (khi chọn &quot;Ảnh nền&quot;)"
                name="padlet_bg_image"
                defaultUrl={bgImage}
              />
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Lưu cài đặt</button>
          </div>
        </form>
      </details>

      {/* ── Padlet wall management ── */}
      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: 18 }}>Tường Padlet</h2>
        <p className="admin-header__subtitle" style={{ marginTop: 0 }}>
          {padletPosts.length} bài · Đăng bài trực tiếp lên tường feedback (không cần padlet.com)
        </p>

        <details style={{ marginTop: '0.75rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem 0' }}>+ Đăng bài mới</summary>
          <form action={createPadletAction} className="admin-form" style={{ marginTop: '1rem' }}>
            <div className="admin-form__grid">
              <div className="admin-form__field">
                <label className="admin-form__label">Tác giả</label>
                <input name="author_name" className="admin-form__input" placeholder="Tên người đăng" />
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Tiêu đề</label>
                <input name="title" className="admin-form__input" />
              </div>
              <div className="admin-form__field admin-form__field--full">
                <label className="admin-form__label">Nội dung</label>
                <textarea name="body" rows={3} className="admin-form__textarea" />
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Màu nền thẻ</label>
                <select name="bg_color" defaultValue={PADLET_DEFAULT_COLOR} className="admin-form__input">
                  {PADLET_COLORS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form__field">
                <label className="admin-form__label">Thứ tự</label>
                <input name="sort_order" type="number" defaultValue={0} className="admin-form__input" />
              </div>
              <div className="admin-form__field admin-form__field--full">
                <ImageDropzone bucket={BUCKETS.feedback} label="Ảnh (không bắt buộc)" pathName="image_path" />
              </div>
              <div className="admin-form__field admin-form__field--checks">
                <label className="admin-form__check"><input type="checkbox" name="is_published" defaultChecked /> Xuất bản</label>
              </div>
            </div>
            <div className="admin-form__actions">
              <button type="submit" className="admin-btn admin-btn--primary">Đăng bài</button>
            </div>
          </form>
        </details>

        {padletPosts.length > 0 && (
          <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Màu</th>
                  <th>Tiêu đề</th>
                  <th>Nội dung</th>
                  <th>Tác giả</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {padletPosts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 4, border: '1px solid #ccc', background: p.bg_color ?? '#fff' }} />
                    </td>
                    <td>{p.title ?? '-'}</td>
                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.body ?? ''}>{p.body ?? '-'}</td>
                    <td>{p.author_name ?? '-'}</td>
                    <td><StatusBadge status={p.is_published ? 'published' : 'draft'} /></td>
                    <td className="admin-table__actions">
                      <details className="admin-feedback-edit">
                        <summary className="admin-btn admin-btn--sm admin-btn--ghost" style={{ display: 'inline-block' }}>Xem / Sửa</summary>
                        <form action={editPadletAction} className="admin-form" style={{ marginTop: 10, minWidth: 300 }}>
                          <input type="hidden" name="id" value={p.id} />
                          {p.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt={p.image_alt ?? ''} style={{ maxWidth: 180, borderRadius: 8, marginBottom: 8, display: 'block' }} />
                          )}
                          <div className="admin-form__field">
                            <label className="admin-form__label">Tác giả</label>
                            <input name="author_name" defaultValue={p.author_name ?? ''} className="admin-form__input" />
                          </div>
                          <div className="admin-form__field">
                            <label className="admin-form__label">Tiêu đề</label>
                            <input name="title" defaultValue={p.title ?? ''} className="admin-form__input" />
                          </div>
                          <div className="admin-form__field">
                            <label className="admin-form__label">Nội dung</label>
                            <textarea name="body" defaultValue={p.body ?? ''} rows={4} className="admin-form__textarea" />
                          </div>
                          <div className="admin-form__field">
                            <label className="admin-form__label">Màu nền thẻ</label>
                            <select name="bg_color" defaultValue={p.bg_color ?? PADLET_DEFAULT_COLOR} className="admin-form__input">
                              {PADLET_COLORS.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="admin-form__field">
                            <label className="admin-form__label">Thứ tự</label>
                            <input name="sort_order" type="number" defaultValue={p.sort_order} className="admin-form__input" />
                          </div>
                          <div className="admin-form__field admin-form__field--full">
                            <ImageDropzone bucket={BUCKETS.feedback} label="Đổi ảnh (bỏ trống = giữ ảnh cũ)" pathName="image_path" />
                          </div>
                          <div className="admin-form__field admin-form__field--checks">
                            <label className="admin-form__check"><input type="checkbox" name="is_published" defaultChecked={p.is_published} /> Xuất bản</label>
                          </div>
                          <div className="admin-form__actions">
                            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lưu thay đổi</button>
                          </div>
                        </form>
                      </details>
                      <form action={togglePadletAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="is_published" value={String(p.is_published)} />
                        <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost">{p.is_published ? 'Ẩn' : 'Xuất bản'}</button>
                      </form>
                      <form action={deletePadletAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="admin-btn admin-btn--sm admin-btn--danger">Xóa</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
