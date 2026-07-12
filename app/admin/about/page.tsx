import { requireAdmin } from '@/lib/admin/auth-check';
import { getSiteSettings } from '@/lib/admin/settings-data';
import { BUCKETS } from '@/lib/admin/storage';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { AdminShell } from '../_components/AdminShell';
import { SpiritCardEditor } from './SpiritCardEditor';
import { actionSaveAbout } from './actions';

export default async function AdminAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const settings = await getSiteSettings('about').catch(() => []);
  const m: Record<string, string> = {};
  for (const s of settings) m[s.key] = s.value ?? '';

  const sections = [1, 2, 3] as const;

  return (
    <AdminShell email={email} activePath="/admin/about">
      <header className="admin-header">
        <h1 className="admin-header__title">About Us</h1>
        <p className="admin-header__subtitle">Nội dung và hình ảnh trang giới thiệu (/about-us)</p>
      </header>

      {sp.success && <div className="admin-banner">✓ Đã lưu nội dung About Us.</div>}
      {sp.error && <div className="admin-banner admin-banner--error">⚠️ {decodeURIComponent(sp.error)}</div>}

      {settings.length === 0 ? (
        <div className="admin-banner admin-banner--error">
          Chưa có dữ liệu About Us. Chạy migration <code>20260705_about_page_content.sql</code> trong Supabase trước.
        </div>
      ) : (
        <form action={actionSaveAbout} className="admin-form">
          {/* Sections 1–3: title + body + image */}
          {sections.map((n) => (
            <section className="admin-section" key={n}>
              <h2 className="admin-section__heading">Section {n}</h2>
              <div className="admin-form__grid">
                <div className="admin-form__field">
                  <label className="admin-form__label">Tiêu đề</label>
                  <input
                    name={`setting_about_s${n}_title`}
                    defaultValue={m[`about_s${n}_title`] ?? ''}
                    className="admin-form__input"
                    placeholder={`About us ${n}`}
                  />
                </div>
                <div className="admin-form__field admin-form__field--full">
                  <label className="admin-form__label">Nội dung</label>
                  <textarea
                    name={`setting_about_s${n}_body`}
                    rows={5}
                    defaultValue={m[`about_s${n}_body`] ?? ''}
                    className="admin-form__textarea"
                    placeholder="Nhập nội dung..."
                  />
                </div>
                <div className="admin-form__field admin-form__field--full">
                  <ImageDropzone
                    bucket={BUCKETS.site}
                    label={n === 3 ? 'Ảnh nhóm' : 'Ảnh minh hoạ'}
                    name={`setting_about_s${n}_image`}
                    altName={`setting_about_s${n}_image_alt`}
                    defaultUrl={m[`about_s${n}_image`] ?? ''}
                    defaultAlt={m[`about_s${n}_image_alt`] ?? ''}
                  />
                </div>
              </div>
            </section>
          ))}

          {/* Spirit cards: each can be Text or Image */}
          <section className="admin-section">
            <h2 className="admin-section__heading">Thẻ tinh thần thương hiệu</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
              Mỗi thẻ có thể hiển thị <strong>Nội dung</strong>, <strong>Ảnh</strong>, hoặc{' '}
              <strong>Text + Ảnh nền</strong> (chữ nằm trên ảnh). Tùy chỉnh <strong>màu chữ</strong> và{' '}
              <strong>cỡ chữ</strong> cho chế độ có chữ. Dữ liệu tất cả chế độ đều được lưu, chỉ chế độ đang chọn mới hiển thị ra trang.
            </p>
            <div className="admin-form__grid">
              {sections.map((n) => (
                <SpiritCardEditor
                  key={n}
                  index={n}
                  bucket={BUCKETS.site}
                  defaultMode={m[`about_spirit_${n}_mode`] || 'text'}
                  defaultBody={m[`about_spirit_${n}_body`] ?? ''}
                  defaultImage={m[`about_spirit_${n}_image`] ?? ''}
                  defaultAlt={m[`about_spirit_${n}_image_alt`] ?? ''}
                  defaultColor={m[`about_spirit_${n}_text_color`] || '#ffffff'}
                  defaultSize={m[`about_spirit_${n}_text_size`] || 'md'}
                />
              ))}
            </div>
          </section>

          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Lưu tất cả</button>
            <a href="/about-us" target="_blank" className="admin-btn admin-btn--ghost">Xem trang</a>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
