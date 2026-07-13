'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { createProduct, updateProduct, toggleProductField, deleteProduct } from '@/lib/admin/products-data';
import { setProductImages } from '@/lib/admin/product-images';

// Product images/data appear on several customer-facing surfaces that are
// statically generated (SSG). After a create/update we must revalidate all of
// them, otherwise the new image keeps serving stale prerendered HTML.
function revalidateProductSurfaces(slug?: string | null) {
  revalidatePath('/admin/products');
  // All product detail pages (covers both the current and a previous slug).
  revalidatePath('/products/[slug]', 'page');
  if (slug) revalidatePath(`/products/${slug}`);
  // Listing surfaces that render product cards with images.
  revalidatePath('/collection', 'page');
  revalidatePath('/collection/[collectionSlug]', 'page');
  revalidatePath('/'); // homepage rails
}

// Parse the gallery_json hidden field from the product form into a clean list.
function parseGallery(formData: FormData): { url: string; path?: string | null; alt?: string | null }[] {
  const raw = formData.get('gallery_json');
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.url === 'string' && x.url.trim())
      .map((x) => ({ url: x.url, path: x.path ?? null, alt: x.alt ?? null }));
  } catch {
    return [];
  }
}

export async function actionCreateProduct(formData: FormData) {
  await requireAdmin();

  const name = (formData.get('name') as string | null)?.trim();
  const slug = (formData.get('slug') as string | null)?.trim();
  const priceStr = formData.get('price') as string | null;
  if (!name || !slug || !priceStr) {
    redirect('/admin/products?new=1&error=required');
  }

  try {
    const productId = await createProduct({
      name,
      slug,
      price: parseInt(priceStr),
      image_url:           (formData.get('image_url') as string | null)?.trim() || null,
      image_path:          (formData.get('image_path') as string | null)?.trim() || null,
      image_alt:           (formData.get('image_alt') as string | null)?.trim() || null,
      description:         (formData.get('description') as string | null)?.trim() || null,
      category:            (formData.get('category') as string | null)?.trim() || 'Dây áo',
      stock:               parseInt(formData.get('stock') as string || '0'),
      low_stock_threshold: parseInt(formData.get('low_stock_threshold') as string || '3'),
      sku:                 (formData.get('sku') as string | null)?.trim() || null,
      is_bestseller:       formData.get('is_bestseller') === 'on',
      is_new:              formData.get('is_new') === 'on',
      is_active:           formData.get('is_active') !== 'off',
    });
    if (productId) await setProductImages(productId, parseGallery(formData));
  } catch (err) {
    redirect(`/admin/products?new=1&error=${encodeURIComponent(String(err))}`);
  }

  revalidateProductSurfaces(slug);
  redirect('/admin/products?success=created');
}

export async function actionUpdateProduct(formData: FormData) {
  await requireAdmin();

  const id = formData.get('id') as string | null;
  if (!id) redirect('/admin/products');
  const slug = (formData.get('slug') as string | null)?.trim();

  try {
    await updateProduct(id, {
      name:                (formData.get('name') as string | null)?.trim(),
      slug:                slug,
      price:               parseInt(formData.get('price') as string || '0'),
      image_url:           (formData.get('image_url') as string | null)?.trim() || null,
      image_path:          (formData.get('image_path') as string | null)?.trim() || null,
      image_alt:           (formData.get('image_alt') as string | null)?.trim() || null,
      description:         (formData.get('description') as string | null)?.trim() || null,
      category:            (formData.get('category') as string | null)?.trim() || 'Dây áo',
      // NOTE: `stock` is intentionally NOT written here. Stock is owned solely by the
      // Inventory page (adjustStock → products.stock + inventory_movements log). Writing
      // it from this form would overwrite inventory adjustments with a stale field value
      // and leave no audit trail. See lib/admin/inventory-data.ts.
      low_stock_threshold: parseInt(formData.get('low_stock_threshold') as string || '3'),
      sku:                 (formData.get('sku') as string | null)?.trim() || null,
      is_bestseller:       formData.get('is_bestseller') === 'on',
      is_new:              formData.get('is_new') === 'on',
      is_active:           formData.get('is_active') !== 'off',
    });
    await setProductImages(id, parseGallery(formData));
  } catch (err) {
    redirect(`/admin/products?edit=${id}&error=${encodeURIComponent(String(err))}`);
  }

  revalidateProductSurfaces(slug);
  redirect('/admin/products?success=updated');
}

export async function actionDeleteProduct(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string | null;
  if (!id) redirect('/admin/products');

  try {
    await deleteProduct(id);
  } catch (err) {
    const raw = String(err);
    // FK violation → product is still referenced by existing orders.
    const msg = /foreign key|violates|constraint|referenced|still referenced/i.test(raw)
      ? 'Không thể xóa: sản phẩm đã nằm trong đơn hàng. Hãy tắt hiển thị (Active OFF) thay vì xóa.'
      : 'Không thể xóa sản phẩm. Vui lòng thử lại.';
    redirect(`/admin/products?error=${encodeURIComponent(msg)}`);
  }

  revalidateProductSurfaces();
  redirect('/admin/products?success=deleted');
}

export async function actionToggleProductActive(formData: FormData) {
  await requireAdmin();
  const id    = formData.get('id') as string;
  const value = formData.get('value') === 'true';
  await toggleProductField(id, 'is_active', value);
  // Visibility change affects every listing surface, not just the admin table.
  revalidateProductSurfaces();
}
