'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <>
        <h1 className="auth-card__title">Liên kết không hợp lệ</h1>
        <p className="auth-card__subtitle">Thiếu mã đặt lại mật khẩu. Vui lòng yêu cầu lại.</p>
        <Link href="/forgot-password" className="auth-submit" style={{ textAlign: 'center', textDecoration: 'none' }}>
          Yêu cầu liên kết mới
        </Link>
        <Link href="/" className="auth-back">Trở lại mua sắm</Link>
      </>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 1800);
    } catch {
      setError('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className="auth-card__title">Đã đổi mật khẩu</h1>
        <p className="auth-message auth-message--success">Đang chuyển đến trang đăng nhập…</p>
        <Link href="/login" className="auth-submit" style={{ textAlign: 'center', textDecoration: 'none' }}>
          Đăng nhập ngay
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-card__title">Đặt lại mật khẩu</h1>
      <p className="auth-card__subtitle">Nhập mật khẩu mới cho tài khoản của bạn.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input" type="password" placeholder="Mật khẩu mới (tối thiểu 8 ký tự)" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        <input
          className="auth-input" type="password" placeholder="Nhập lại mật khẩu" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} required
        />
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
        </button>
      </form>

      <Link href="/" className="auth-back">Trở lại mua sắm</Link>
    </>
  );
}
