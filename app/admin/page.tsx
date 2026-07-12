import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { getDashboardData, type DashboardData, type AdminProduct, type AdminOrder, type AdminSupportMessage } from '@/lib/admin/dashboard-data';
import { AdminShell } from './_components/AdminShell';
import { StatCard } from './_components/StatCard';
import { StatusBadge } from './_components/StatusBadge';

function formatVND(price: number): string {
  return `${price.toLocaleString('vi-VN')}đ`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}

function SqlBlock({ title, sql }: { title: string; sql: string }) {
  return (
    <div className="admin-sql-block">
      <p className="admin-sql-block__title">{title}</p>
      <code className="admin-sql-block__code">{sql}</code>
    </div>
  );
}

export default async function AdminPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="admin-shell">
        <div className="admin-main">
          <div className="admin-setup">
            <h2 className="admin-setup__title">Supabase not configured</h2>
            <p className="admin-setup__text">
              Add these variables to <code>.env.local</code> and restart the dev server:
            </p>
            <pre className="admin-setup__code">{`NEXT_PUBLIC_SUPABASE_URL=your_project_url\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key\nSUPABASE_SERVICE_ROLE_KEY=your_service_role_key`}</pre>
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <AdminShell email={user.email ?? ''} activePath="/admin">
        <div className="admin-banner admin-banner--error">
          ⚠️ <strong>SUPABASE_SERVICE_ROLE_KEY</strong> is missing. Add it to{' '}
          <code>.env.local</code> — never prefix with <code>NEXT_PUBLIC_</code>.
        </div>
      </AdminShell>
    );
  }

  let adminClient;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    return (
      <AdminShell email={user.email ?? ''} activePath="/admin">
        <div className="admin-banner admin-banner--error">
          ⚠️ Could not create admin client. Verify SUPABASE_SERVICE_ROLE_KEY is correct.
        </div>
      </AdminShell>
    );
  }

  const { data: adminUser, error: adminError } = await adminClient
    .from('admin_users')
    .select('id, role, email')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    const code = (adminError as { code?: string } | null)?.code;
    if (code === '42P01') {
      return (
        <AdminShell email={user.email ?? ''} activePath="/admin">
          <div className="admin-banner admin-banner--error">
            ⚠️ Table <code>public.admin_users</code> not found. Run the SQL migration in{' '}
            <code>supabase/schema.sql</code>, then <code>npm run admin:create</code>.
          </div>
        </AdminShell>
      );
    }
    return (
      <AdminShell email={user.email ?? ''} activePath="/admin">
        <div className="admin-banner admin-banner--error">
          ⛔ Access denied. <strong>{user.email}</strong> is not registered as an admin.
          Run <code>npm run admin:create</code> after setting ADMIN_EMAIL and ADMIN_PASSWORD.
        </div>
      </AdminShell>
    );
  }

  let data: DashboardData;
  try {
    data = await getDashboardData();
  } catch (err) {
    return (
      <AdminShell email={user.email ?? ''} activePath="/admin">
        <div className="admin-banner admin-banner--error">
          ⚠️ Failed to load dashboard data: {String(err)}
        </div>
      </AdminShell>
    );
  }

  const { stats, recentProducts, recentOrders, recentSupportMessages, errors } = data;

  return (
    <AdminShell email={user.email ?? ''} activePath="/admin">
      <div className="admin-banner">
        🔒 Admin dashboard — keep SUPABASE_SERVICE_ROLE_KEY server-only at all times.
      </div>

      <header className="admin-header">
        <h1 className="admin-header__title">Admin Dashboard</h1>
        <p className="admin-header__subtitle">Cúc Họa Mi — overview</p>
      </header>

      {/* Inventory + Orders */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Overview</h2>
        {errors.stats && (
          <div className="admin-banner admin-banner--error">⚠️ Stats error: {errors.stats}</div>
        )}
        <div className="admin-stat-grid">
          <StatCard label="Total Products"  value={stats.totalProducts} />
          <StatCard label="Out of Stock"    value={stats.outOfStockProducts} variant="warn" />
          <StatCard label="Bestsellers"     value={stats.bestsellerProducts} variant="accent" />
          <StatCard label="New Items"       value={stats.newProducts} variant="accent" />
          <StatCard label="Total Orders"    value={stats.totalOrders} />
          <StatCard label="Pending Orders"  value={stats.pendingOrders} variant="warn" />
          <StatCard label="Support Msgs"    value={stats.supportMessages} />
          <StatCard label="Wishlist Items"  value={stats.wishlistItems} />
          <StatCard label="Cart Items"      value={stats.cartItems} />
        </div>
      </section>

      {/* Analytics KPIs */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Analytics (live)</h2>
        <div className="admin-stat-grid">
          <StatCard label="Today Views"        value={stats.todayViews} variant="accent" />
          <StatCard label="7-Day Views"        value={stats.sevenDayViews} />
          <StatCard label="Unique Visitors 30d" value={stats.uniqueVisitors30d} />
        </div>
      </section>

      {/* Products */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Products — recent 20</h2>
        {errors.products && (
          <div className="admin-banner admin-banner--error">⚠️ {errors.products}</div>
        )}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th>Price</th>
                <th>Stock</th><th>Active</th><th>Best</th><th>New</th><th>Added</th>
              </tr>
            </thead>
            <tbody>
              {recentProducts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#bbb' }}>No products</td></tr>
              ) : (
                recentProducts.map((p: AdminProduct) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category ?? '–'}</td>
                    <td>{formatVND(p.price)}</td>
                    <td>{p.stock ?? 0}</td>
                    <td>{p.is_active !== false ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>{p.is_bestseller ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>{p.is_new ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>{formatDate(p.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Orders */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Orders — recent 20</h2>
        {errors.orders && (
          <div className="admin-banner admin-banner--error">⚠️ {errors.orders}</div>
        )}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th><th>Phone</th><th>Total</th>
                <th>Status</th><th>Payment</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#bbb' }}>No orders</td></tr>
              ) : (
                recentOrders.map((o: AdminOrder) => (
                  <tr key={o.id}>
                    <td>{o.customer_name}</td>
                    <td>{o.customer_phone}</td>
                    <td>{formatVND(o.total_amount ?? o.subtotal)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.payment_status ?? 'pending'} /></td>
                    <td>{formatDate(o.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Support messages */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Support Messages — recent 20</h2>
        {errors.support && (
          <div className="admin-banner admin-banner--error">⚠️ {errors.support}</div>
        )}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentSupportMessages.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#bbb' }}>No messages</td></tr>
              ) : (
                recentSupportMessages.map((m: AdminSupportMessage) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.email ?? '–'}</td>
                    <td><StatusBadge status={m.status ?? 'new'} /></td>
                    <td>{formatDate(m.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SQL Notes */}
      <section className="admin-section">
        <h2 className="admin-section__heading">SQL Notes</h2>
        <div className="admin-sql-grid">
          <SqlBlock title="List all products"   sql={`SELECT * FROM public.products\nORDER BY created_at DESC;`} />
          <SqlBlock title="List all orders"     sql={`SELECT * FROM public.orders\nORDER BY created_at DESC;`} />
          <SqlBlock title="Analytics today"     sql={`SELECT COUNT(*) FROM public.web_analytics_events\nWHERE created_at >= CURRENT_DATE;`} />
          <SqlBlock title="Table columns"       sql={`SELECT table_name, column_name, data_type\nFROM information_schema.columns\nWHERE table_schema = 'public'\nORDER BY table_name, ordinal_position;`} />
          <SqlBlock title="Inspect RLS"         sql={`SELECT tablename, policyname, cmd\nFROM pg_policies\nWHERE schemaname = 'public';`} />
          <SqlBlock title="List admin users"    sql={`SELECT id, email, role, created_at\nFROM public.admin_users\nORDER BY created_at;`} />
        </div>
      </section>
    </AdminShell>
  );
}
