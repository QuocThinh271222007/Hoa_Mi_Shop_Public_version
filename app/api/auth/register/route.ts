import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptcha } from '@/lib/auth/recaptcha';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { rateLimit } from '@/lib/api/rate-limit';
import { getClientIp } from '@/lib/api/request-context';

// Server-side registration so the reCAPTCHA check actually gates account
// creation (a client-only check is trivially bypassed by bots). Creates the
// auth user via the admin API, then the client signs in with the password.
export async function POST(req: NextRequest) {
  try {
    // Throttle account-creation attempts per IP (defense in depth over reCAPTCHA).
    const rl = await rateLimit('auth_register', getClientIp(req), 5, 600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Bạn thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.' },
        { status: 429 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 100) : '';
    const recaptchaToken = typeof body.recaptchaToken === 'string' ? body.recaptchaToken : '';

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Email không hợp lệ.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' }, { status: 400 });
    }

    const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const human = await verifyRecaptcha(recaptchaToken, remoteIp);
    if (!human) {
      return NextResponse.json({ error: 'Xác minh chống bot thất bại. Vui lòng thử lại.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // shop accounts are usable immediately
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (error || !data?.user) {
      const msg = (error?.message ?? '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'Email này đã được đăng ký. Vui lòng đăng nhập.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Không thể tạo tài khoản. Vui lòng thử lại.' }, { status: 500 });
    }

    // Seed a customer profile so the name is available across the app.
    await admin.from('customer_profiles').insert({
      user_id: data.user.id,
      full_name: fullName || null,
      email,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
  }
}
