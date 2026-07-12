// Server-side checkout input validation. Mirrors the important client checks so
// a crafted request can't bypass them. No external libraries.

export type CheckoutInput = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  province?: string;
  orderNote?: string;
  deliveryMode?: string;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Control chars are never legitimate in these short fields; block them to avoid
// header/log injection and broken rendering. (orderNote allows newlines below.)
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x1F\x7F]/;

/** Normalizes a VN phone: strips spaces/dashes/dots, +84 -> 0. */
export function normalizePhone(raw: string): string {
  let p = (raw ?? '').replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (p.startsWith('84') && p.length > 9) p = '0' + p.slice(2);
  return p;
}

export function validateCheckoutInput(input: CheckoutInput): ValidationResult {
  const name = (input.name ?? '').trim();
  if (name.length < 2)   return { ok: false, error: 'Họ tên phải có ít nhất 2 ký tự.' };
  if (name.length > 100) return { ok: false, error: 'Họ tên quá dài.' };
  if (CONTROL_RE.test(name)) return { ok: false, error: 'Họ tên chứa ký tự không hợp lệ.' };

  const phone = normalizePhone(input.phone ?? '');
  if (!/^\d{9,11}$/.test(phone)) {
    return { ok: false, error: 'Số điện thoại không hợp lệ (cần 9–11 chữ số).' };
  }

  const email = (input.email ?? '').trim();
  if (email) {
    if (email.length > 200 || !EMAIL_RE.test(email)) {
      return { ok: false, error: 'Email không hợp lệ.' };
    }
  }

  // Address is required for delivery (not for in-store pickup).
  const address = (input.address ?? '').trim();
  if ((input.deliveryMode ?? 'delivery') !== 'pickup') {
    if (address.length < 4) return { ok: false, error: 'Vui lòng nhập địa chỉ giao hàng.' };
  }
  if (address.length > 300) return { ok: false, error: 'Địa chỉ quá dài.' };
  if (CONTROL_RE.test(address)) return { ok: false, error: 'Địa chỉ chứa ký tự không hợp lệ.' };

  const province = (input.province ?? '').trim();
  if (province.length > 100) return { ok: false, error: 'Tỉnh/thành không hợp lệ.' };

  const note = (input.orderNote ?? '').trim();
  if (note.length > 1000) return { ok: false, error: 'Ghi chú quá dài (tối đa 1000 ký tự).' };

  return { ok: true };
}
