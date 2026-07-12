'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readCart, removeItem, updateQuantity, calcTotal, CART_EVENT } from '@/lib/shop/cart-store';
import { formatPrice } from '@/lib/demo-products';
import type { CartItem } from '@/lib/types';

// Pre-encoded URLs for filenames with spaces/Vietnamese characters → plain <img>
const CART_TITLE = '/assets/brand/2.%20Cart.png';
const BILL_ART   = '/assets/brand/12.%20T%E1%BB%94NG%20BILL.png';
const CART_ICON  = '/assets/ui/cart-icon.png';

export function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    setItems(readCart());
    const onUpdate = () => setItems(readCart());
    window.addEventListener(CART_EVENT, onUpdate);
    return () => window.removeEventListener(CART_EVENT, onUpdate);
  }, []);

  const total = calcTotal(items);

  return (
    <main className="cart-page">
      <div className="cart-page__inner">

        {/* ── Hero ── */}
        <div className="cart-page__hero">
          <img
            className="cart-page__title-image"
            src={CART_TITLE}
            alt="Giỏ Hàng"
          />
          <img
            className="cart-page__title-icon"
            src={CART_ICON}
            alt=""
            aria-hidden="true"
          />
        </div>

        {/* ── Two-column layout ── */}
        <div className="cart-page__layout">

          {/* ── Left: items panel ── */}
          <section className="cart-page__items-panel">
            <p className="cart-page__items-heading">
              Bạn có <strong>{items.length}</strong> sản phẩm trong giỏ hàng:
            </p>

            {items.length === 0 ? (
              <div className="cart-page__empty">
                <p className="cart-page__empty-text">Giỏ hàng của bạn đang trống.</p>
                <Link className="cart-page__continue-link" href="/collection">
                  ◀ Tiếp tục mua hàng
                </Link>
              </div>
            ) : (
              <div className="cart-page__item-list">
                {items.map((item, idx) => (
                  <div key={item.id}>
                    <div className="cart-page__item">
                      {/* Product image frame */}
                      <div className="cart-page__item-image">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="220px"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>

                      {/* Name / price / quantity */}
                      <div className="cart-page__item-info">
                        <p className="cart-page__item-name">{item.name}</p>
                        <p className="cart-page__item-price">{formatPrice(item.price)}</p>
                        <div className="cart-page__quantity">
                          <button
                            className="cart-page__quantity-button"
                            type="button"
                            onClick={() => setItems(updateQuantity(item.id, item.quantity - 1))}
                            aria-label="Giảm số lượng"
                          >
                            −
                          </button>
                          <span className="cart-page__quantity-value">{item.quantity}</span>
                          <button
                            className="cart-page__quantity-button"
                            type="button"
                            onClick={() => setItems(updateQuantity(item.id, item.quantity + 1))}
                            aria-label="Tăng số lượng"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Remove button */}
                      <button
                        className="cart-page__remove"
                        type="button"
                        onClick={() => setItems(removeItem(item.id))}
                        aria-label={`Xóa ${item.name}`}
                      >
                        X
                      </button>
                    </div>

                    {idx < items.length - 1 && (
                      <hr className="cart-page__divider" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Note section ── */}
            <div className="cart-page__note">
              <h2 className="cart-page__note-title">Ghi Chú Đơn Hàng</h2>
              <textarea
                className="cart-page__note-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Viết ghi chú..."
                rows={3}
                aria-label="Ghi chú đơn hàng"
              />
            </div>
          </section>

          {/* ── Right: order summary ── */}
          <div className="cart-page__summary-wrap">
            {/* "Tính xiền thoi!!!" decoration above the card */}
            <img
              className="cart-page__summary-art"
              src={BILL_ART}
              alt="Tính xiền thoi!!!"
            />

            <div className="cart-page__summary-card">
              <h2 className="cart-page__summary-title">Thông Tin Đơn Hàng</h2>
              <hr className="cart-page__summary-divider" />

              <p className="cart-page__summary-total">
                <span>Tổng tiền:</span>
                <span>{formatPrice(total)}</span>
              </p>

              <p className="cart-page__summary-copy">
                Phí vận chuyển sẽ được tính ở trang thanh toán.<br />
                Bạn cũng có thể nhập mã giảm giá ở trang thanh toán.
              </p>

              <Link
                href="/checkout"
                className="cart-page__checkout-button"
              >
                Thanh Toán
              </Link>

              <Link className="cart-page__continue-link" href="/collection">
                ◀ Tiếp tục mua hàng
              </Link>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
