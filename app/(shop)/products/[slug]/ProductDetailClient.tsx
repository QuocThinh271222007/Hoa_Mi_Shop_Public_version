"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { addItem } from "@/lib/shop/cart-store";
import { isWishlisted, toggleWishlist } from "@/lib/shop/wishlist-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { formatPrice } from "@/lib/demo-products";
import { gaViewItem, gaAddToCart, gaSelectItem } from "@/lib/analytics/ga";
import type { Product } from "@/lib/types";

const HEART_OUTLINE = "/assets/ui/heart-outline.png";
const HEART_LIKED = "/assets/ui/heart-liked.png";

type Props = {
  product: Product;
  suggestions: Product[];
};

function SuggestionCard({ s }: { s: Product }) {
  const [added, setAdded] = useState(false);

  const handleAdd = useCallback(() => {
    addItem(s, 1);
    gaSelectItem(s, "product_suggestions", "Gợi ý sản phẩm");
    gaAddToCart(s, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }, [s]);

  return (
    <div className="product-detail-page__suggestion-card">
      <div className="product-detail-page__suggestion-image-frame">
        <Link
          className="product-detail-page__suggestion-img-link"
          href={`/products/${s.slug}`}
          aria-label={s.name}
        >
          <Image
            src={s.image}
            alt={s.name}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            style={{ objectFit: "cover" }}
          />
        </Link>
        <button
          type="button"
          className="product-detail-page__suggestion-heart"
          onClick={handleAdd}
          aria-label={`Thêm ${s.name} vào giỏ`}
        >
          <Image
            src={added ? HEART_LIKED : HEART_OUTLINE}
            alt=""
            width={36}
            height={36}
          />
        </button>
      </div>
      <div className="product-detail-page__suggestion-meta">
        <Link
          className="product-detail-page__suggestion-name"
          href={`/products/${s.slug}`}
        >
          {s.name}
        </Link>
        <span className="product-detail-page__suggestion-price">
          {formatPrice(s.price)}
        </span>
      </div>
    </div>
  );
}

export function ProductDetailClient({ product, suggestions }: Props) {
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const [added, setAdded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  // Gallery images: use the multi-image list when present, else the single image.
  const images =
    product.images && product.images.length > 0
      ? product.images
      : [product.image];

  // Swipeable gallery: the frame is a horizontal scroll-snap track, so on mobile
  // users can swipe between photos instead of having to tap the dots. The dots
  // stay as an indicator and still jump to a slide.
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.min(Math.max(idx, 0), images.length - 1);
    setActiveImage((prev) => (prev === clamped ? prev : clamped));
  }, [images.length]);

  const goToImage = useCallback((i: number) => {
    setActiveImage(i);
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  // Stock ceiling: a numeric stock is a hard limit (0 = out of stock); an unknown
  // stock is treated as unlimited so legacy items still work.
  const maxQty = typeof product.stock === "number" ? product.stock : Infinity;
  const outOfStock = maxQty <= 0;
  const atMax = qty >= maxQty;

  // GA4 view_item — once per product view.
  useEffect(() => {
    gaViewItem(product);
  }, [product]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        isWishlisted(uid, product.id).then(setLiked);
      }
    });
  }, [product.id]);

  const handleAddToCart = useCallback(() => {
    if (outOfStock) return;
    const q = Math.min(qty, maxQty);
    addItem(product, q);
    gaAddToCart(product, q);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }, [product, qty, outOfStock, maxQty]);

  const handleToggleWishlist = useCallback(async () => {
    if (!userId || wishlistLoading) return;
    setWishlistLoading(true);
    try {
      const next = await toggleWishlist(userId, product.id);
      setLiked(next);
    } finally {
      setWishlistLoading(false);
    }
  }, [userId, product.id, wishlistLoading]);

  return (
    <main className="product-detail-page">
      <div className="product-detail-page__inner">
        {/* ── Hero ── */}
        <div className="product-detail-page__hero">
          {/* Left: gallery */}
          <div className="product-detail-page__gallery">
            <div
              className="product-detail-page__image-frame"
              ref={trackRef}
              onScroll={handleTrackScroll}
              role={images.length > 1 ? "region" : undefined}
              aria-label={images.length > 1 ? "Ảnh sản phẩm — vuốt để xem thêm" : undefined}
            >
              {images.map((src, i) => (
                <div className="product-detail-page__slide" key={i}>
                  <Image
                    src={src}
                    alt={
                      images.length > 1
                        ? `${product.name} — ảnh ${i + 1}/${images.length}`
                        : product.name
                    }
                    fill
                    sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 54vw"
                    style={{ objectFit: "cover" }}
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <div className="product-detail-page__dots">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`product-detail-page__dot${i === activeImage ? " product-detail-page__dot--active" : ""}`}
                    onClick={() => goToImage(i)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    aria-current={i === activeImage}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: product info */}
          <div className="product-detail-page__info">
            <div className="product-detail-page__title-row">
              <h1 className="product-detail-page__title">{product.name}</h1>
              <button
                type="button"
                className="product-detail-page__favorite"
                onClick={handleToggleWishlist}
                aria-label={
                  !userId
                    ? "Đăng nhập để thêm vào yêu thích"
                    : liked
                      ? "Bỏ yêu thích"
                      : "Thêm vào yêu thích"
                }
                disabled={wishlistLoading}
                title={
                  !userId ? "Đăng nhập để lưu sản phẩm yêu thích" : undefined
                }
              >
                <Image
                  src={liked ? HEART_LIKED : HEART_OUTLINE}
                  alt=""
                  width={36}
                  height={36}
                />
              </button>
            </div>

            <p className="product-detail-page__price">
              {formatPrice(product.price)}
            </p>

            <p className="product-detail-page__summary">
              {product.description}
            </p>

            <p className="product-detail-page__quantity-label">Số lượng</p>
            <div className="product-detail-page__quantity">
              <button
                type="button"
                className="product-detail-page__quantity-button"
                onClick={() => setQty((q) => Math.min(q + 1, maxQty))}
                disabled={outOfStock || atMax}
                aria-label="Tăng số lượng"
              >
                +
              </button>
              <span
                className="product-detail-page__quantity-value"
                aria-live="polite"
              >
                {qty}
              </span>
              <button
                type="button"
                className="product-detail-page__quantity-button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={outOfStock}
                aria-label="Giảm số lượng"
              >
                −
              </button>
            </div>

            <button
              type="button"
              className="product-detail-page__add-button"
              onClick={handleAddToCart}
              disabled={outOfStock}
            >
              {outOfStock
                ? "Hết hàng"
                : added
                  ? "Đã thêm vào giỏ"
                  : "Thêm Vào Giỏ"}
            </button>
          </div>
        </div>

        {/* ── Description ── */}
        <section className="product-detail-page__description">
          <h2 className="product-detail-page__description-title">
            Mô Tả Sản Phẩm
          </h2>
          <div className="product-detail-page__description-box">
            {product.description}
          </div>
        </section>

        {/* ── Suggestions ── */}
        {suggestions.length > 0 && (
          <section className="product-detail-page__suggestions">
            <h2 className="product-detail-page__suggestions-title">
              Suggestions
            </h2>
            <div className="product-detail-page__suggestion-grid">
              {suggestions.map((s) => (
                <SuggestionCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
