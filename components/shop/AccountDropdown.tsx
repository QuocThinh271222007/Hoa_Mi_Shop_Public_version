'use client';

import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

const PANEL_WIDTH = 320;
const DROPDOWN_Z = 2147482500;

interface Props {
  user: User | null;
  triggerRect: DOMRect;
  onClose: () => void;
  onAuthChange: (user: User | null) => void;
}

function computeStyle(rect: DOMRect): CSSProperties {
  if (typeof window === 'undefined') return {};
  const vw = window.innerWidth;
  const isMobile = vw < 480;
  const width = isMobile ? vw - 24 : Math.min(PANEL_WIDTH, vw - 24);
  let left = isMobile ? 12 : rect.right - width;
  if (left < 12) left = 12;
  if (left + width > vw - 12) left = vw - width - 12;
  return {
    position: 'fixed',
    top: rect.bottom + 8,
    left,
    width,
    zIndex: DROPDOWN_Z,
  };
}

function getDisplayName(user: User): string {
  return (
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Tài khoản'
  );
}

export function AccountDropdown({ user, triggerRect, onClose, onAuthChange }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (typeof document === 'undefined') return null;

  const style = computeStyle(triggerRect);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
      if (!url || !key) {
        setError('Supabase chưa được cấu hình.');
        return;
      }
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(url, key);
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
        return;
      }
      if (data.user) {
        onAuthChange(data.user);
        onClose();
      }
    } catch {
      setError('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
      if (!url || !key) return;
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(url, key);
      await supabase.auth.signOut();
    } catch {
      // ignore
    } finally {
      onAuthChange(null);
      onClose();
    }
  }

  return createPortal(
    <div
      className="shop-nav-dropdown shop-account-menu"
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label={user ? 'Thông tin tài khoản' : 'Đăng nhập'}
    >
      {user ? (
        <>
          <h2 className="shop-nav-dropdown__title">Thông Tin Tài Khoản</h2>
          <p className="shop-account-menu__user">{getDisplayName(user)}</p>
          <nav className="shop-account-menu__links">
            <Link href="/profile" className="shop-account-menu__link" onClick={onClose}>
              Tài khoản của tôi
            </Link>
            <Link href="/profile?tab=orders" className="shop-account-menu__link" onClick={onClose}>
              Lịch sử đơn hàng
            </Link>
            <Link href="/profile?tab=addresses" className="shop-account-menu__link" onClick={onClose}>
              Danh sách địa chỉ
            </Link>
            <button type="button" className="shop-account-menu__signout" onClick={handleLogout}>
              Đăng xuất
            </button>
          </nav>
        </>
      ) : (
        <>
          <h2 className="shop-nav-dropdown__title">Đăng Nhập Tài Khoản</h2>
          <div className="shop-auth-panel">
            <p className="shop-auth-panel__subtitle">Vui lòng nhập email và mật khẩu!</p>
            <form onSubmit={handleLogin}>
              <div className="shop-auth-panel__field">
                <input
                  className="shop-auth-panel__input"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="shop-auth-panel__field">
                <input
                  className="shop-auth-panel__input"
                  type="password"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="shop-auth-panel__error">{error}</p>}
              <button type="submit" className="shop-auth-panel__btn" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
            <div className="shop-auth-panel__links">
              <span>
                Khách hàng mới?{' '}
                <Link href="/register" className="shop-auth-panel__link" onClick={onClose}>
                  Tạo tài khoản.
                </Link>
              </span>
              <span>
                Quên mật khẩu?{' '}
                <Link href="/forgot-password" className="shop-auth-panel__link" onClick={onClose}>
                  Khôi phục mật khẩu.
                </Link>
              </span>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
