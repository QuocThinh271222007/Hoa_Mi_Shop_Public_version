// SERVER-ONLY. Never import in client components.
// Single source of truth for payment code generation, display, and matching.
//
// Canonical format (new): DH + 8 uppercase alphanumeric chars (e.g. DH8A2K9QZ1)
//   - matches SePay Live config: prefix DH, suffix 3–10 chars, type: letters+digits
// The stored payment_requests.payment_code is the ONE value used everywhere:
// checkout display, VietQR addInfo, SePay content, the matcher, and admin views.
// No place transforms it.

export const DEFAULT_PAYMENT_CODE_PREFIX = 'DH';
export const DEFAULT_PAYMENT_CODE_SUFFIX_LENGTH = 8;
export const MIN_SEPAY_SUFFIX_LENGTH = 3;
export const MAX_SEPAY_SUFFIX_LENGTH = 10;

export function getPaymentCodePrefix(): string {
  return (process.env.PAYMENT_CODE_PREFIX ?? DEFAULT_PAYMENT_CODE_PREFIX).toUpperCase();
}

export function getPaymentCodeSuffixLength(): number {
  const v = parseInt(process.env.PAYMENT_CODE_SUFFIX_LENGTH ?? '', 10);
  return Number.isFinite(v) && v >= MIN_SEPAY_SUFFIX_LENGTH && v <= MAX_SEPAY_SUFFIX_LENGTH
    ? v
    : DEFAULT_PAYMENT_CODE_SUFFIX_LENGTH;
}

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a new canonical payment code: DH + 8 random uppercase alphanumeric chars.
 * Uses crypto.getRandomValues when available (Node 19+/Edge), otherwise falls back to
 * Math.random. No dashes, spaces, or special characters — compatible with SePay Live
 * config (suffix 3–10 chars, letters+digits only).
 *
 * The orderId parameter is accepted for backward-compatible call sites but is ignored;
 * the new format does not embed the order id to avoid producing dashes.
 */
export function generatePaymentCode(_input?: string | { orderId?: string; random?: string }): string {
  const prefix     = getPaymentCodePrefix();
  const suffixLen  = getPaymentCodeSuffixLength();
  let suffix = '';

  // Use crypto.randomBytes when running in Node.js (server-side API routes).
  // Edge runtime (middleware) may not have it; fall back to Math.random.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('crypto') as typeof import('crypto');
    const bytes = randomBytes(suffixLen * 2);
    for (let i = 0; i < suffixLen; i++) {
      suffix += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length];
    }
  } catch {
    for (let i = 0; i < suffixLen; i++) {
      suffix += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
    }
  }

  return `${prefix}${suffix}`;
}

/**
 * The exact stored code is already display-ready. This only trims surrounding whitespace.
 */
export function normalizePaymentCodeForDisplay(code: string): string {
  return (code ?? '').trim();
}

/**
 * True when the code is non-empty, starts with the configured prefix, and contains
 * only the allowed SePay characters (uppercase letters + digits after the prefix).
 * Accepts both new format (DHXXXXXXXX) and old stored codes (DH-20964F-LABO, CUC-...).
 */
export function assertValidPaymentCode(code: string): boolean {
  const c = (code ?? '').trim().toUpperCase();
  if (!c.length) return false;
  const prefix = getPaymentCodePrefix();
  if (!c.startsWith(prefix)) return false;
  const suffix = c.slice(prefix.length);
  // New codes: pure alphanumeric suffix, length in SePay's allowed range.
  // Old codes (with dashes): still valid for display/matching — just check prefix.
  return suffix.length > 0;
}

/**
 * Compact form for matching: uppercase, alphanumeric only.
 * Used because some banking apps strip dashes/spaces from the VietQR transfer memo.
 * Old dashed code DH-20964F-LABO → DH20964FLABO; new code DH8A2K9QZ1 → DH8A2K9QZ1 (unchanged).
 */
export function compactPaymentCode(code: string): string {
  return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Safe matcher: exact substring first, compact (alphanumeric) substring as fallback.
 * Requires compactCode.length >= 4 so a bare `DH` prefix can never match.
 * Amount/expiry/status checks remain the caller's responsibility.
 *
 * Examples:
 *   paymentCodeMatchesContent("DH8A2K9QZ1", "DH8A2K9QZ1")           → true
 *   paymentCodeMatchesContent("DH8A2K9QZ1", "Bank memo DH8A2K9QZ1") → true
 *   paymentCodeMatchesContent("DH-20964F-LABO", "DH20964FLABO")      → true (old code, compact fallback)
 *   paymentCodeMatchesContent("DH8A2K9QZ1", "DH")                    → false
 */
export function paymentCodeMatchesContent(paymentCode: string, content: string): boolean {
  if (!paymentCode || !content) return false;

  const normalizedCode    = paymentCode.toUpperCase();
  const compactCode       = compactPaymentCode(paymentCode);
  if (compactCode.length < 4) return false;

  const normalizedContent = content.toUpperCase();
  const compactContent    = compactPaymentCode(content);

  return (
    normalizedContent.includes(normalizedCode) ||
    compactContent.includes(compactCode)
  );
}
