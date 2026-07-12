import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server-client';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// SERVER-ONLY. Call at the top of every admin server component / server action.
// Redirects to /admin/login if not authenticated or not an admin_user.
export async function requireAdmin(): Promise<{ email: string; userId: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const adminClient = createAdminSupabaseClient();
  const { data: adminUser } = await adminClient
    .from('admin_users')
    .select('id, email')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) redirect('/admin/login');

  return { email: user.email ?? '', userId: user.id };
}
