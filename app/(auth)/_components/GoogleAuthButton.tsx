'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 8.1 29.3 6 24 6 12.9 6 4 14.9 4 26s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 8.1 29.3 6 24 6 16.3 6 9.7 10.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 46c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 41.6 16.2 46 24 46z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41 36 44 31 44 26c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>
  );
}

export function GoogleAuthButton({ label = 'Continue with Google', next = '/' }: { label?: string; next?: string }) {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Always use the live origin so the callback protocol matches the running
      // server (http on localhost, https in prod). Using a hard-coded https
      // NEXT_PUBLIC_SITE_URL against an http dev server triggers
      // SSL_ERROR_RX_RECORD_TOO_LONG.
      const base = window.location.origin.replace(/\/$/, '');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setLoading(false); // redirect happens on success; only reset on error
    } catch {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="auth-oauth-btn" onClick={signIn} disabled={loading}>
      <GoogleIcon />
      <span>{loading ? 'Đang chuyển hướng…' : label}</span>
    </button>
  );
}
