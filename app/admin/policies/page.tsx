import { requireAdmin } from '@/lib/admin/auth-check';
import { getSiteSettings } from '@/lib/admin/settings-data';
import { AdminShell } from '../_components/AdminShell';
import { actionSavePolicies } from './actions';
import { PolicyEditorClient } from './PolicyEditorClient';

export const dynamic = 'force-dynamic';

export default async function AdminPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const settings = await getSiteSettings('policy').catch(() => []);
  const m: Record<string, string> = {};
  for (const s of settings) m[s.key] = s.value ?? '';

  const groups = [
    { key: 'purchase', label: 'Chính sách mua hàng' },
    { key: 'return', label: 'Chính sách đổi trả' },
  ] as const;

  return (
    <AdminShell email={email} activePath="/admin/policies">
      <header className="admin-header">
        <h1 className="admin-header__title">Chính sách</h1>
        <p className="admin-header__subtitle">Nội dung hiện trong footer — khách bấm để xem chi tiết.</p>
      </header>

      {sp.success && <div className="admin-banner">✓ Đã lưu chính sách.</div>}
      {sp.error && <div className="admin-banner admin-banner--error">⚠️ {decodeURIComponent(sp.error)}</div>}

      {settings.length === 0 ? (
        <div className="admin-banner admin-banner--error">
          Chưa có dữ liệu chính sách. Chạy migration <code>20260705_footer_policies.sql</code> trong Supabase trước.
        </div>
      ) : (
        <form action={actionSavePolicies} className="admin-form">
          {groups.map((g) => (
            <section className="admin-section" key={g.key}>
              <h2 className="admin-section__heading">{g.label}</h2>
              <div className="admin-form__grid">
                <div className="admin-form__field">
                  <label className="admin-form__label">Tiêu đề</label>
                  <input
                    name={`setting_policy_${g.key}_title`}
                    defaultValue={m[`policy_${g.key}_title`] ?? ''}
                    className="admin-form__input"
                    placeholder={g.label}
                  />
                </div>
                <div className="admin-form__field admin-form__field--full">
                  <PolicyEditorClient
                    name={`setting_policy_${g.key}_body`}
                    defaultValue={m[`policy_${g.key}_body`] ?? ''}
                    label="Nội dung"
                  />
                </div>
              </div>
            </section>
          ))}

          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Lưu chính sách</button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
