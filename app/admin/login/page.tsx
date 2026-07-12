'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError('Đăng nhập thành công nhưng không nhận được thông tin người dùng.');
      setLoading(false);
      return;
    }

    console.info('Admin login success', { userId: data.user.id, email: data.user.email });

    router.replace('/admin');
    router.refresh();
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <h1 className="admin-login__title">Cúc Họa Mi</h1>
        <p className="admin-login__subtitle">Admin — đăng nhập để tiếp tục</p>

        <form onSubmit={handleSubmit}>
          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="admin-login__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
            />
          </div>

          <div className="admin-login__field">
            <label className="admin-login__label" htmlFor="password">
              Mật khẩu
            </label>
            <input
              id="password"
              className="admin-login__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="admin-login__btn" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          {error && <p className="admin-login__error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
