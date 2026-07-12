"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ProductRail } from "./ProductRail";
import { FloatingSupport } from "./FloatingSupport";
import { SectionGuide } from "./debug/SectionGuide";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { getWishlistIds, toggleWishlist } from "@/lib/shop/wishlist-store";
import type { Product } from "@/lib/types";

const introMessage =
  "Ú òa...😉 Đã đến lúc tạm biệt những giây phút ngại ngùng giấu giếm chiếc dây áo rồi đấy! Hãy để Họa Mi giúp nàng biến tấu mọi outfit, tự tin khoe trọn cá tính bất chấp mọi ánh nhìn nhé ✨";

export function HomePage({ products }: { products: Product[] }) {
  const bestsellers = products
    .filter((product) => product.isBestseller)
    .slice(0, 3);
  const arrivals = products.filter((product) => product.isNew);

  const [userId, setUserId] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistMessage, setWishlistMessage] = useState("");

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
      } catch {}
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <main className="home-page">
      <SectionGuide name="landing">
        <section
          className="landing-page-section"
          aria-label="Cuc Hoa Mi landing page"
        >
          <div className="hero" />

          <div className="slogan-bar" aria-label="Slogan">
            <div className="slogan-track">
              {Array.from({ length: 12 }).map((_, index) => (
                <span key={index}>
                  Vai xinh, vibe tự tin{" "}
                  <Image
                    src="/assets/ui/heart-liked.png"
                    alt=""
                    width={34}
                    height={34}
                  />
                </span>
              ))}
            </div>
          </div>
        </section>
      </SectionGuide>

      <SectionGuide name="intro">
        <section className="intro-panel" aria-label="Lời chào Cúc Họa Mi">
          <Image
            className="intro-mascot"
            src="/assets/brand/mascot-full-body.png"
            alt="Mascot Cúc Họa Mi"
            width={330}
            height={330}
            priority
          />
          <div className="intro-copy">
            <Image
              src="/assets/brand/opening.png"
              alt="Cúc cu Cúc cu"
              width={420}
              height={237}
            />
            <div className="intro-message" aria-label="Thông điệp Cúc Họa Mi">
              {introMessage}
            </div>
          </div>
        </section>
      </SectionGuide>

      {wishlistMessage && (
        <div
          className="collection-page__wishlist-msg"
          role="alert"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
        >
          {wishlistMessage}
        </div>
      )}

      <SectionGuide name="bestseller-rail">
        <ProductRail
          titleImage="/assets/brand/bestseller-title.png"
          titleAlt="Hoa Khôi Của Tuần"
          products={bestsellers.length ? bestsellers : products.slice(0, 3)}
          ranked
          homeVariant
          wishlistIds={wishlistIds}
          onWishlistToggle={handleWishlistToggle}
        />
      </SectionGuide>

      <SectionGuide name="arrival-rail">
        <ProductRail
          titleImage="/assets/brand/new-arrival-title.png"
          titleAlt="Hoa Mới Nhú"
          products={arrivals.length ? arrivals : products}
          homeVariant
          wishlistIds={wishlistIds}
          onWishlistToggle={handleWishlistToggle}
        />
      </SectionGuide>

      <FloatingSupport />
    </main>
  );
}
