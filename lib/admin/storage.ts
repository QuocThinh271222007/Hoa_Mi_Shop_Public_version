import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// SERVER-ONLY. Uses the service-role Supabase client (bypasses RLS).
// Never import this file in a client component.

// Bucket name constants — the user creates these buckets manually in Supabase
// Storage. If a bucket is renamed there, update it here.
export const BUCKETS = {
  product:    'product-images',
  collection: 'collection-images',
  banner:     'banner-product-images',
  blog:       'blog-images',
  feedback:   'feedback-images',
  site:       'site-assets',
} as const;

export type BucketKey = keyof typeof BUCKETS;
export type BucketName = (typeof BUCKETS)[BucketKey];

export const ALL_BUCKETS: BucketName[] = Object.values(BUCKETS);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME: Record<string, string> = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/webp': 'webp',
};

export function isAllowedBucket(bucket: string): bucket is BucketName {
  return (ALL_BUCKETS as string[]).includes(bucket);
}

export function isAllowedMime(mime: string): boolean {
  return Boolean(ALLOWED_MIME[mime]);
}

// Build a safe, randomized, collision-resistant object path.
function buildObjectPath(originalName: string, mime: string): string {
  const ext = ALLOWED_MIME[mime] ?? 'bin';
  const base = (originalName.split('.').slice(0, -1).join('.') || originalName)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')          // non-alnum -> dash
    .replace(/^-+|-+$/g, '')              // trim dashes
    .slice(0, 48) || 'image';
  const rand = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '')
    .slice(0, 12);
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '/');
  return `${yyyymm}/${base}-${rand}.${ext}`;
}

export type UploadResult = {
  bucket: BucketName;
  path: string;
  publicUrl: string;
  mime: string;
  size: number;
};

export type UploadError = { error: string };

export function isUploadError(r: UploadResult | UploadError): r is UploadError {
  return 'error' in r;
}

// Upload an image File to a bucket and record it in media_assets.
// Returns a clear { error } object instead of throwing, so callers
// (API route / admin UI) can surface a friendly message.
export async function uploadImage(
  bucket: string,
  file: File,
  alt?: string | null,
): Promise<UploadResult | UploadError> {
  if (!isAllowedBucket(bucket)) {
    return { error: `Bucket "${bucket}" không hợp lệ.` };
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return { error: 'Không nhận được tệp ảnh.' };
  }
  if (!isAllowedMime(file.type)) {
    return { error: 'Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'Ảnh vượt quá 5MB.' };
  }

  const db = createAdminSupabaseClient();
  const path = buildObjectPath(file.name, file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await db.storage.from(bucket).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (upErr) {
    // Surface the common "bucket missing" case clearly.
    const msg = upErr.message || '';
    if (/not found/i.test(msg) || /bucket/i.test(msg)) {
      return {
        error: `Bucket "${bucket}" chưa tồn tại trong Supabase Storage. ` +
          `Hãy tạo bucket này (public) rồi thử lại.`,
      };
    }
    return { error: `Upload thất bại: ${msg}` };
  }

  const { data: pub } = db.storage.from(bucket).getPublicUrl(path);
  const publicUrl = pub?.publicUrl ?? '';

  // Record metadata (best-effort — never block the upload result).
  await db.from('media_assets').insert({
    bucket,
    path,
    public_url: publicUrl,
    alt: alt ?? null,
    mime: file.type,
    size: file.size,
  });

  return { bucket, path, publicUrl, mime: file.type, size: file.size };
}

export type MediaAsset = {
  id: string; bucket: string; path: string; public_url: string | null;
  alt: string | null; mime: string | null; size: number | null;
  width: number | null; height: number | null; created_at: string;
};

export async function listRecentMedia(limit = 60): Promise<MediaAsset[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('media_assets')
    .select('id, bucket, path, public_url, alt, mime, size, width, height, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as MediaAsset[];
}

// Delete an object from Storage and its media_assets row.
export async function deleteMedia(bucket: string, path: string): Promise<UploadError | { ok: true }> {
  if (!isAllowedBucket(bucket)) return { error: `Bucket "${bucket}" không hợp lệ.` };
  const db = createAdminSupabaseClient();
  const { error } = await db.storage.from(bucket).remove([path]);
  if (error) return { error: `Xoá ảnh thất bại: ${error.message}` };
  await db.from('media_assets').delete().eq('bucket', bucket).eq('path', path);
  return { ok: true };
}
