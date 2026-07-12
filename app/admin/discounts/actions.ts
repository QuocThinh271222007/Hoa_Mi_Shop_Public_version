'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { createDiscountCode, updateDiscountCode, deleteDiscountCode } from '@/lib/admin/discounts-data';

export async function actionCreateDiscount(formData: FormData) {
  await requireAdmin();

  const code = (formData.get('code') as string | null)?.trim().toUpperCase();
  if (!code) redirect('/admin/discounts?new=1&error=required');

  await createDiscountCode({
    code,
    type:             formData.get('type') as string || 'fixed',
    value:            parseInt(formData.get('value') as string || '0'),
    min_order_amount: parseInt(formData.get('min_order_amount') as string || '0'),
    is_active:        formData.get('is_active') !== 'off',
    is_reusable:      formData.get('is_reusable') === 'on',
    description:      (formData.get('description') as string | null)?.trim() || null,
    expires_at:       (formData.get('expires_at') as string | null) || null,
  });

  revalidatePath('/admin/discounts');
  redirect('/admin/discounts?success=created');
}

export async function actionUpdateDiscount(formData: FormData) {
  await requireAdmin();

  const id   = formData.get('id') as string;
  const code = (formData.get('code') as string | null)?.trim().toUpperCase();
  if (!id || !code) redirect('/admin/discounts');

  await updateDiscountCode(id, {
    code,
    type:             formData.get('type') as string || 'fixed',
    value:            parseInt(formData.get('value') as string || '0'),
    min_order_amount: parseInt(formData.get('min_order_amount') as string || '0'),
    is_active:        formData.get('is_active') !== 'off',
    is_reusable:      formData.get('is_reusable') === 'on',
    description:      (formData.get('description') as string | null)?.trim() || null,
    expires_at:       (formData.get('expires_at') as string | null) || null,
  });

  revalidatePath('/admin/discounts');
  redirect('/admin/discounts?success=updated');
}

export async function actionDeleteDiscount(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await deleteDiscountCode(id);
  revalidatePath('/admin/discounts');
}
