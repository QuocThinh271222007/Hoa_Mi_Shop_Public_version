import type { CartItem } from '@/lib/types';
import { demoProducts } from '@/lib/demo-products';

export const CART_KEY = 'cuchoami.cart.v1';
const OLD_CART_KEY = 'daisy-shop:cart';
export const CART_EVENT = 'cuchoami:cart-updated';

function migrateOldCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(OLD_CART_KEY);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);
    localStorage.removeItem(OLD_CART_KEY);
    return ids
      .map((id) => {
        const product = demoProducts.find((p) => p.id === id);
        return product ? { ...product, quantity: 1 } : null;
      })
      .filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

export function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw !== null) return JSON.parse(raw) as CartItem[];
    const migrated = migrateOldCart();
    if (migrated.length > 0) {
      localStorage.setItem(CART_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  } catch {
    // ignore storage errors
  }
}

// Clamp a desired quantity to the item's available stock. A stock of `undefined`
// (legacy/unknown) is treated as unlimited so nothing breaks; a numeric stock is
// a hard ceiling (0 = out of stock).
function clampToStock(item: { stock?: number }, qty: number): number {
  const s = item.stock;
  if (typeof s === 'number' && s >= 0) return Math.min(qty, s);
  return qty;
}

export function addItem(product: Omit<CartItem, 'quantity'>, qty = 1): CartItem[] {
  const cart = readCart();
  const idx = cart.findIndex((c) => c.id === product.id);
  const existing = idx >= 0 ? cart[idx].quantity : 0;
  const capped = clampToStock(product, existing + qty);
  // Out of stock (or already at the ceiling): leave the cart unchanged.
  if (capped <= 0 || capped === existing) return cart;
  const next =
    idx >= 0
      ? cart.map((c, i) => (i === idx ? { ...c, quantity: capped, stock: product.stock } : c))
      : [...cart, { ...product, quantity: capped }];
  writeCart(next);
  return next;
}

export function removeItem(id: string): CartItem[] {
  const next = readCart().filter((c) => c.id !== id);
  writeCart(next);
  return next;
}

export function updateQuantity(id: string, qty: number): CartItem[] {
  if (qty < 1) return removeItem(id);
  const next = readCart().map((c) =>
    c.id === id ? { ...c, quantity: clampToStock(c, qty) } : c,
  );
  writeCart(next);
  return next;
}

export function clearCart(): void {
  writeCart([]);
}

export function calcTotal(items: CartItem[]): number {
  return items.reduce((sum, c) => sum + c.price * c.quantity, 0);
}
