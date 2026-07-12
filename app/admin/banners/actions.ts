'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import { createBanner, updateBanner, deleteBanner } from '@/lib/banners/banners-data';

function readFields(fd: FormData) {
  return {
    name:          (fd.get('name') as string | null)?.trim() || null,
    image_url:     (fd.get('image_url') as string | null)?.trim() || null,
    image_path:    (fd.get('image_path') as string | null)?.trim() || null,
    alt:           (fd.get('alt') as string | null)?.trim() || null,
    collection_id: (fd.get('collection_id') as string | null)?.trim() || null,
    sort_order:    parseInt((fd.get('sort_order') as string) || '0') || 0,
    is_active:     fd.get('is_active') === 'on',
  };
}

export async function actionCreateBanner(formData: FormData) {
  await requireAdmin();
  const fields = readFields(formData);
  if (!fields.image_url) redirect('/admin/banners?new=1&error=' + encodeURIComponent('Vui lòng chọn ảnh banner.'));
  try {
    await createBanner(fields);
  } catch (err) {
    redirect('/admin/banners?new=1&error=' + encodeURIComponent(String(err)));
  }
  revalidatePath('/admin/banners');
  revalidatePath('/collection');
  redirect('/admin/banners?success=created');
}

export async function actionUpdateBanner(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string | null;
  if (!id) redirect('/admin/banners');
  const fields = readFields(formData);
  if (!fields.image_url) redirect(`/admin/banners?edit=${id}&error=` + encodeURIComponent('Vui lòng chọn ảnh banner.'));
  try {
    await updateBanner(id as string, fields);
  } catch (err) {
    redirect(`/admin/banners?edit=${id}&error=` + encodeURIComponent(String(err)));
  }
  revalidatePath('/admin/banners');
  revalidatePath('/collection');
  redirect('/admin/banners?success=updated');
}

export async function actionDeleteBanner(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string | null;
  if (!id) redirect('/admin/banners');
  await deleteBanner(id as string);
  revalidatePath('/admin/banners');
  revalidatePath('/collection');
  redirect('/admin/banners?success=deleted');
}
