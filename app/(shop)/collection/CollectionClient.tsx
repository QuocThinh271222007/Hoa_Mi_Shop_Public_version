"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CollectionProductCard } from "./CollectionProductCard";
import { useBannerCarousel } from "@/components/shop/CollectionBannerCarousel/useBannerCarousel";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { getWishlistIds, toggleWishlist } from "@/lib/shop/wishlist-store";
import {
  gaViewItemList,
  gaSelectItem,
  gaViewPromotion,
  gaSelectPromotion,
} from "@/lib/analytics/ga";
import type { Product } from "@/lib/types";
import type { PublicBanner } from "@/lib/banners/public-banners";
import type { PublicCollectionWithProductIds } from "@/lib/shop/collections";

type FilterMode =
  | "all"
  | "wishlist"
  | "in-stock"
  | "out-stock"
  | "newest"
  | "price-asc"
  | "price-desc";

const FILTER_OPTIONS: { label: string; value: FilterMode | string }[] = [
  { label: "Tất cả", value: "all" },
  { label: "Yêu thích", value: "wishlist" },
  { label: "Còn hàng", value: "in-stock" },
  { label: "Hết hàng", value: "out-stock" },
  { label: "Mới nhất", value: "newest" },
  { label: "Giá tăng dần", value: "price-asc" },
  { label: "Giá giảm dần", value: "price-desc" },
];

const COLLECTION_FILTER_PREFIX = "collection:";

type CollectionClientProps = {
  products: Product[];
  banners?: PublicBanner[];
  collections?: PublicCollectionWithProductIds[];
};

export function CollectionClient({
  products,
  banners = [],
  collections = [],
}: CollectionClientProps) {
  const banner = useBannerCarousel(banners);
  // Fall back to the collection listing (always exists) when a banner has no
  // active target collection — avoids a 404 on the "Khám phá" button.
  const currentSlideHref = banner.current?.collectionSlug
    ? `/collection/${banner.current.collectionSlug}`
    : "/collection";
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistMessage, setWishlistMessage] = useState("");

  const filterWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          setUserId(user.id);
          const ids = await getWishlistIds(user.id);
          if (!cancelled) setWishlistIds(new Set(ids));
        }
      } catch {
        // fail silently
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filterOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        filterWrapRef.current &&
        !filterWrapRef.current.contains(e.target as Node)
      ) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [filterOpen]);

  const handleWishlistToggle = useCallback(
    async (product: Product) => {
      if (!userId) {
        setWishlistMessage("Vui lòng đăng nhập để lưu yêu thích.");
        setTimeout(() => setWishlistMessage(""), 3000);
        return;
      }
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (next.has(product.id)) next.delete(product.id);
        else next.add(product.id);
        return next;
      });
      try {
        await toggleWishlist(userId, product.id);
      } catch {
        setWishlistIds((prev) => {
          const next = new Set(prev);
          if (next.has(product.id)) next.delete(product.id);
          else next.add(product.id);
          return next;
        });
      }
    },
    [userId],
  );

  // Map collection slug -> its assigned product ids, so the filter dropdown can
  // match against real admin-created collections (not raw product.category strings).
  const collectionProductIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of collections) {
      map.set(c.slug, new Set(c.productIds));
    }
    return map;
  }, [collections]);

  const allFilterOptions = useMemo(
    () => [
      ...FILTER_OPTIONS,
      ...collections.map((c) => ({
        label: c.name,
        value: `${COLLECTION_FILTER_PREFIX}${c.slug}`,
      })),
    ],
    [collections],
  );

  const filtered = useMemo<Product[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = q
      ? products.filter((p) => {
          const matchName = p.name.toLowerCase().includes(q);
          const matchCat = p.category?.toLowerCase().includes(q) ?? false;
          const matchDesc = p.description?.toLowerCase().includes(q) ?? false;
          return matchName || matchCat || matchDesc;
        })
      : [...products];

    switch (filterMode) {
      case "all":
        break;
      case "wishlist":
        result = result.filter((p) => wishlistIds.has(p.id));
        break;
      case "in-stock":
        result = result.filter((p) => (p.stock ?? 1) > 0);
        break;
      case "out-stock":
        result = result.filter((p) => (p.stock ?? 1) <= 0);
        break;
      case "newest":
        result = [...result].sort(
          (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0),
        );
        break;
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      default:
        if (filterMode.startsWith(COLLECTION_FILTER_PREFIX)) {
          const slug = filterMode.slice(COLLECTION_FILTER_PREFIX.length);
          const ids = collectionProductIds.get(slug);
          result = ids ? result.filter((p) => ids.has(p.id)) : [];
        }
        break;
    }
    return result;
  }, [products, searchQuery, filterMode, wishlistIds, collectionProductIds]);

  const filterLabel =
    allFilterOptions.find((o) => o.value === filterMode)?.label ?? "Phân Loại";

  // GA4 view_item_list — fire when the visible list changes by filter/collection
  // (not on every search keystroke). Cap the payload size.
  useEffect(() => {
    if (filtered.length === 0) return;
    gaViewItemList(filtered.slice(0, 30), `collection_${filterMode}`, filterLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode]);

  // GA4 view_promotion — fire whenever a banner slide becomes visible (banners
  // carry a clear id + name = promotion).
  useEffect(() => {
    if (!banner.current) return;
    gaViewPromotion(
      banner.current.id,
      banner.current.name || "Collection banner",
      "collection_hero",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner.current?.id]);

  const handleSelectPromotion = useCallback(() => {
    if (!banner.current) return;
    gaSelectPromotion(
      banner.current.id,
      banner.current.name || "Collection banner",
      "collection_hero",
    );
  }, [banner]);

  const handleSelectItem = useCallback(
    (product: Product) => {
      const index = filtered.findIndex((p) => p.id === product.id);
      gaSelectItem(
        product,
        `collection_${filterMode}`,
        filterLabel,
        index >= 0 ? index : undefined,
      );
    },
    [filtered, filterMode, filterLabel],
  );

  const showWishlistLogin = filterMode === "wishlist" && !userId;
  const showEmpty = !showWishlistLogin && filtered.length === 0;

  return (
    <main className="collection-page">
      {/* 1. Title strip: arrow | BST title asset | arrow — arrows slide the banner */}
      <div className="collection-page__title-section">
        <button
          type="button"
          className="collection-page__title-arrow collection-page__title-arrow--btn"
          onClick={banner.prev}
          aria-label="Banner trước"
          disabled={banner.count <= 1}
        >
          <Image
            src="/assets/ui/arrow-right.png"
            alt=""
            width={56}
            height={56}
            className="collection-page__title-arrow-img collection-page__title-arrow-img--left"
          />
        </button>

        <div className="collection-page__title-img-wrap">
          <Image
            src="/assets/brand/collection-title.png"
            alt="Bộ Sưu Tập"
            width={5120}
            height={1426}
            className="collection-page__title-img"
            priority
          />
        </div>

        <button
          type="button"
          className="collection-page__title-arrow collection-page__title-arrow--btn"
          onClick={banner.next}
          aria-label="Banner sau"
          disabled={banner.count <= 1}
        >
          <Image
            src="/assets/ui/arrow-right.png"
            alt=""
            width={56}
            height={56}
            className="collection-page__title-arrow-img"
          />
        </button>
      </div>

      {/* 2. Pink hero banner — animated carousel of collection banners */}
      <div className="collection-page__hero-banner">
        {banner.current ? (
          <Link href={currentSlideHref} className="collection-page__hero-slide" aria-label={banner.current.name || "Xem bộ sưu tập"} onClick={handleSelectPromotion}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={banner.current.id}
              src={banner.current.image_url}
              alt={banner.current.alt || banner.current.name || "Bộ sưu tập"}
              className="collection-page__hero-image collection-page__hero-image--fade"
            />
          </Link>
        ) : (
          <p className="collection-page__hero-copy">Ảnh bộ sưu tập</p>
        )}

        {banner.count > 1 && (
          <div className="collection-page__hero-dots" aria-hidden="true">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={`collection-page__hero-dot${i === banner.index ? " collection-page__hero-dot--active" : ""}`}
                onClick={() => banner.goTo(i)}
                aria-label={`Banner ${i + 1}`}
              />
            ))}
          </div>
        )}

        <Link href={currentSlideHref} className="collection-page__hero-button" onClick={handleSelectPromotion}>
          Khám phá Bộ sưu tập →
        </Link>
      </div>
      {/* Inner content */}
      <div className="collection-page__inner">
        {/* 4. Toolbar */}
        <div className="collection-page__toolbar">
          <label
            className="collection-page__search"
            aria-label="Tìm kiếm sản phẩm"
          >
            <svg
              className="collection-page__search-icon"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle
                cx="6.5"
                cy="6.5"
                r="5"
                stroke="#f8a5c5"
                strokeWidth="1.6"
              />
              <path
                d="M10.5 10.5L14 14"
                stroke="#f8a5c5"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="collection-page__search-input"
              type="search"
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <div className="collection-page__filter-wrap" ref={filterWrapRef}>
            <button
              type="button"
              className={
                filterOpen
                  ? "collection-page__filter collection-page__filter--active"
                  : "collection-page__filter"
              }
              onClick={() => setFilterOpen((prev) => !prev)}
              aria-expanded={filterOpen}
              aria-haspopup="listbox"
            >
              {filterLabel}
              <span
                className="collection-page__filter-chevron"
                aria-hidden="true"
              >
                ▼
              </span>
            </button>

            {filterOpen && (
              <div className="collection-page__filter-dropdown" role="listbox">
                {allFilterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={filterMode === opt.value}
                    className={
                      filterMode === opt.value
                        ? "collection-page__filter-option collection-page__filter-option--active"
                        : "collection-page__filter-option"
                    }
                    onClick={() => {
                      setFilterMode(opt.value);
                      setFilterOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Wishlist toast */}
        {wishlistMessage && (
          <div className="collection-page__wishlist-msg" role="alert">
            {wishlistMessage}
          </div>
        )}

        {/* 5. Product grid — all shop products */}
        <div className="collection-page__grid">
          {showWishlistLogin ? (
            <div className="collection-page__empty">
              <p className="collection-page__empty-text">
                Vui lòng đăng nhập để xem sản phẩm yêu thích.
              </p>
            </div>
          ) : showEmpty ? (
            <div className="collection-page__empty">
              <p className="collection-page__empty-text">
                Không tìm thấy sản phẩm phù hợp.
              </p>
            </div>
          ) : (
            filtered.map((product) => (
              <CollectionProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlistIds.has(product.id)}
                onWishlistToggle={handleWishlistToggle}
                onSelect={handleSelectItem}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}
