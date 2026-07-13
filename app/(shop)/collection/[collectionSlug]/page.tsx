import { notFound } from "next/navigation";
import { getProducts } from "@/lib/products";
import {
  getPublicCollectionBySlug,
  getCollectionProducts,
  FALLBACK_COLLECTIONS,
} from "@/lib/shop/collections";
import { CollectionDetailClient } from "./CollectionDetailClient";
import "../collection.css";

// Live stock/availability on the listing.
export const revalidate = 0;

type Props = {
  params: Promise<{ collectionSlug: string }>;
};

export default async function CollectionDetailPage({ params }: Props) {
  const { collectionSlug } = await params;

  // Backend-first: resolve the collection (falls back to legacy hardcoded groups).
  const collection = await getPublicCollectionBySlug(collectionSlug);
  if (!collection) notFound();

  const allProducts = await getProducts();
  const products = await getCollectionProducts(collectionSlug, allProducts);

  const group = {
    slug: collection.slug,
    name: collection.name,
    description: collection.description,
  };

  return <CollectionDetailClient group={group} products={products} />;
}

export function generateStaticParams() {
  // Pre-render the legacy slugs; backend-only collections render on demand.
  return FALLBACK_COLLECTIONS.map((g) => ({ collectionSlug: g.slug }));
}
