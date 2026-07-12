import { demoProducts } from './demo-products';
import { supabase, type Database } from './supabase';
import type { Product } from './types';

type ProductRow = Database['public']['Tables']['products']['Row'];

function mapProductRow(item: ProductRow): Product {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    price: item.price,
    image: item.image_url || '/assets/products/product-01.png',
    description: item.description || '',
    category: item.category || 'Sản phẩm',
    isBestseller: Boolean(item.is_bestseller),
    isNew: Boolean(item.is_new),
    stock: item.stock ?? 0
  };
}

export async function getProducts(): Promise<Product[]> {
  if (!supabase) return demoProducts;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return demoProducts;

  return (data as ProductRow[]).map(mapProductRow);
}

// Fetch a single product by slug. Backend-first with demo fallback so both
// seeded demo slugs and admin-created products resolve on the detail page.
export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!supabase) return demoProducts.find((p) => p.slug === slug) ?? null;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return demoProducts.find((p) => p.slug === slug) ?? null;

  const base = mapProductRow(data as ProductRow);

  // Attach gallery images (product_images) so the detail page can show a
  // multi-image carousel. The card cover (base.image) is always first.
  const { data: imgRows } = await supabase
    .from('product_images')
    .select('url, sort_order')
    .eq('product_id', base.id)
    .order('sort_order', { ascending: true });

  const gallery = ((imgRows ?? []) as { url: string }[])
    .map((r) => r.url)
    .filter((u) => u && u !== base.image);
  const images = [base.image, ...gallery];

  return { ...base, images };
}
