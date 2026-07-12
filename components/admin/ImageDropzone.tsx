'use client';

import { useRef, useState } from 'react';

// Reusable admin image uploader. Drag/drop OR click to pick a PNG/JPG/WEBP.
// Uploads via POST /api/admin/media/upload (service role server-side).
// On success it fills a real <input name={name}> with the public URL so the
// surrounding <form> submits the URL like any other field. A manual URL field
// is also available as a fallback (still useful for /assets/... static paths).
//
// This component never touches the service-role key — it only calls the API.

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export function ImageDropzone({
  name = 'image_url',
  altName = 'image_alt',
  pathName,
  bucket,
  defaultUrl = '',
  defaultAlt = '',
  label = 'Ảnh',
}: {
  name?: string;
  altName?: string;
  pathName?: string; // optional hidden field name to also store the storage path
  bucket: string;
  defaultUrl?: string;
  defaultAlt?: string;
  label?: string;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [path, setPath] = useState('');
  const [alt, setAlt] = useState(defaultAlt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError('');
    if (!ALLOWED.includes(file.type)) {
      setError('Chỉ chấp nhận PNG, JPG hoặc WEBP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Ảnh vượt quá 5MB.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', bucket);
      if (alt) fd.append('alt', alt);
      const res = await fetch('/api/admin/media/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Upload thất bại.');
      } else {
        setUrl(data.publicUrl);
        setPath(data.path || '');
      }
    } catch {
      setError('Không thể kết nối máy chủ upload.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-dropzone">
      <label className="admin-form__label">{label}</label>

      <div
        className={`admin-dropzone__area${dragOver ? ' admin-dropzone__area--over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        role="button"
        tabIndex={0}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt || 'preview'} className="admin-dropzone__preview" />
        ) : (
          <span className="admin-dropzone__hint">
            {busy ? 'Đang tải lên…' : 'Kéo & thả ảnh vào đây, hoặc bấm để chọn (PNG/JPG/WEBP, ≤5MB)'}
          </span>
        )}
        {busy && <span className="admin-dropzone__badge">…</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      {error && <p className="admin-dropzone__error">⚠️ {error}</p>}

      <input
        name={name}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="admin-form__input"
        placeholder="URL ảnh (tự điền sau khi upload, hoặc /assets/...)"
      />
      {pathName && <input type="hidden" name={pathName} value={path} />}
      <input
        name={altName}
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        className="admin-form__input"
        placeholder="Alt text (mô tả ảnh)"
      />
    </div>
  );
}
