'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RecaptchaWidget } from '../_components/RecaptchaWidget';

const RECAPTCHA_ENABLED = !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (RECAPTCHA_ENABLED && !captcha) {
      setError('Vui lòng xác nhận bạn không phải robot.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken: captcha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Không thể gửi yêu cầu. Vui lòng thử lại.');
        return;
      }
      setSent(true);
    } catch {
      setError('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <h1 className="auth-card__title">Kiểm tra email</h1>
        <p className="auth-card__subtitle">
          Nếu email tồn tại, chúng mình đã gửi liên kết đặt lại mật khẩu.
          Liên kết <strong>hết hạn sau 5 phút</strong>.
        </p>
        <Link href="/login" className="auth-submit" style={{ textAlign: 'center', textDecoration: 'none' }}>
          Về trang đăng nhập
        </Link>
        <Link href="/" className="auth-back">Trở lại mua sắm</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-card__title">Quên mật khẩu</h1>
      <p className="auth-card__subtitle">Nhập email, chúng mình sẽ gửi liên kết đặt lại mật khẩu.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input" type="email" placeholder="Email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <RecaptchaWidget onChange={setCaptcha} />
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Đang gửi…' : 'Gửi liên kết'}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/login" className="auth-link">Quay lại đăng nhập</Link>
      </div>

      <Link href="/" className="auth-back">Trở lại mua sắm</Link>
    </>
  );
}
