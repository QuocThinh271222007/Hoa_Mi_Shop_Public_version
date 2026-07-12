'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import {
  markSupportRead,
  markSupportResolved,
  updateSupportAdminNote,
  archiveSupportMessage,
} from '@/lib/admin/support-data';

export async function actionMarkRead(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await markSupportRead(id);
  revalidatePath('/admin/support');
}

export async function actionMarkResolved(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await markSupportResolved(id);
  revalidatePath('/admin/support');
}

export async function actionUpdateNote(formData: FormData) {
  await requireAdmin();
  const id        = formData.get('id') as string;
  const adminNote = (formData.get('adminNote') as string | null) ?? '';
  if (!id) return;
  await updateSupportAdminNote(id, adminNote);
  revalidatePath('/admin/support');
}

export async function actionArchive(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await archiveSupportMessage(id);
  revalidatePath('/admin/support');
}
