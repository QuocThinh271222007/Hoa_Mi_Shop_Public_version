'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { renderRichContent } from '@/lib/html/rich-content';

// Word-like WYSIWYG editor for blog posts. Produces HTML that is stored in a
// hidden <input name={name}> so the surrounding <form> submits it like any field.
// Supports headings, inline styles, lists, quotes, alignment, links and — the key
// feature — inserting an uploaded image exactly at the caret position.
//
// Images are uploaded through POST /api/admin/media/upload (service role on the
// server); the browser never sees the service-role key.

type Btn = { cmd: string; value?: string; label: string; title: string };

const INLINE: Btn[] = [
  { cmd: 'bold', label: 'B', title: 'Đậm (Ctrl+B)' },
  { cmd: 'italic', label: 'I', title: 'Nghiêng (Ctrl+I)' },
  { cmd: 'underline', label: 'U', title: 'Gạch chân (Ctrl+U)' },
  { cmd: 'strikeThrough', label: 'S', title: 'Gạch ngang' },
];

const BLOCKS: Btn[] = [
  { cmd: 'formatBlock', value: 'P', label: 'Đoạn', title: 'Văn bản thường' },
  { cmd: 'formatBlock', value: 'H2', label: 'H2', title: 'Tiêu đề lớn' },
  { cmd: 'formatBlock', value: 'H3', label: 'H3', title: 'Tiêu đề nhỏ' },
  { cmd: 'formatBlock', value: 'BLOCKQUOTE', label: '❝', title: 'Trích dẫn' },
];

const LISTS: Btn[] = [
  { cmd: 'insertUnorderedList', label: '• List', title: 'Danh sách chấm' },
  { cmd: 'insertOrderedList', label: '1. List', title: 'Danh sách số' },
];

const ALIGN: Btn[] = [
  { cmd: 'justifyLeft', label: '⟸', title: 'Căn trái' },
  { cmd: 'justifyCenter', label: '≡', title: 'Căn giữa' },
  { cmd: 'justifyRight', label: '⟹', title: 'Căn phải' },
];

const ALLOWED_IMG = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export function BlogEditor({
  name,
  defaultValue = '',
  bucket,
}: {
  name: string;
  defaultValue?: string;
  bucket: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Initial content (converts legacy plain text to paragraphs).
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = renderRichContent(defaultValue);
      if (hiddenRef.current) hiddenRef.current.value = editorRef.current.innerHTML;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = useCallback(() => {
    if (hiddenRef.current && editorRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML;
    }
  }, []);

  // Remember the caret/selection while it is inside the editor, so toolbar and
  // file-dialog interactions (which move focus) can restore it before inserting.
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }, []);

  const exec = useCallback(
    (cmd: string, value?: string) => {
      restoreSelection();
      document.execCommand(cmd, false, value);
      saveSelection();
      sync();
    },
    [restoreSelection, saveSelection, sync],
  );

  const insertHtml = useCallback(
    (html: string) => {
      restoreSelection();
      document.execCommand('insertHTML', false, html);
      saveSelection();
      sync();
    },
    [restoreSelection, saveSelection, sync],
  );

  const addLink = useCallback(() => {
    const url = window.prompt('Nhập đường dẫn liên kết (URL):', 'https://');
    if (!url) return;
    exec('createLink', url);
  }, [exec]);

  const uploadImage = useCallback(
    async (file: File) => {
      setError('');
      if (!ALLOWED_IMG.includes(file.type)) {
        setError('Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP.');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('Ảnh vượt quá 5MB.');
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', bucket);
        const res = await fetch('/api/admin/media/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || 'Tải ảnh thất bại.');
          return;
        }
        const alt = (file.name.split('.').slice(0, -1).join('.') || 'ảnh').replace(/"/g, '');
        // Insert at the saved caret so the image lands where the author was typing.
        insertHtml(
          `<figure class="blog-figure"><img src="${data.publicUrl}" alt="${alt}" /></figure><p><br/></p>`,
        );
      } catch {
        setError('Không thể kết nối máy chủ tải ảnh.');
      } finally {
        setUploading(false);
      }
    },
    [bucket, insertHtml],
  );

  const btn = (b: Btn) => (
    <button
      key={b.cmd + (b.value ?? '')}
      type="button"
      className="blog-editor__btn"
      title={b.title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the selection in the editor
        exec(b.cmd, b.value);
      }}
    >
      {b.label}
    </button>
  );

  return (
    <div className="blog-editor">
      <div className="blog-editor__toolbar">
        <div className="blog-editor__group">{BLOCKS.map(btn)}</div>
        <div className="blog-editor__group">{INLINE.map(btn)}</div>
        <div className="blog-editor__group">{LISTS.map(btn)}</div>
        <div className="blog-editor__group">{ALIGN.map(btn)}</div>
        <div className="blog-editor__group">
          <button
            type="button"
            className="blog-editor__btn"
            title="Chèn liên kết"
            onMouseDown={(e) => {
              e.preventDefault();
              addLink();
            }}
          >
            🔗
          </button>
          <button
            type="button"
            className="blog-editor__btn blog-editor__btn--img"
            title="Chèn ảnh tại vị trí con trỏ"
            disabled={uploading}
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              fileRef.current?.click();
            }}
          >
            {uploading ? 'Đang tải…' : '🖼 Ảnh'}
          </button>
          <button
            type="button"
            className="blog-editor__btn"
            title="Xóa định dạng"
            onMouseDown={(e) => {
              e.preventDefault();
              exec('removeFormat');
            }}
          >
            ⌫ Định dạng
          </button>
        </div>
      </div>

      {error && <p className="blog-editor__error">⚠️ {error}</p>}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="blog-editor__content"
        data-placeholder="Bắt đầu viết bài… Dùng thanh công cụ để định dạng và chèn ảnh."
        role="textbox"
        aria-label="Nội dung bài viết"
        aria-multiline="true"
        onInput={sync}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={() => {
          saveSelection();
          sync();
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadImage(file);
          e.target.value = ''; // allow re-selecting the same file
        }}
      />

      <input ref={hiddenRef} type="hidden" name={name} defaultValue={defaultValue} />
    </div>
  );
}
