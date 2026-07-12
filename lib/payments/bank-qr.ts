// There is intentionally NO hardcoded fallback QR: a static image tied to a
// specific bank account must never be baked into the source (that routed money to
// the previous owner's account). Configure `checkout_qr_image_url` in site_settings
// (admin → Settings) — the checkout also builds a dynamic VietQR from the bank
// details, so this static image is optional.
export const FALLBACK_TEST_QR_IMAGE_URL = '';

/** Returns the configured QR image URL (empty string when none is set). */
export function resolveBankQrImageUrl(settingsUrl?: string | null): string {
  return (settingsUrl ?? '').trim();
}
