'use client';

import { useEffect, useRef } from 'react';

type Grecaptcha = {
  render: (
    el: HTMLElement,
    opts: { sitekey: string; callback: (t: string) => void; 'expired-callback'?: () => void }
  ) => number;
  reset: (id?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const SCRIPT_ID = 'recaptcha-explicit-script';

/**
 * Google reCAPTCHA v2 checkbox. Renders nothing (and never blocks) when
 * NEXT_PUBLIC_RECAPTCHA_SITE_KEY is unset, so dev works without keys.
 * Reports the solved token (or '' on expiry) via onChange.
 */
export function RecaptchaWidget({ onChange }: { onChange: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    const tryRender = () => {
      if (cancelled || !ref.current || widgetId.current !== null) return true;
      if (!window.grecaptcha?.render) return false;
      widgetId.current = window.grecaptcha.render(ref.current, {
        sitekey: siteKey,
        callback: (t) => cb.current(t),
        'expired-callback': () => cb.current(''),
      });
      return true;
    };

    if (tryRender()) return;

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    const iv = setInterval(() => {
      if (tryRender()) clearInterval(iv);
    }, 300);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="auth-recaptcha" />;
}
