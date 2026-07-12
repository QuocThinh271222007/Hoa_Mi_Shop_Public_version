// SERVER-ONLY reCAPTCHA v2 verification (fetch-based, no dependency).
// Verifies the token the browser widget produced against Google's siteverify
// endpoint. If RECAPTCHA_SECRET_KEY is not configured the check is skipped so
// the app still works in local dev without keys (fail-open only when unset).

export async function verifyRecaptcha(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // not configured → skip (dev/local)
  if (!token) return false; // configured but no token → reject

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set('remoteip', remoteIp);
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json().catch(() => ({ success: false }))) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
