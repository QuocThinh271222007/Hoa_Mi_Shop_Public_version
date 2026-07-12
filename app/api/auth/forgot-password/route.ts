import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptcha } from '@/lib/auth/recaptcha';
import { createPasswordResetToken } from '@/lib/auth/password-reset';
import { sendEmail } from '@/lib/email/resend';
import { rateLimit } from '@/lib/api/rate-limit';
import { getClientIp } from '@/lib/api/request-context';

function resetEmailHtml(link: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#4b3540">
    <h2 style="color:#ff8fca;margin:0 0 12px">Đặt lại mật khẩu</h2>
    <p>Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản Cúc Họa Mi.</p>
    <p>Nhấn nút bên dưới để tạo mật khẩu mới. Liên kết này sẽ <strong>hết hạn sau 5 phút</strong>.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${link}" style="background:#ff8fca;color:#fff;text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:700;display:inline-block">
        Đặt lại mật khẩu
      </a>
    </p>
    <p style="font-size:12px;color:#9e6f86">Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.</p>
  </div>`;
}

export async function POST(req: NextRequest) {
  try {
    // Throttle reset requests per IP (limits email-bombing / enumeration probing).
    const rl = await rateLimit('auth_forgot', getClientIp(req), 5, 600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Bạn thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.' },
        { status: 429 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const recaptchaToken = typeof body.recaptchaToken === 'string' ? body.recaptchaToken : '';

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Email không hợp lệ.' }, { status: 400 });
    }

    const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const human = await verifyRecaptcha(recaptchaToken, remoteIp);
    if (!human) {
      return NextResponse.json({ error: 'Xác minh chống bot thất bại. Vui lòng thử lại.' }, { status: 400 });
    }

    // Best-effort: issue token + send email only if the account exists. We always
    // return success so an attacker cannot probe which emails are registered.
    const token = await createPasswordResetToken(email);
    if (token) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const link = `${siteUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
      await sendEmail({
        to: email,
        subject: 'Đặt lại mật khẩu — Cúc Họa Mi',
        html: resetEmailHtml(link),
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
  }
}
