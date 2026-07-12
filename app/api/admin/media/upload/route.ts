import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth-check';
import { uploadImage, isUploadError } from '@/lib/admin/storage';

// POST /api/admin/media/upload
// Multipart form-data: { file: File, bucket: string, alt?: string }
// Admin-only. Uses the service role (inside lib/admin/storage) to upload to
// Supabase Storage. The browser never sees the service-role key.
export async function POST(req: NextRequest) {
  // requireAdmin redirects on failure in server components; in an API route we
  // guard explicitly so we can return JSON instead.
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu upload không hợp lệ.' }, { status: 400 });
  }

  const file = form.get('file');
  const bucket = String(form.get('bucket') ?? '');
  const alt = (form.get('alt') as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Thiếu tệp ảnh.' }, { status: 400 });
  }

  const result = await uploadImage(bucket, file, alt);
  if (isUploadError(result)) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    bucket: result.bucket,
    path: result.path,
    publicUrl: result.publicUrl,
    mime: result.mime,
    size: result.size,
  });
}
