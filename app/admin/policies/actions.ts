'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { upsertSiteSetting } from '@/lib/admin/settings-data';

// Saves every `setting_*` field from the Policies form, then revalidates the shop
// layout so the footer (shown on every page) reflects the new content immediately.
export async function actionSavePolicies(formData: FormData) {
  await requireAdmin();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('setting_')) {
      await upsertSiteSetting(key.replace('setting_', ''), value as string);
    }
  }
  revalidatePath('/', 'layout');
  revalidatePath('/admin/policies');
  redirect('/admin/policies?success=saved');
}
