import { requireAdmin } from '@/lib/admin/auth-check';
import { getSupportMessages } from '@/lib/admin/support-data';
import { AdminShell } from '../_components/AdminShell';
import { StatusBadge } from '../_components/StatusBadge';
import { actionMarkRead, actionMarkResolved, actionUpdateNote, actionArchive } from './actions';

function fmtDate(s: string) { try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return s; } }

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;
  const showArchived = sp.archived === '1';
  const messages = await getSupportMessages(showArchived);
  const newCount = messages.filter((m) => m.status === 'new').length;

  return (
    <AdminShell email={email} activePath="/admin/support">
      <header className="admin-header">
        <h1 className="admin-header__title">Support Messages</h1>
        <p className="admin-header__subtitle">
          {newCount > 0 && <span style={{ color: '#d97706', marginRight: 12 }}>⚠️ {newCount} tin mới</span>}
          {messages.length} tin nhắn
        </p>
      </header>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <a href="/admin/support" className={`admin-btn admin-btn--sm${!showArchived ? ' admin-btn--primary' : ' admin-btn--ghost'}`}>
          Active
        </a>
        <a href="/admin/support?archived=1" className={`admin-btn admin-btn--sm${showArchived ? ' admin-btn--primary' : ' admin-btn--ghost'}`}>
          Archived
        </a>
      </div>

      <section className="admin-section">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Tên</th><th>Email</th><th>Tin nhắn</th><th>Status</th><th>Ghi chú</th><th>Ngày</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#bbb' }}>Không có tin nhắn</td></tr>
              ) : (
                messages.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td style={{ fontSize: 11 }}>{m.email ?? '–'}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {m.message}
                    </td>
                    <td><StatusBadge status={m.status ?? 'new'} /></td>
                    <td style={{ fontSize: 11, color: '#888' }}>{m.admin_note ?? '–'}</td>
                    <td style={{ fontSize: 11 }}>{fmtDate(m.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                        {m.status === 'new' && (
                          <form action={actionMarkRead}>
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost" style={{ width: '100%' }}>Đã đọc</button>
                          </form>
                        )}
                        {m.status !== 'resolved' && (
                          <form action={actionMarkResolved}>
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary" style={{ width: '100%' }}>Resolved</button>
                          </form>
                        )}
                        {!m.archived_at && (
                          <form action={actionArchive}>
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="admin-btn admin-btn--sm" style={{ width: '100%', color: '#999' }}>Archive</button>
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

      {/* Inline note update */}
      {messages.length > 0 && (
        <section className="admin-section">
          <h2 className="admin-section__heading">Cập nhật ghi chú</h2>
          <form action={actionUpdateNote} className="admin-inline-form">
            <select name="id" className="admin-form__select" style={{ width: 200 }}>
              {messages.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.created_at.slice(0, 10)}</option>
              ))}
            </select>
            <input name="adminNote" className="admin-form__input" placeholder="Ghi chú nội bộ…" style={{ flex: 1 }} />
            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lưu</button>
          </form>
        </section>
      )}
    </AdminShell>
  );
}
