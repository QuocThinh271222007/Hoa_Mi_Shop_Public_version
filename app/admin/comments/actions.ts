'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import { updateCommentStatus, updateCommentAdminNote } from '@/lib/admin/comments-data';

export async function actionApproveComment(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await updateCommentStatus(id, 'approved');
  revalidatePath('/admin/comments');
}

export async function actionHideComment(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await updateCommentStatus(id, 'hidden');
  revalidatePath('/admin/comments');
}

export async function actionSpamComment(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await updateCommentStatus(id, 'spam');
  revalidatePath('/admin/comments');
}

export async function actionSoftDeleteComment(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await updateCommentStatus(id, 'deleted');
  revalidatePath('/admin/comments');
}

export async function actionUpdateCommentNote(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  const adminNote = (formData.get('adminNote') as string | null) ?? '';
  if (!id) return;
  await updateCommentAdminNote(id, adminNote);
  revalidatePath('/admin/comments');
}
