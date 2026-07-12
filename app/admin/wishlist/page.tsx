import { requireAdmin } from '@/lib/admin/auth-check';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { AdminShell } from '../_components/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminWishlistPage() {
  const { email } = await requireAdmin();

  const db = createAdminSupabaseClient();
  const { data: items } = await db.from('wishlist_items')
    .select('id, user_id, product_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const wishlistItems = (items ?? []) as { id: string; user_id: string; product_id: string; created_at: string }[];

  // Aggregate by product
  const byProduct: Record<string, { product_id: string; count: number }> = {};
  wishlistItems.forEach(w => {
    if (!byProduct[w.product_id]) byProduct[w.product_id] = { product_id: w.product_id, count: 0 };
    byProduct[w.product_id].count++;
  });
  const topWishlisted = Object.values(byProduct).sort((a, b) => b.count - a.count).slice(0, 20);

  return (
    <AdminShell email={email} activePath="/admin/wishlist">
      <header className="admin-header">
        <h1 className="admin-header__title">Wishlist</h1>
        <p className="admin-header__subtitle">Tổng {wishlistItems.length} lượt yêu thích</p>
      </header>

      <div className="admin-stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-card__value">{wishlistItems.length}</div>
          <div className="admin-stat-card__label">Tổng lượt yêu thích</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__value">{new Set(wishlistItems.map(w => w.user_id)).size}</div>
          <div className="admin-stat-card__label">Người dùng unique</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__value">{new Set(wishlistItems.map(w => w.product_id)).size}</div>
          <div className="admin-stat-card__label">Sản phẩm được yêu thích</div>
        </div>
      </div>

      <p className="admin-section__heading">Sản phẩm được yêu thích nhiều nhất</p>
      <div className="admin-table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table className="admin-table">
          <thead><tr><th>Product ID</th><th>Lượt yêu thích</th></tr></thead>
          <tbody>
            {topWishlisted.length === 0 && <tr><td colSpan={2} className="admin-table__empty">Chưa có dữ liệu</td></tr>}
            {topWishlisted.map(p => (
              <tr key={p.product_id}>
                <td><code style={{ fontSize: '0.75rem' }}>{p.product_id}</code></td>
                <td>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="admin-section__heading">Lịch sử gần đây</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>User ID</th><th>Product ID</th><th>Thời gian</th></tr></thead>
          <tbody>
            {wishlistItems.slice(0, 50).map(w => (
              <tr key={w.id}>
                <td><code style={{ fontSize: '0.75rem' }}>{w.user_id.slice(0, 8)}...</code></td>
                <td><code style={{ fontSize: '0.75rem' }}>{w.product_id.slice(0, 8)}...</code></td>
                <td>{new Date(w.created_at).toLocaleDateString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
