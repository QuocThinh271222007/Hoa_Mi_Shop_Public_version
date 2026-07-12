import { requireAdmin } from '@/lib/admin/auth-check';
import { getComments } from '@/lib/admin/comments-data';
import { AdminShell } from '../_components/AdminShell';
import { StatusBadge } from '../_components/StatusBadge';
import {
  actionApproveComment,
  actionHideComment,
  actionSpamComment,
  actionSoftDeleteComment,
  actionUpdateCommentNote,
} from './actions';

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return s; }
}

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'hidden', 'spam', 'deleted'];
const TARGET_OPTIONS = ['all', 'blog', 'product', 'feedback', 'site'];

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; target_type?: string; search?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;
  const statusFilter = sp.status ?? 'pending';
  const targetFilter = sp.target_type ?? 'all';
  const search = sp.search ?? '';

  const comments = await getComments({
    status: statusFilter,
    target_type: targetFilter,
    search,
  });

  const pendingCount = statusFilter !== 'pending'
    ? (await getComments({ status: 'pending' })).length
    : comments.length;

  // Keep approved comments visible below the working view (e.g. while triaging
  // "pending") so they can still be removed later if the admin changes their mind.
  // Skipped when the main table already lists approved comments.
  const showApproved = statusFilter !== 'approved' && statusFilter !== 'all';
  const approvedComments = showApproved
    ? await getComments({ status: 'approved', target_type: targetFilter, search })
    : [];

  return (
    <AdminShell email={email} activePath="/admin/comments">
      <header className="admin-header">
        <h1 className="admin-header__title">Comments</h1>
        <p className="admin-header__subtitle">
          {pendingCount > 0 && statusFilter !== 'pending' && (
            <span style={{ color: '#d97706', marginRight: 12 }}>⚠️ {pendingCount} chờ duyệt</span>
          )}
          {comments.length} bình luận
        </p>
      </header>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_OPTIONS.map((s) => (
          <a
            key={s}
            href={`/admin/comments?status=${s}&target_type=${targetFilter}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
            className={`admin-btn admin-btn--sm${statusFilter === s ? ' admin-btn--primary' : ' admin-btn--ghost'}`}
          >
            {s === 'all' ? 'Tất cả' : s}
          </a>
        ))}
        <span style={{ color: '#bbb', margin: '0 4px' }}>|</span>
        {TARGET_OPTIONS.map((t) => (
          <a
            key={t}
            href={`/admin/comments?status=${statusFilter}&target_type=${t}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
            className={`admin-btn admin-btn--sm${targetFilter === t ? ' admin-btn--primary' : ' admin-btn--ghost'}`}
          >
            {t === 'all' ? 'Tất cả loại' : t}
          </a>
        ))}
      </div>

      {/* Search */}
      <form method="GET" action="/admin/comments" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input type="hidden" name="status" value={statusFilter} />
        <input type="hidden" name="target_type" value={targetFilter} />
        <input
          name="search"
          className="admin-form__input"
          placeholder="Tìm theo tên, email, nội dung…"
          defaultValue={search}
          style={{ maxWidth: 320 }}
        />
        <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Tìm</button>
        {search && (
          <a
            href={`/admin/comments?status=${statusFilter}&target_type=${targetFilter}`}
            className="admin-btn admin-btn--sm admin-btn--ghost"
          >
            Xoá tìm
          </a>
        )}
      </form>

      {/* Table */}
      <section className="admin-section">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Loại / Slug</th>
                <th>Tác giả</th>
                <th>Nội dung</th>
                <th>Status</th>
                <th>Ghi chú</th>
                <th>Ngày</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {comments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#bbb' }}>
                    Không có bình luận
                  </td>
                </tr>
              ) : (
                comments.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontSize: 11 }}>
                      <span style={{ fontWeight: 600 }}>{c.target_type}</span>
                      {c.target_slug && (
                        <><br /><span style={{ color: '#888' }}>{c.target_slug}</span></>
                      )}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {c.author_name ?? <em style={{ color: '#bbb' }}>Ẩn danh</em>}
                      {c.author_email && <><br /><span style={{ color: '#aaa' }}>{c.author_email}</span></>}
                    </td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {c.content}
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td style={{ fontSize: 11, color: '#888' }}>{c.admin_note ?? '–'}</td>
                    <td style={{ fontSize: 11 }}>{fmtDate(c.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
                        {c.status !== 'approved' && (
                          <form action={actionApproveComment}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary" style={{ width: '100%' }}>
                              Duyệt
                            </button>
                          </form>
                        )}
                        {c.status !== 'hidden' && c.status !== 'deleted' && (
                          <form action={actionHideComment}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost" style={{ width: '100%' }}>
                              Ẩn
                            </button>
                          </form>
                        )}
                        {c.status !== 'spam' && c.status !== 'deleted' && (
                          <form action={actionSpamComment}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="admin-btn admin-btn--sm" style={{ width: '100%', color: '#dc2626' }}>
                              Spam
                            </button>
                          </form>
                        )}
                        {c.status !== 'deleted' && (
                          <form action={actionSoftDeleteComment}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="admin-btn admin-btn--sm" style={{ width: '100%', color: '#999' }}>
                              Xoá
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Approved comments — kept visible so they can still be removed later */}
      {showApproved && approvedComments.length > 0 && (
        <section className="admin-section">
          <h2 className="admin-section__heading">
            Đã duyệt ({approvedComments.length}) — có thể xoá nếu cần
          </h2>
          <p style={{ fontSize: 12, color: '#888', marginTop: -4, marginBottom: 10 }}>
            Các bình luận đang hiển thị công khai. Bấm “Xoá” để gỡ, hoặc “Ẩn” để tạm ẩn.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Loại / Slug</th>
                  <th>Tác giả</th>
                  <th>Nội dung</th>
                  <th>Ngày</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {approvedComments.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontSize: 11 }}>
                      <span style={{ fontWeight: 600 }}>{c.target_type}</span>
                      {c.target_slug && (
                        <><br /><span style={{ color: '#888' }}>{c.target_slug}</span></>
                      )}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {c.author_name ?? <em style={{ color: '#bbb' }}>Ẩn danh</em>}
                      {c.author_email && <><br /><span style={{ color: '#aaa' }}>{c.author_email}</span></>}
                    </td>
                    <td style={{ maxWidth: 320, fontSize: 12, whiteSpace: 'normal' }}>{c.content}</td>
                    <td style={{ fontSize: 11 }}>{fmtDate(c.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 90 }}>
                        <form action={actionHideComment}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost" style={{ width: '100%' }}>
                            Ẩn
                          </button>
                        </form>
                        <form action={actionSoftDeleteComment}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="admin-btn admin-btn--sm" style={{ width: '100%', color: '#dc2626' }}>
                            Xoá
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Admin note update */}
      {comments.length > 0 && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Cập nhật ghi chú</h2>
          <form action={actionUpdateCommentNote} className="admin-inline-form">
            <select name="id" className="admin-form__select" style={{ width: 260 }}>
              {comments.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.author_name ?? 'Ẩn danh')} — {c.created_at.slice(0, 10)}
                </option>
              ))}
            </select>
            <input
              name="adminNote"
              className="admin-form__input"
              placeholder="Ghi chú nội bộ…"
              style={{ flex: 1 }}
            />
            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lưu</button>
          </form>
        </section>
      )}
    </AdminShell>
  );
}
