'use client';

import { useState } from 'react';
import { ImageDropzone } from '@/components/admin/ImageDropzone';

// Editor for one "spirit card". Admin picks a mode via a toggle:
//   • Nội dung     → text only
//   • Ảnh          → image only (fills the card)
//   • Text + Ảnh nền → text overlaid on the image (image as background)
// The public page renders whichever mode is selected. Text, image, colour and
// size fields ALWAYS submit (they stay mounted), so switching mode never discards
// typed data — only the visible editor changes.

// Legacy named sizes → px, so cards saved before free-input still resolve sensibly.
const LEGACY_SIZE_PX: Record<string, number> = { sm: 15, md: 18, lg: 24, xl: 32 };

// Resolve a stored size value (either a number-ish string or a legacy name) to px.
function resolveSizePx(v?: string): number {
  const s = (v ?? '').trim();
  if (LEGACY_SIZE_PX[s]) return LEGACY_SIZE_PX[s];
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 18;
}

export function SpiritCardEditor({
  index,
  bucket,
  defaultMode = 'text',
  defaultBody = '',
  defaultImage = '',
  defaultAlt = '',
  defaultColor = '#ffffff',
  defaultSize = 'md',
}: {
  index: number;
  bucket: string;
  defaultMode?: string;
  defaultBody?: string;
  defaultImage?: string;
  defaultAlt?: string;
  defaultColor?: string;
  defaultSize?: string;
}) {
  const normMode = ['text', 'image', 'text_image'].includes(defaultMode) ? defaultMode : 'text';
  const [mode, setMode] = useState(normMode);
  const [color, setColor] = useState(/^#([0-9a-fA-F]{6})$/.test(defaultColor) ? defaultColor : '#ffffff');

  const showText = mode === 'text' || mode === 'text_image';
  const showImage = mode === 'image' || mode === 'text_image';

  const MODES: { value: string; label: string }[] = [
    { value: 'text', label: 'Nội dung' },
    { value: 'image', label: 'Ảnh' },
    { value: 'text_image', label: 'Text + Ảnh nền' },
  ];

  return (
    <div className="admin-form__field admin-form__field--full">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <label className="admin-form__label" style={{ margin: 0 }}>Thẻ {index}</label>
        <div className="admin-segmented" role="group" aria-label={`Chế độ thẻ ${index}`}>
          {MODES.map((mo) => (
            <button
              key={mo.value}
              type="button"
              onClick={() => setMode(mo.value)}
              className={`admin-segmented__btn${mode === mo.value ? ' admin-segmented__btn--active' : ''}`}
              aria-pressed={mode === mo.value}
            >
              {mo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Persisted mode — read by the public page to decide what to render. */}
      <input type="hidden" name={`setting_about_spirit_${index}_mode`} value={mode} />

      {/* Text editor — shown for text & text_image modes; stays mounted so data isn't lost. */}
      <div style={{ display: showText ? 'block' : 'none' }}>
        <textarea
          name={`setting_about_spirit_${index}_body`}
          rows={5}
          defaultValue={defaultBody}
          className="admin-form__textarea"
          placeholder={`Nội dung thẻ ${index}`}
        />
      </div>

      {/* Text style controls — colour + size. Only relevant when text is shown. */}
      <div
        style={{
          display: showText ? 'flex' : 'none',
          gap: 20,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          marginTop: 10,
        }}
      >
        <div>
          <label className="admin-form__label">Màu chữ</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label={`Màu chữ thẻ ${index}`}
              style={{ width: 44, height: 34, padding: 2, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{color}</span>
          </div>
          {/* Real submitted field (kept in sync with the picker). */}
          <input type="hidden" name={`setting_about_spirit_${index}_text_color`} value={color} />
        </div>
        <div>
          <label className="admin-form__label">Cỡ chữ (px)</label>
          <input
            type="number"
            min={8}
            max={120}
            step={1}
            name={`setting_about_spirit_${index}_text_size`}
            defaultValue={resolveSizePx(defaultSize)}
            className="admin-form__input"
            style={{ width: 110 }}
            placeholder="18"
          />
        </div>
      </div>

      {/* Image editor — shown for image & text_image modes. */}
      <div style={{ display: showImage ? 'block' : 'none', marginTop: 10 }}>
        <ImageDropzone
          bucket={bucket}
          label={mode === 'text_image' ? `Ảnh nền thẻ ${index}` : `Ảnh thẻ ${index}`}
          name={`setting_about_spirit_${index}_image`}
          altName={`setting_about_spirit_${index}_image_alt`}
          defaultUrl={defaultImage}
          defaultAlt={defaultAlt}
        />
      </div>
    </div>
  );
}
