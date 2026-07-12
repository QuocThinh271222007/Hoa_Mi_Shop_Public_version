import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/auth/password-reset';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token) {
      return NextResponse.json({ error: 'Thiếu mã đặt lại mật khẩu.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' }, { status: 400 });
    }

    const result = await resetPasswordWithToken(token, password);
    if (result.ok) return NextResponse.json({ ok: true });

    const message =
      result.error === 'expired'
        ? 'Liên kết đã hết hạn (quá 5 phút). Vui lòng yêu cầu lại.'
        : result.error === 'invalid'
        ? 'Liên kết không hợp lệ hoặc đã được sử dụng.'
        : 'Lỗi máy chủ. Vui lòng thử lại.';
    const status = result.error === 'server' ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
  }
}
