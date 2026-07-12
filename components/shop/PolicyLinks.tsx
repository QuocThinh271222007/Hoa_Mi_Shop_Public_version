'use client';

import { useEffect, useState } from 'react';

export type Policy = { title: string; body: string };

// Render policy body: if saved as HTML (from WYSIWYG editor), use as-is.
// If it's old plain text, convert paragraphs so it still displays correctly.
function renderPolicyBody(body: string): string {
  if (!body || !body.trim()) {
    return '<p class="policy-modal__empty">Nội dung đang được cập nhật.</p>';
  }
  if (body.trimStart().startsWith('<')) return body;
  return body
    .split(/\n{2,}/)
    .map((para) => `<p style="white-space:pre-line">${para}</p>`)
    .join('');
}

export function PolicyLinks({ policies }: { policies: Policy[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  function openAt(idx: number) {
    setActiveIdx(idx);
    setIsOpen(true);
  }

  const activePolicy = policies[activeIdx];

  return (
    <>
      {policies.map((p, idx) => (
        <button
          key={p.title}
          type="button"
          className="footer-policy-link"
          onClick={() => openAt(idx)}
        >
          {p.title}
        </button>
      ))}

      {isOpen && (
        <div
          className="policy-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Chính sách"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className="policy-overlay__inner">
            <button
              type="button"
              className="policy-overlay__close"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng"
            >
              ✕
            </button>

            {/* Tab buttons */}
            <div className="policy-overlay__tabs" role="tablist">
              {policies.map((p, idx) => (
                <button
                  key={p.title}
                  type="button"
                  role="tab"
                  aria-selected={activeIdx === idx}
                  className={`policy-overlay__tab${activeIdx === idx ? ' policy-overlay__tab--active' : ''}`}
                  onClick={() => setActiveIdx(idx)}
                >
                  {p.title}
                </button>
              ))}
            </div>

            {/* Content panel */}
            <div className="policy-overlay__panel">
              <div
                className="policy-modal__body"
                dangerouslySetInnerHTML={{ __html: renderPolicyBody(activePolicy?.body ?? '') }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
