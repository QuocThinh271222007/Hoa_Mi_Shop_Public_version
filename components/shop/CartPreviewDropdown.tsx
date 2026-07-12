'use client';

import { type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import type { CartItem } from '@/lib/types';
import { calcTotal } from '@/lib/shop/cart-store';
import { formatPrice } from '@/lib/demo-products';

const PANEL_WIDTH = 380;
const DROPDOWN_Z = 2147482500;

interface Props {
  items: CartItem[];
  triggerRect: DOMRect;
  onClose: () => void;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
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

export function CartPreviewDropdown({ items, triggerRect, onClose, onRemove, onUpdateQty }: Props) {
  if (typeof document === 'undefined') return null;

  const isEmpty = items.length === 0;
  const total = calcTotal(items);
  const style = computeStyle(triggerRect);

  return createPortal(
    <div
      className="shop-nav-dropdown shop-cart-preview"
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label="Giỏ hàng"
    >
      <h2 className="shop-nav-dropdown__title">Giỏ Hàng</h2>

      {isEmpty ? (
        <div className="shop-cart-preview__empty">
          <Image
            src="/assets/ui/cart-icon.png"
            alt="Giỏ hàng trống"
            width={80}
            height={80}
            className="shop-cart-preview__empty-art"
          />
          <p className="shop-cart-preview__empty-msg">Bạn hiện chưa có sản phẩm nào!</p>
          <hr className="shop-cart-preview__divider" />
          <div className="shop-cart-preview__actions">
            <Link
              href="/cart"
              className="shop-cart-preview__btn shop-cart-preview__btn--secondary"
              onClick={onClose}
            >
              Xem Giỏ
            </Link>
            {/* /checkout does not exist yet — links to /cart until implemented */}
            <Link
              href="/cart"
              className="shop-cart-preview__btn shop-cart-preview__btn--primary"
              onClick={onClose}
              title="Trang thanh toán sẽ sớm ra mắt"
            >
              Thanh Toán
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="shop-cart-preview__list">
            {items.map((item) => (
              <div key={item.id} className="shop-cart-preview__item">
                <div className="shop-cart-preview__item-img">
                  <Image src={item.image} alt={item.name} fill sizes="72px" />
                </div>

                <div className="shop-cart-preview__item-info">
                  <span className="shop-cart-preview__item-name">{item.name}</span>
                  <span className="shop-cart-preview__item-price">{formatPrice(item.price)}</span>
                </div>

                <div className="shop-cart-preview__item-right">
                  <button
                    type="button"
                    className="shop-cart-preview__item-remove"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Xóa ${item.name}`}
                  >
                    ✕
                  </button>
                  <div className="shop-cart-preview__stepper">
                    <button
                      type="button"
                      className="shop-cart-preview__stepper-btn"
                      onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                      aria-label="Giảm số lượng"
                    >
                      −
                    </button>
                    <span className="shop-cart-preview__stepper-qty">{item.quantity}</span>
                    <button
                      type="button"
                      className="shop-cart-preview__stepper-btn"
                      onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                      aria-label="Tăng số lượng"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="shop-cart-preview__footer">
            <div className="shop-cart-preview__total">
              <span>TỔNG</span>
              <span>{formatPrice(total)}</span>
            </div>
            <hr className="shop-cart-preview__divider" />
            <div className="shop-cart-preview__actions">
              <Link
                href="/cart"
                className="shop-cart-preview__btn shop-cart-preview__btn--secondary"
                onClick={onClose}
              >
                Xem Giỏ
              </Link>
              {/* /checkout does not exist yet — links to /cart until implemented */}
              <Link
                href="/cart"
                className="shop-cart-preview__btn shop-cart-preview__btn--primary"
                onClick={onClose}
                title="Trang thanh toán sẽ sớm ra mắt"
              >
                Thanh Toán
              </Link>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
