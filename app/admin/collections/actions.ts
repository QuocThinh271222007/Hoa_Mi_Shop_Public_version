'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import {
  createCollection,
  updateCollection,
  deleteCollection,
  setCollectionProducts,
} from '@/lib/admin/collections-data';

function parseProductIds(formData: FormData): string[] {
  // checkboxes named product_ids[] -> multiple values
  return formData.getAll('product_ids').map((v) => String(v)).filter(Boolean);
}

export async function actionCreateCollection(formData: FormData) {
  await requireAdmin();
  const name = (formData.get('name') as string | null)?.trim();
  const slug = (formData.get('slug') as string | null)?.trim();
  if (!name || !slug) redirect('/admin/collections?new=1&error=required');

  try {
    const id = await createCollection({
      name,
      slug,
      description:     (formData.get('description') as string | null)?.trim() || null,
      image_url:      (formData.get('image_url') as string | null)?.trim() || null,
      image_path:     (formData.get('image_path') as string | null)?.trim() || null,
      image_alt:      (formData.get('image_alt') as string | null)?.trim() || null,
      hero_image_url: (formData.get('hero_image_url') as string | null)?.trim() || null,
      hero_image_path:(formData.get('hero_image_path') as string | null)?.trim() || null,
      is_active:      formData.get('is_active') !== 'off',
      sort_order:     parseInt((formData.get('sort_order') as string) || '0'),
    });
    if (id) await setCollectionProducts(id, parseProductIds(formData));
  } catch (err) {
    redirect(`/admin/collections?new=1&error=${encodeURIComponent(String(err))}`);
  }

  revalidatePath('/admin/collections');
  revalidatePath('/collection');
  redirect('/admin/collections?success=created');
}

export async function actionUpdateCollection(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string | null;
  if (!id) redirect('/admin/collections');

  try {
    await updateCollection(id, {
      name:           (formData.get('name') as string | null)?.trim(),
      slug:           (formData.get('slug') as string | null)?.trim(),
      description:     (formData.get('description') as string | null)?.trim() || null,
      image_url:      (formData.get('image_url') as string | null)?.trim() || null,
      image_path:     (formData.get('image_path') as string | null)?.trim() || null,
      image_alt:      (formData.get('image_alt') as string | null)?.trim() || null,
      hero_image_url: (formData.get('hero_image_url') as string | null)?.trim() || null,
      hero_image_path:(formData.get('hero_image_path') as string | null)?.trim() || null,
      is_active:      formData.get('is_active') !== 'off',
      sort_order:     parseInt((formData.get('sort_order') as string) || '0'),
    });
    await setCollectionProducts(id, parseProductIds(formData));
  } catch (err) {
    redirect(`/admin/collections?edit=${id}&error=${encodeURIComponent(String(err))}`);
  }

  revalidatePath('/admin/collections');
  revalidatePath('/collection');
  revalidatePath(`/collection/${formData.get('slug')}`);
  redirect('/admin/collections?success=updated');
}

export async function actionDeleteCollection(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (id) await deleteCollection(id);
  revalidatePath('/admin/collections');
  revalidatePath('/collection');
  redirect('/admin/collections?success=deleted');
}
