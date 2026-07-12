import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { uploadImage, isUploadError, BUCKETS } from '@/lib/admin/storage';
import { truncateWords } from '@/lib/feedback/truncate-words';
import { withApiGuard } from '@/lib/api/guard';

// Feedback submission (multipart form so it can carry an optional photo).
// Requires login (blocks anonymous spam + unbounded image uploads), checks the
// blacklist, and is rate-limited. Stored unpublished for admin review.
export const POST = withApiGuard(
  async (req) => {
    try {
    const form = await req.formData();
    const name = ((form.get('name') as string | null) ?? '').trim().slice(0, 100);
    const description = truncateWords(((form.get('description') as string | null) ?? '').trim(), 10);
    const message = ((form.get('message') as string | null) ?? '').trim().slice(0, 1000);
    const file = form.get('image');

    if (!name) return NextResponse.json({ error: 'Vui lòng nhập tên của bạn.' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Vui lòng nhập nội dung feedback.' }, { status: 400 });

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

    const db = createAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await db.from('feedback_items').insert({
      customer_name: name,
      description: description || null,
      message,
      image_url: imageUrl,
      image_path: imagePath,
      is_published: false,
      is_featured: false,
    } as any);
    if (error) {
      return NextResponse.json({ error: 'Không thể gửi feedback. Vui lòng thử lại.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' }, { status: 500 });
    }
  },
  {
    requireAuth: true,
    blacklist: true,
    rateLimit: { bucket: 'feedback', limit: 3, windowSec: 600 },
  },
);
