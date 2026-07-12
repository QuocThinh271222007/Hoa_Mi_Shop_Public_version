"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/types";

type ProductRailProps = {
  titleImage: string;
  titleAlt: string;
  products: Product[];
  ranked?: boolean;
  homeVariant?: boolean;
  wishlistIds?: Set<string>;
  onWishlistToggle?: (product: Product) => void;
};

const homeRankOrder: Array<1 | 2 | 3> = [3, 1, 2];

// Arrival carousel constants (match CSS values)
const CARD_WIDTH = 260;
const CARD_GAP = 26;
const AUTO_MS = 3000;

function getVisibleCount(): number {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth < 600) return 1;
  if (window.innerWidth < 960) return 2;
  return 3;
}

export function ProductRail({
  titleImage,
  titleAlt,
  products,
  ranked = false,
  homeVariant = false,
  wishlistIds,
  onWishlistToggle,
}: ProductRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const isArrival = titleImage.includes("new-arrival");

  // ── Carousel state (arrival only) ──
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [skipTransition, setSkipTransition] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);

  // Responsive visible count
  useEffect(() => {
    if (!isArrival) return;
    const update = () => setVisibleCount(getVisibleCount());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isArrival]);

  const maxIndex = Math.max(0, products.length - visibleCount);

  const goTo = useCallback(
    (idx: number) => {
      setActiveIndex(Math.max(0, Math.min(idx, maxIndex)));
    },
    [maxIndex],
  );

  const advance = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev >= maxIndex) {
        // Jump back to start without animation, then re-enable
        setSkipTransition(true);
        return 0;
      }
      return prev + 1;
    });
  }, [maxIndex]);

  // Re-enable transition one paint after the instantaneous reset to 0
  useEffect(() => {
    if (!skipTransition) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSkipTransition(false)),
    );
    return () => cancelAnimationFrame(id);
  }, [skipTransition]);

  // Auto-advance interval
  useEffect(() => {
    if (!isArrival || paused || products.length <= visibleCount) return;
    const id = setInterval(advance, AUTO_MS);
    return () => clearInterval(id);
  }, [isArrival, paused, advance, products.length, visibleCount]);

  // ── Bestseller rail — unchanged layout ──
  if (!isArrival) {
    const scrollBy = (direction: "prev" | "next") => {
      railRef.current?.scrollBy({
        left: direction === "next" ? 340 : -340,
        behavior: "smooth",
      });
    };

    return (
      <section className="product-section product-section--bestseller">
        <div className="pink-line" />
        <div className="section-title-wrap">
          <Image
            className="section-title-image"
            src={titleImage}
            alt={titleAlt}
            width={840}
            height={210}
          />
        </div>
        <button
          type="button"
          className="rail-arrow rail-arrow--left"
          onClick={() => scrollBy("prev")}
          aria-label="Sản phẩm trước"
        >
          ◀
        </button>
        <div className="product-rail" ref={railRef}>
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              compact={homeVariant}
              rank={ranked && index < 3 ? homeRankOrder[index] : undefined}
              showOutOfStockBadge={false}
              isWishlisted={wishlistIds?.has(product.id)}
              onWishlistToggle={onWishlistToggle}
            />
          ))}
        </div>
        <button
          type="button"
          className="rail-arrow rail-arrow--right"
          onClick={() => scrollBy("next")}
          aria-label="Sản phẩm sau"
        >
          ▶
        </button>
      </section>
    );
  }

  // ── Arrival carousel ──
  const viewportWidth =
    visibleCount * CARD_WIDTH + (visibleCount - 1) * CARD_GAP;
  const translateX = activeIndex * (CARD_WIDTH + CARD_GAP);

  return (
    <section
      className="product-section product-section--arrival"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="pink-line" />
      <div className="section-title-wrap">
        <Image
          className="section-title-image"
          src={titleImage}
          alt={titleAlt}
          width={840}
          height={210}
        />
      </div>

      <button
        type="button"
        className="rail-arrow rail-arrow--left"
        onClick={() => goTo(activeIndex - 1)}
        aria-label="Sản phẩm trước"
      >
        ◀
      </button>

      {/* Carousel viewport — clips to exactly visibleCount cards */}
      <div
        className="product-rail"
        style={{ width: viewportWidth }}
        aria-live="polite"
        aria-atomic="false"
      >
        <div
          className="product-rail-track"
          style={{
            transform: `translateX(-${translateX}px)`,
            transition: skipTransition
              ? "none"
              : "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              compact={homeVariant}
              rank={ranked && index < 3 ? homeRankOrder[index] : undefined}
              showOutOfStockBadge={false}
              isWishlisted={wishlistIds?.has(product.id)}
              onWishlistToggle={onWishlistToggle}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="rail-arrow rail-arrow--right"
        onClick={() => goTo(activeIndex + 1)}
        aria-label="Sản phẩm sau"
      >
        ▶
      </button>
    </section>
  );
}
