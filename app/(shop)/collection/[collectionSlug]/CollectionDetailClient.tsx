"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CollectionProductCard } from "../CollectionProductCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { getWishlistIds, toggleWishlist } from "@/lib/shop/wishlist-store";
import type { Product } from "@/lib/types";

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

type CollectionGroup = {
  slug: string;
  name: string;
  description: string;
};

type Props = {
  group: CollectionGroup;
  products: Product[];
};

export function CollectionDetailClient({ group, products }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistMessage, setWishlistMessage] = useState("");

  const filterWrapRef = useRef<HTMLDivElement>(null);

  // Load auth + wishlist on mount
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

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [filterOpen]);

  // Wishlist toggle handler
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

  // Unique categories from products
  const categories = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of products) {
      if (p.category && !seen.has(p.category)) {
        seen.add(p.category);
        result.push(p.category);
      }
    }
    return result;
  }, [products]);

  const allFilterOptions = useMemo(
    () => [
      ...FILTER_OPTIONS,
      ...categories.map((cat) => ({ label: cat, value: cat })),
    ],
    [categories],
  );

  // Filter pipeline: search → filterMode (within BST products)
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
        result = [...result].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      default:
        result = result.filter((p) => p.category === filterMode);
        break;
    }

    return result;
  }, [products, searchQuery, filterMode, wishlistIds]);

  const filterLabel =
    allFilterOptions.find((o) => o.value === filterMode)?.label ?? "Phân Loại";

  const showWishlistLogin = filterMode === "wishlist" && !userId;
  const showEmpty = !showWishlistLogin && filtered.length === 0;
  const noBstProducts = products.length === 0;

  return (
    <main className="collection-page collection-page--detail">
      {/* Title */}
      <div className="collection-page__title-section">
        <h1 className="collection-page__title">{group.name}</h1>
      </div>

      {/* Inner content */}
      <div className="collection-page__inner">
        {/* Back link */}
        <div className="collection-page__detail-back">
          <Link href="/collection" className="collection-page__reset">
            ← Tất cả bộ sưu tập
          </Link>
        </div>

        {/* Toolbar */}
        <div className="collection-page__toolbar">
          <label className="collection-page__search" aria-label="Tìm kiếm sản phẩm">
            <svg
              className="collection-page__search-icon"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle cx="6.5" cy="6.5" r="5" stroke="#f8a5c5" strokeWidth="1.6" />
              <path d="M10.5 10.5L14 14" stroke="#f8a5c5" strokeWidth="1.6" strokeLinecap="round" />
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
              <span className="collection-page__filter-chevron" aria-hidden="true">▼</span>
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

        {/* Product grid — only this BST's products */}
        <div className="collection-page__grid">
          {noBstProducts ? (
            <div className="collection-page__empty">
              <p className="collection-page__empty-text">
                Chưa có sản phẩm trong bộ sưu tập này.
              </p>
            </div>
          ) : showWishlistLogin ? (
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
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}
