'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import { adjustStock } from '@/lib/admin/inventory-data';

export async function actionAdjustStock(formData: FormData) {
  await requireAdmin();

  const productId = formData.get('productId') as string;
  const deltaStr  = formData.get('delta') as string;
  const reason    = (formData.get('reason') as string | null)?.trim() || 'manual_adjustment';
  const adminNote = (formData.get('adminNote') as string | null)?.trim() || undefined;

  if (!productId || !deltaStr) return;

  const delta = parseInt(deltaStr);
  if (isNaN(delta) || delta === 0) return;

  await adjustStock(productId, delta, reason, adminNote);
  revalidatePath('/admin/inventory');
}
