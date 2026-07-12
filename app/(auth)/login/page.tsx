'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { GoogleAuthButton } from '../_components/GoogleAuthButton';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [redirectTo, setRedirectTo] = useState('/');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'oauth') {
      setError('Đăng nhập Google chưa hoàn tất. Vui lòng thử lại.');
    }
    // Only accept in-app relative paths (must start with a single "/") to avoid
    // open-redirect to external sites.
    const r = params.get('redirect');
    if (r && r.startsWith('/') && !r.startsWith('//')) setRedirectTo(r);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError || !data.user) {
        setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="auth-card__title">Đăng nhập</h1>

      <GoogleAuthButton label="Continue with Google" />

      <div className="auth-divider">Or</div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input" type="email" placeholder="Email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="auth-input" type="password" placeholder="Mật khẩu" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Tiếp tục'}
        </button>
      </form>

      <div className="auth-links">
        <span>Chưa có tài khoản? <Link href={redirectTo !== '/' ? `/register?redirect=${encodeURIComponent(redirectTo)}` : '/register'} className="auth-link">Đăng ký</Link></span>
        <Link href="/forgot-password" className="auth-link">Quên mật khẩu?</Link>
      </div>

      <Link href="/" className="auth-back">Trở lại mua sắm</Link>
    </>
  );
}
