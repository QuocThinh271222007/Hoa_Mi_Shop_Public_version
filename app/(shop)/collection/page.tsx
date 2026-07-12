import { getProducts } from '@/lib/products';
import { getPublicBanners } from '@/lib/banners/public-banners';
import { getPublicCollectionsWithProductIds } from '@/lib/shop/collections';
import { CollectionClient } from './CollectionClient';
import './collection.css';

export default async function CollectionPage() {
  const [products, banners] = await Promise.all([
    getProducts(),
    getPublicBanners(),
  ]);
  const collections = await getPublicCollectionsWithProductIds(products);
  return (
    <CollectionClient products={products} banners={banners} collections={collections} />
  );
}
