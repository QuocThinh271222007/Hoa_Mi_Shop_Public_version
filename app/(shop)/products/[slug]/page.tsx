import { notFound } from 'next/navigation';
import { demoProducts } from '@/lib/demo-products';
import { getProducts, getProductBySlug } from '@/lib/products';
import { ProductDetailClient } from './ProductDetailClient';
import './product-detail.css';

// Always render with live stock so admin inventory/stock changes (and sell-outs)
// reflect immediately — the "Hết hàng"/add-to-cart state must never be stale.
export const revalidate = 0;

export function generateStaticParams() {
  // Pre-render seeded demo slugs; admin-created products render on demand.
  return demoProducts.map((p) => ({ slug: p.slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  // Backend-first: resolve from DB (falls back to demo products internally).
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const allProducts = await getProducts();
  const suggestions = allProducts.filter((p) => p.slug !== slug).slice(0, 3);

  return <ProductDetailClient product={product} suggestions={suggestions} />;
}
