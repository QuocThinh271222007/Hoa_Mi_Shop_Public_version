'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import { deleteMedia } from '@/lib/admin/storage';

export async function actionDeleteMedia(formData: FormData) {
  await requireAdmin();
  const bucket = String(formData.get('bucket') ?? '');
  const path = String(formData.get('path') ?? '');
  if (bucket && path) {
    await deleteMedia(bucket, path);
  }
  revalidatePath('/admin/media');
}
