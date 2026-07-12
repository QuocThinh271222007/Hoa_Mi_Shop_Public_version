'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { upsertSiteSetting } from '@/lib/admin/settings-data';

// Saves every `setting_*` field from the About form into site_settings, then
// revalidates the public /about-us page so edits show immediately.
export async function actionSaveAbout(formData: FormData) {
  await requireAdmin();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('setting_')) {
      await upsertSiteSetting(key.replace('setting_', ''), value as string);
    }
  }
  revalidatePath('/about-us');
  revalidatePath('/admin/about');
  redirect('/admin/about?success=saved');
}
