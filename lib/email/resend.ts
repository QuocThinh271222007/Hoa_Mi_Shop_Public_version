import 'server-only';
// SERVER-ONLY. Sends transactional email via the Resend REST API directly
// (no SDK dependency). Requires RESEND_API_KEY; RESEND_FROM_EMAIL sets the
// verified sender ("Cúc Họa Mi <no-reply@your-domain>").

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Cúc Họa Mi <onboarding@resend.dev>';
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not configured.' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Resend responded ${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
