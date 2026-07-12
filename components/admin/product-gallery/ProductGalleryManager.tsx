'use client';

import { useRef, useState } from 'react';

// Multi-image manager for the admin product form. Uploads each file via
// POST /api/admin/media/upload (service role server-side), keeps an ordered
// list, and serializes it into a hidden <input name="gallery_json"> so the
// surrounding <form> submits the gallery like any other field.
//
// The products.image_url ("Ảnh sản phẩm" / cover) is handled separately by
// ImageDropzone. These are the EXTRA gallery images shown on the detail page.

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export type GalleryImage = { url: string; path?: string | null; alt?: string | null };

export function ProductGalleryManager({
  bucket,
  defaultImages = [],
  name = 'gallery_json',
  label = 'Thư viện ảnh (hiển thị nhiều ảnh + dấu tròn ở trang chi tiết)',
}: {
  bucket: string;
  defaultImages?: GalleryImage[];
  name?: string;
  label?: string;
}) {
  const [images, setImages] = useState<GalleryImage[]>(defaultImages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File): Promise<GalleryImage | null> {
    if (!ALLOWED.includes(file.type)) {
      setError('Chỉ chấp nhận PNG, JPG hoặc WEBP.');
      return null;
    }
    if (file.size > MAX_BYTES) {
      setError('Ảnh vượt quá 5MB.');
      return null;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('bucket', bucket);
    const res = await fetch('/api/admin/media/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error || 'Upload thất bại.');
      return null;
    }
    return { url: data.publicUrl, path: data.path || null, alt: null };
  }

  async function handleFiles(files: FileList | File[]) {
    setError('');
    setBusy(true);
    try {
      const uploaded: GalleryImage[] = [];
      for (const file of Array.from(files)) {
        const img = await uploadOne(file);
        if (img) uploaded.push(img);
      }
      if (uploaded.length) setImages((prev) => [...prev, ...uploaded]);
    } catch {
      setError('Không thể kết nối máy chủ upload.');
    } finally {
      setBusy(false);
    }
  }

  function remove(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  return (
    <div className="admin-gallery">
      <label className="admin-form__label">{label}</label>

      <div
        className={`admin-dropzone__area${dragOver ? ' admin-dropzone__area--over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
      >
        <span className="admin-dropzone__hint">
          {busy ? 'Đang tải lên…' : 'Kéo & thả nhiều ảnh vào đây, hoặc bấm để chọn (PNG/JPG/WEBP, ≤5MB mỗi ảnh)'}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {error && <p className="admin-dropzone__error">⚠️ {error}</p>}

      {images.length > 0 && (
        <div className="admin-gallery__grid">
          {images.map((img, idx) => (
            <div key={`${img.url}-${idx}`} className="admin-gallery__item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || `Ảnh ${idx + 1}`} className="admin-gallery__thumb" />
              <div className="admin-gallery__controls">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Lên trước" title="Lên trước">◀</button>
                <span className="admin-gallery__index">{idx + 1}</span>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === images.length - 1} aria-label="Xuống sau" title="Xuống sau">▶</button>
                <button type="button" className="admin-gallery__remove" onClick={() => remove(idx)} aria-label="Xoá ảnh" title="Xoá">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input type="hidden" name={name} value={JSON.stringify(images)} />
    </div>
  );
}
