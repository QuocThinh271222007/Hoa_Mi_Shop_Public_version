import { requireAdmin } from "@/lib/admin/auth-check";
import { createAdminSupabaseClient } from "@/lib/supabase/admin-client";
import { formatDateTimeVN } from "@/lib/time";
import { AdminShell } from "../_components/AdminShell";
import { actionAddBlacklist, actionRemoveBlacklist } from "./actions";

type BlacklistRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  ip: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
};

async function getBlacklist(): Promise<BlacklistRow[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from("blacklist")
    .select("id, user_id, email, ip, reason, created_by, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as BlacklistRow[];
}

export default async function AdminBlacklistPage() {
  const { email } = await requireAdmin();
  const rows = await getBlacklist();
  const now = Date.now();

  return (
    <AdminShell email={email} activePath="/admin/blacklist">
      <header className="admin-header">
        <h1 className="admin-header__title">Blacklist</h1>
        <p className="admin-header__subtitle">
          {rows.length} mục — chặn theo tài khoản, email hoặc IP
        </p>
      </header>

      {/* Add form */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Thêm mục chặn</h2>
        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
          Điền ít nhất một trong: User ID / Email / IP. Bỏ trống “Hết hạn” để chặn
          vĩnh viễn. Áp dụng cho gửi feedback, bình luận và các thao tác được bảo vệ.
        </p>
        <form action={actionAddBlacklist} className="admin-inline-form" style={{ flexWrap: "wrap", gap: 8 }}>
          <input name="user_id" className="admin-form__input admin-form__input--sm" placeholder="User ID (uuid)" style={{ width: 260 }} />
          <input name="email" type="email" className="admin-form__input admin-form__input--sm" placeholder="Email" style={{ width: 200 }} />
          <input name="ip" className="admin-form__input admin-form__input--sm" placeholder="IP" style={{ width: 140 }} />
          <input name="reason" className="admin-form__input admin-form__input--sm" placeholder="Lý do" style={{ width: 200 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}>
            Hết hạn
            <input name="expires_at" type="date" className="admin-form__input admin-form__input--sm" />
          </label>
          <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">
            + Chặn
          </button>
        </form>
      </section>

      {/* List */}
      <section className="admin-section">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>IP</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Bởi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#bbb" }}>
                    Chưa có mục nào bị chặn
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const expired = r.expires_at && new Date(r.expires_at).getTime() <= now;
                  return (
                    <tr key={r.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.user_id ?? "—"}</td>
                      <td>{r.email ?? "—"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.ip ?? "—"}</td>
                      <td>{r.reason ?? "—"}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: expired ? "#f3f4f6" : "#fee2e2",
                            color: expired ? "#6b7280" : "#b91c1c",
                          }}
                        >
                          {expired ? "Đã hết hạn" : r.expires_at ? `Đến ${formatDateTimeVN(r.expires_at)}` : "Vĩnh viễn"}
                        </span>
                      </td>
                      <td>{formatDateTimeVN(r.created_at)}</td>
                      <td style={{ fontSize: 12 }}>{r.created_by ?? "—"}</td>
                      <td>
                        <form action={actionRemoveBlacklist}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="admin-link" style={{ color: "#c0392b" }}>
                            Gỡ
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
