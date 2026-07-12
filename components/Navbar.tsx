'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { CartItem } from '@/lib/types';
import { readCart, removeItem, updateQuantity, CART_EVENT } from '@/lib/shop/cart-store';
import { CartPreviewDropdown } from '@/components/shop/CartPreviewDropdown';
import { AccountDropdown } from '@/components/shop/AccountDropdown';
import '@/components/shop/shop-navbar.css';

const navItems = [
  { href: '/', label: 'Trang Chủ' },
  { href: '/collection', label: 'Bộ Sưu Tập' },
  { href: '/about-us', label: 'Về Chúng Mình' },
  { href: '/blog', label: 'Blogs' },
  { href: '/feedback', label: 'Feedback' },
  { href: '#contact', label: 'Liên Hệ' },
];

type OpenDropdown = 'cart' | 'account' | null;

export function Navbar() {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Customer auth state
  const [user, setUser] = useState<User | null>(null);

  // Which dropdown is open + the rect of its trigger at click time
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [cartTriggerRect, setCartTriggerRect] = useState<DOMRect | null>(null);
  const [accountTriggerRect, setAccountTriggerRect] = useState<DOMRect | null>(null);

  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);

  // ── Load cart on mount ──
  useEffect(() => {
    setCartItems(readCart());
  }, []);

  // ── Stay in sync when cart changes (from CartClient or another tab) ──
  useEffect(() => {
    const handleCartUpdate = () => setCartItems(readCart());
    window.addEventListener(CART_EVENT, handleCartUpdate);
    return () => window.removeEventListener(CART_EVENT, handleCartUpdate);
  }, []);

  // ── Customer auth session ──
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) return;

    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(url, key);

        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch {
        // Supabase not configured — stay logged out
      }
    })();

    return () => unsubscribe?.();
  }, []);

  // ── Escape key + outside-click to close dropdowns ──
  useEffect(() => {
    if (!openDropdown) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Let trigger buttons handle their own toggle
      if (cartBtnRef.current?.contains(target) || accountBtnRef.current?.contains(target)) return;
      // Don't close when clicking inside a portal dropdown
      const panels = document.querySelectorAll('.shop-nav-dropdown');
      for (const panel of panels) {
        if (panel.contains(target)) return;
      }
      setOpenDropdown(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [openDropdown]);

  // ── Dropdown toggles ──
  const toggleCart = useCallback(() => {
    if (openDropdown === 'cart') {
      setOpenDropdown(null);
    } else {
      const rect = cartBtnRef.current?.getBoundingClientRect() ?? null;
      setCartTriggerRect(rect);
      setOpenDropdown('cart');
    }
  }, [openDropdown]);

  const toggleAccount = useCallback(() => {
    if (openDropdown === 'account') {
      setOpenDropdown(null);
    } else {
      const rect = accountBtnRef.current?.getBoundingClientRect() ?? null;
      setAccountTriggerRect(rect);
      setOpenDropdown('account');
    }
  }, [openDropdown]);

  // ── Cart mutations ──
  const handleRemoveItem = useCallback((id: string) => {
    setCartItems(removeItem(id));
  }, []);

  const handleUpdateQty = useCallback((id: string, qty: number) => {
    setCartItems(updateQuantity(id, qty));
  }, []);

  // ── Auth change callback ──
  const handleAuthChange = useCallback((newUser: User | null) => {
    setUser(newUser);
  }, []);

  // ── Derived ──
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  return (
    <>
      <header className="site-header">
        <Link className="nav-logo" href="/" aria-label="Cúc Họa Mi home">
          <Image src="/assets/brand/logo.png" alt="Cúc Họa Mi" width={88} height={88} priority />
        </Link>

        <button
          className="nav-toggle"
          type="button"
          aria-label="Mở menu"
          onClick={() => setNavOpen(!navOpen)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={navOpen ? 'nav-menu nav-menu--open' : 'nav-menu'}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={pathname === item.href ? 'nav-link nav-link--active' : 'nav-link'}
              href={item.href}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {/* Account + cart — mobile only (desktop uses the icons in nav-actions) */}
          <Link
            className="nav-link nav-link--mobile-only"
            href={user ? '/profile' : '/login'}
            onClick={() => setNavOpen(false)}
          >
            {user ? `👤 ${displayName || 'Tài khoản của tôi'}` : '👤 Đăng nhập / Đăng ký'}
          </Link>
          <Link
            className="nav-link nav-link--mobile-only"
            href="/cart"
            onClick={() => setNavOpen(false)}
          >
            🛒 Giỏ hàng{cartCount > 0 ? ` (${cartCount})` : ''}
          </Link>
        </nav>

        <div className="nav-actions">
          <button
            ref={accountBtnRef}
            type="button"
            className="icon-link icon-link--labeled"
            aria-label={user ? 'Tài khoản' : 'Đăng nhập / Đăng ký'}
            aria-expanded={openDropdown === 'account'}
            aria-controls="shop-account-dropdown"
            onClick={toggleAccount}
          >
            <Image src="/assets/ui/profile-icon.png" alt="" width={64} height={64} aria-hidden="true" />
            <span>{user ? displayName : 'Đăng Nhập/Đăng Ký'}</span>
          </button>

          <button
            ref={cartBtnRef}
            type="button"
            className="icon-link icon-link--labeled"
            aria-label={`Giỏ hàng${cartCount > 0 ? `, ${cartCount} sản phẩm` : ''}`}
            aria-expanded={openDropdown === 'cart'}
            aria-controls="shop-cart-dropdown"
            onClick={toggleCart}
          >
            <span className="shop-cart-btn__icon-wrap">
              <Image src="/assets/ui/cart-icon.png" alt="" width={64} height={64} aria-hidden="true" />
              {cartCount > 0 && (
                <span className="shop-cart-btn__badge" aria-hidden="true">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            <span>Giỏ Hàng</span>
          </button>
        </div>
      </header>

      {openDropdown === 'cart' && cartTriggerRect && (
        <CartPreviewDropdown
          items={cartItems}
          triggerRect={cartTriggerRect}
          onClose={() => setOpenDropdown(null)}
          onRemove={handleRemoveItem}
          onUpdateQty={handleUpdateQty}
        />
      )}

      {openDropdown === 'account' && accountTriggerRect && (
        <AccountDropdown
          user={user}
          triggerRect={accountTriggerRect}
          onClose={() => setOpenDropdown(null)}
          onAuthChange={handleAuthChange}
        />
      )}
    </>
  );
}
