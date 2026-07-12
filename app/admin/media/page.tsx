import { requireAdmin } from '@/lib/admin/auth-check';
import { listRecentMedia, ALL_BUCKETS, BUCKETS } from '@/lib/admin/storage';
import { AdminShell } from '../_components/AdminShell';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { actionDeleteMedia } from './actions';

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function AdminMediaPage() {
  const { email } = await requireAdmin();

  let media: Awaited<ReturnType<typeof listRecentMedia>> = [];
  let loadError = '';
  try {
    media = await listRecentMedia(60);
  } catch (err) {
    loadError = String(err);
  }

  return (
    <AdminShell email={email} activePath="/admin/media">
      <header className="admin-header">
        <h1 className="admin-header__title">Media</h1>
        <p className="admin-header__subtitle">Upload &amp; quản lý ảnh trong Supabase Storage</p>
      </header>

      <section className="admin-section">
        <h2 className="admin-section__heading">Tải ảnh lên</h2>
        <p style={{ fontSize: 13, color: '#888', marginTop: -4 }}>
          Chọn bucket phù hợp rồi kéo/thả ảnh. Ảnh được lưu trong Supabase Storage,
          DB chỉ lưu đường dẫn/URL.
        </p>
        <div className="admin-form__grid">
          <div className="admin-form__field">
            <ImageDropzone bucket={BUCKETS.site} label={`site-assets`} />
          </div>
          <div className="admin-form__field">
            <ImageDropzone bucket={BUCKETS.product} label={`product-images`} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#aaa' }}>
          Buckets khả dụng: {ALL_BUCKETS.join(', ')}. Nếu chưa tạo bucket trong Supabase,
          upload sẽ báo lỗi rõ ràng (không làm hỏng trang).
        </p>
      </section>

      <section className="admin-section">
        <h2 className="admin-section__heading">Ảnh gần đây</h2>
        {loadError && (
          <div className="admin-banner admin-banner--error">
            ⚠️ Không tải được danh sách media. Kiểm tra Supabase &amp; migration. ({loadError})
          </div>
        )}
        {media.length === 0 ? (
          <p style={{ color: '#bbb' }}>Chưa có ảnh nào được upload.</p>
        ) : (
          <div className="admin-media-grid">
            {media.map((m) => (
              <div key={m.id} className="admin-media-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.public_url ?? ''}
                  alt={m.alt ?? m.path}
                  className="admin-media-card__thumb"
                />
                <div className="admin-media-card__body">
                  <span style={{ fontWeight: 600, color: '#555' }}>{m.bucket}</span>
                  <span className="admin-media-card__url">{m.public_url ?? m.path}</span>
                  <span>{m.mime} · {formatBytes(m.size)}</span>
                  <form action={actionDeleteMedia}>
                    <input type="hidden" name="bucket" value={m.bucket} />
                    <input type="hidden" name="path" value={m.path} />
                    <button type="submit" className="admin-link" style={{ color: '#c0392b' }}>Xoá</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
