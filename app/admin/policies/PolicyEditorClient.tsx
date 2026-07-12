'use client';

import { useRef, useEffect, useCallback } from 'react';

// Convert legacy plain text (stored before the WYSIWYG editor) to HTML
// so the editor displays it correctly on first load.
function plainToHtml(text: string): string {
  if (!text || !text.trim()) return '';
  if (text.trimStart().startsWith('<')) return text;
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.split('\n').join('<br>')}</p>`)
    .join('');
}

type ToolbarCmd = {
  cmd: string;
  label: string;
  group?: string;
};

const TOOLBAR: ToolbarCmd[] = [
  { cmd: 'bold', label: 'B' },
  { cmd: 'italic', label: 'I' },
  { cmd: 'underline', label: 'U' },
  { cmd: 'insertUnorderedList', label: '• List' },
  { cmd: 'insertOrderedList', label: '1. List' },
  { cmd: 'justifyLeft', label: '⬅ Trái', group: 'align' },
  { cmd: 'justifyCenter', label: '⬛ Giữa', group: 'align' },
  { cmd: 'justifyRight', label: 'Phải ➡', group: 'align' },
];

export function PolicyEditorClient({
  name,
  defaultValue,
  label,
}: {
  name: string;
  defaultValue: string;
  label: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = plainToHtml(defaultValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = useCallback(() => {
    if (hiddenRef.current && editorRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML;
    }
  }, []);

  function exec(cmd: string) {
    document.execCommand(cmd, false, undefined);
    editorRef.current?.focus();
    sync();
  }

  return (
    <div className="policy-editor">
      <p className="admin-form__label" style={{ marginBottom: 6 }}>{label}</p>
      <div className="policy-editor__toolbar">
        {TOOLBAR.map(({ cmd, label: lbl }) => (
          <button
            key={cmd}
            type="button"
            className="policy-editor__btn"
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus in editor
              exec(cmd);
            }}
            title={lbl}
          >
            {lbl}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="policy-editor__content"
        onInput={sync}
        onKeyUp={sync}
        aria-label={label}
        aria-multiline="true"
        role="textbox"
      />
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={defaultValue} />
    </div>
  );
}
