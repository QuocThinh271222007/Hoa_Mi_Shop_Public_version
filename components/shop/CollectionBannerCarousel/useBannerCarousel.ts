'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PublicBanner } from '@/lib/banners/public-banners';

// Small, isolated carousel state for the /collection banner. Kept in its own
// folder so the banner behavior is easy to find and debug independently.
export function useBannerCarousel(banners: PublicBanner[], autoMs = 5000) {
  const count = banners.length;
  const [index, setIndex] = useState(0);
  const clamped = count > 0 ? index % count : 0;

  const next = useCallback(() => setIndex((i) => (count ? (i + 1) % count : 0)), [count]);
  const prev = useCallback(() => setIndex((i) => (count ? (i - 1 + count) % count : 0)), [count]);
  const goTo = useCallback((i: number) => setIndex(i), []);

  // Auto-advance when there is more than one slide.
  useEffect(() => {
    if (count <= 1 || autoMs <= 0) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), autoMs);
    return () => clearInterval(t);
  }, [count, autoMs]);

  return {
    index: clamped,
    current: count ? banners[clamped] : null,
    next,
    prev,
    goTo,
    count,
  };
}
