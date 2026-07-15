"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { formatPrice } from "@/lib/demo-products";
import { addItem } from "@/lib/shop/cart-store";
import { gaAddToCart } from "@/lib/analytics/ga";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
  rank?: 1 | 2 | 3;
  compact?: boolean;
  // Controls only the visible "Hết hàng" overlay. Out-of-stock logic
  // (disabled add-to-cart) always applies regardless of this flag.
  showOutOfStockBadge?: boolean;
  isWishlisted?: boolean;
  onWishlistToggle?: (product: Product) => void;
};

const heartOutline = "/assets/ui/heart-outline.png";
const heartLiked = "/assets/ui/heart-liked.png";

export function ProductCard({
  product,
  rank,
  compact = false,
  showOutOfStockBadge = true,
  isWishlisted = false,
  onWishlistToggle,
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const outOfStock = typeof product.stock === "number" && product.stock <= 0;

  const handleHeartClick = useCallback(() => {
    if (onWishlistToggle) {
      onWishlistToggle(product);
    } else {
      if (outOfStock) return;
      addItem(product);
      gaAddToCart(product, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    }
  }, [product, outOfStock, onWishlistToggle]);

  return (
    <div className="product-card-wrap">
      <article
        className={
          compact ? "product-card product-card--compact" : "product-card"
        }
      >
        <Link
          className="product-card__overlay-link"
          href={`/products/${product.slug}`}
          aria-label={`Xem chi tiết ${product.name}`}
          tabIndex={-1}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            cursor: "pointer",
          }}
        />
        {rank ? (
          <Image
            className={`rank-badge rank-badge--top-${rank}`}
            src={`/assets/ui/top-${rank}.png`}
            alt={`Top ${rank}`}
            width={110}
            height={110}
          />
        ) : null}

        <div className="product-media">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes={compact ? "260px" : "(max-width: 768px) 78vw, 300px"}
          />
          {outOfStock && showOutOfStockBadge && (
            <div
              aria-label="Hết hàng"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.65)",
                borderRadius: "inherit",
                zIndex: 2,
                fontFamily: "var(--body-font)",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#c0392b",
                letterSpacing: "0.04em",
                pointerEvents: "none",
              }}
            >
              Hết hàng
            </div>
          )}
        </div>

        <div className="product-actions">
          <button
            type="button"
            className="heart-button"
            onClick={handleHeartClick}
            aria-label={
              onWishlistToggle
                ? isWishlisted
                  ? "Bỏ yêu thích"
                  : "Thêm vào yêu thích"
                : outOfStock
                  ? "Hết hàng"
                  : "Thêm vào giỏ hàng"
            }
            disabled={!onWishlistToggle && outOfStock}
            aria-pressed={onWishlistToggle ? isWishlisted : undefined}
          >
            <Image
              src={
                (onWishlistToggle ? isWishlisted : added)
                  ? heartLiked
                  : heartOutline
              }
              alt=""
              width={44}
              height={44}
            />
          </button>
        </div>
      </article>

      <Link href={`/products/${product.slug}`} style={{ display: "block" }}>
        <div className="product-copy">
          <h3>{product.name}</h3>
          <span>{formatPrice(product.price)}</span>
        </div>
      </Link>
    </div>
  );
}
