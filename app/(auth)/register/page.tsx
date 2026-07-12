'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { GoogleAuthButton } from '../_components/GoogleAuthButton';
import { RecaptchaWidget } from '../_components/RecaptchaWidget';

const RECAPTCHA_ENABLED = !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirectTo, setRedirectTo] = useState('/');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const r = new URLSearchParams(window.location.search).get('redirect');
    if (r && r.startsWith('/') && !r.startsWith('//')) setRedirectTo(r);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (RECAPTCHA_ENABLED && !captcha) {
      setError('Vui lòng xác nhận bạn không phải robot.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, recaptchaToken: captcha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Không thể tạo tài khoản. Vui lòng thử lại.');
        return;
      }
      // Auto sign-in with the just-created credentials.
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
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
      <h1 className="auth-card__title">Tạo tài khoản</h1>

      <GoogleAuthButton label="Continue with Google" />

      <div className="auth-divider">Or</div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input" type="text" placeholder="Họ và tên" autoComplete="name"
          value={fullName} onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="auth-input" type="email" placeholder="Email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="auth-input" type="password" placeholder="Mật khẩu (tối thiểu 8 ký tự)" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        <RecaptchaWidget onChange={setCaptcha} />
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Đang tạo…' : 'Tiếp tục'}
        </button>
      </form>

      <div className="auth-links">
        <span>Đã có tài khoản? <Link href={redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'} className="auth-link">Đăng nhập</Link></span>
      </div>

      <Link href="/" className="auth-back">Trở lại mua sắm</Link>
    </>
  );
}
