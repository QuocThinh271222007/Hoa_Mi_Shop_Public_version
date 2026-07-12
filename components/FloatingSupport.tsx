'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function FloatingSupport() {
  const [hiddenByFooter, setHiddenByFooter] = useState(false);

  useEffect(() => {
    const footer = document.querySelector('[data-footer]');
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHiddenByFooter(entry.isIntersecting),
      { threshold: 0.15 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <a className={hiddenByFooter ? 'floating-support floating-support--hidden' : 'floating-support'} href="#contact">
      <Image src="/assets/ui/customer-service-avatar.png" alt="Customer service" width={120} height={120} />
      <span>Có cần gì gọi mình đây!</span>
    </a>
  );
}
