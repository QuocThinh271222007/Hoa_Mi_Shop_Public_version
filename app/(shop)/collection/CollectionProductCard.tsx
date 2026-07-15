'use client';

import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/demo-products';
import type { Product } from '@/lib/types';

const heartOutline = '/assets/ui/heart-outline.png';
const heartLiked = '/assets/ui/heart-liked.png';

type CollectionProductCardProps = {
  product: Product;
  isWishlisted: boolean;
  onWishlistToggle: (product: Product) => void;
  onSelect?: (product: Product) => void;
};

export function CollectionProductCard({
  product,
  isWishlisted,
  onWishlistToggle,
  onSelect,
}: CollectionProductCardProps) {
  const outOfStock = (product.stock ?? 1) <= 0;
  const isNew = product.isNew === true;

  return (
    <div className="collection-page__card-wrap">
      <article className="collection-page__card">
        {/* Full-card link (image area) */}
        <Link
          href={`/products/${product.slug}`}
          aria-label={`Xem chi tiết ${product.name}`}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          onClick={() => onSelect?.(product)}
        />

        <div className="collection-page__card-media">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 380px) 90vw, (max-width: 640px) 48vw, (max-width: 1024px) 30vw, 22vw"
          />
        </div>

        {/* Badges — bottom-left stack */}
        <div className="collection-page__card-badges">
          {isNew && (
            <span className="collection-page__card-badge collection-page__card-badge--new">
              NEW DROP
            </span>
          )}
          {outOfStock && (
            <span className="collection-page__card-badge collection-page__card-badge--sold-out" aria-label="Hết hàng">
              Hết Hàng
            </span>
          )}
        </div>

        {/* Heart = wishlist */}
        <button
          type="button"
          className="collection-page__card-heart"
          onClick={() => onWishlistToggle(product)}
          aria-label={isWishlisted ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          aria-pressed={isWishlisted}
        >
          <Image
            src={isWishlisted ? heartLiked : heartOutline}
            alt=""
            width={36}
            height={36}
          />
        </button>
      </article>

      <Link href={`/products/${product.slug}`} style={{ display: 'block' }} onClick={() => onSelect?.(product)}>
        <div className="collection-page__card-copy">
          <h3 className="collection-page__card-name" title={product.name}>
            {product.name}
          </h3>
          <span className="collection-page__card-price">{formatPrice(product.price)}</span>
        </div>
      </Link>
    </div>
  );
}
