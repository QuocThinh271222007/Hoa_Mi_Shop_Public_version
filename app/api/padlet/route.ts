import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { uploadImage, isUploadError, BUCKETS } from '@/lib/admin/storage';
import { withApiGuard } from '@/lib/api/guard';

// Pastel card backgrounds assigned to customer posts so the wall stays colorful.
const PADLET_COLORS = ['#FFF4C2', '#FFE0EC', '#D9F5E5', '#DCEBFF', '#ECE0FF', '#FFE6CC'];

// Customer submission to the self-hosted Padlet wall (multipart, optional photo).
// Same gateway as feedback: requires login (blocks anonymous spam + unbounded
// uploads), checks the blacklist, and is rate-limited. Stored UNPUBLISHED so an
// admin approves it before it appears on the public wall.
export const POST = withApiGuard(
  async (req) => {
    try {
      const form = await req.formData();
      const name = ((form.get('name') as string | null) ?? '').trim().slice(0, 100);
      const title = ((form.get('title') as string | null) ?? '').trim().slice(0, 120);
      const body = ((form.get('message') as string | null) ?? '').trim().slice(0, 1000);
      const file = form.get('image');

      if (!name) return NextResponse.json({ error: 'Vui lòng nhập tên của bạn.' }, { status: 400 });
      if (!body) return NextResponse.json({ error: 'Vui lòng nhập nội dung bài đăng.' }, { status: 400 });

      let imageUrl: string | null = null;
      let imagePath: string | null = null;
      if (file && typeof file !== 'string' && file.size > 0) {
        const result = await uploadImage(BUCKETS.feedback, file, name);
        if (isUploadError(result)) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        imageUrl = result.publicUrl;
        imagePath = result.path;
      }

      const bgColor = PADLET_COLORS[Math.floor(Math.random() * PADLET_COLORS.length)];

      // padlet_posts isn't in the generated Supabase types (migration
      // 20260714_padlet_posts.sql) → cast to a loose client for the insert.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createAdminSupabaseClient() as any;
      const { error } = await db.from('padlet_posts').insert({
        author_name: name,
        title: title || null,
        body,
        image_url: imageUrl,
        image_path: imagePath,
        bg_color: bgColor,
        is_published: false, // pending admin approval
      });
      if (error) {
        return NextResponse.json({ error: 'Không thể đăng bài. Vui lòng thử lại.' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
    }
  },
  {
    requireAuth: true,
    blacklist: true,
    rateLimit: { bucket: 'padlet', limit: 3, windowSec: 600 },
  },
);
