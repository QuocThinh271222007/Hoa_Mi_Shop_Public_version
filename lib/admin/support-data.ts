import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import type { AdminSupportMessage } from './types';

const FIELDS = 'id, name, email, message, status, admin_note, resolved_at, archived_at, created_at';

export async function getSupportMessages(includeArchived = false): Promise<AdminSupportMessage[]> {
  const db = createAdminSupabaseClient();
  let query = db
    .from('support_messages')
    .select(FIELDS)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data } = await query;
  return (data ?? []) as AdminSupportMessage[];
}

export async function markSupportRead(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('support_messages')
    .update({ status: 'read' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markSupportResolved(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('support_messages')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateSupportAdminNote(id: string, adminNote: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('support_messages')
    .update({ admin_note: adminNote || null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function archiveSupportMessage(id: string): Promise<void> {
  const db = createAdminSupabaseClient();
  const { error } = await db
    .from('support_messages')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
