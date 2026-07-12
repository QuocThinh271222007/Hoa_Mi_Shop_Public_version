import Image from 'next/image';
import { getSettingsMap } from '@/lib/admin/settings-data';
import './about-us.css';

// Fixed decorative assets — not editable from admin.
const BRAND_TITLE_IMG = '/assets/brand/3.%20About%20Us%203.png';
const STAR_STICKER_IMG = '/assets/ui/11.%20C%C3%9AC%20NG%C3%94I%20SAO.png';
const HEART_STICKER_IMG = '/assets/ui/10.%20C%C3%9AC%20TR%C3%81I%20TIM.png';

// Static fallbacks so the page looks identical before any admin edit / migration.
const DEFAULTS: Record<string, string> = {
  about_s1_title: 'About us 1',
  about_s1_body: 'Nội dung',
  about_s1_image: '/assets/brand/about-us-asset-1.png',
  about_s1_image_alt: 'Bộ sưu tập quần áo Cúc Họa Mi',
  about_s2_title: 'About us 2',
  about_s2_body: 'Nội dung',
  about_s2_image: '/assets/brand/about-us-asset-2.png',
  about_s2_image_alt: 'Mascot Cúc Họa Mi',
  about_s3_title: 'About us 3',
  about_s3_body: 'Nội dung',
  about_s3_image: '',
  about_s3_image_alt: 'Ảnh nhóm Cúc Họa Mi',
};

const ABOUT_KEYS = [
  ...['1', '2', '3'].flatMap((n) => [
    `about_s${n}_title`, `about_s${n}_body`, `about_s${n}_image`, `about_s${n}_image_alt`,
  ]),
  ...['1', '2', '3'].flatMap((n) => [
    `about_spirit_${n}_mode`, `about_spirit_${n}_body`,
    `about_spirit_${n}_image`, `about_spirit_${n}_image_alt`,
    `about_spirit_${n}_text_color`, `about_spirit_${n}_text_size`,
  ]),
];

// Resolve a spirit-card text size to a CSS font-size. Accepts a free numeric px
// value ("24" → "24px") or a legacy named size (sm/md/lg/xl). Falls back to 18px.
const LEGACY_SPIRIT_SIZE_PX: Record<string, number> = { sm: 15, md: 18, lg: 24, xl: 32 };
function spiritFontSize(v?: string): string {
  const s = (v ?? '').trim();
  if (LEGACY_SPIRIT_SIZE_PX[s]) return `${LEGACY_SPIRIT_SIZE_PX[s]}px`;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? `${n}px` : '18px';
}

export default async function AboutPage() {
  const raw = await getSettingsMap(ABOUT_KEYS).catch(() => ({}) as Record<string, string>);
  const get = (key: string) => (raw[key] && raw[key].trim()) || DEFAULTS[key] || '';

  const spiritCard = (n: 1 | 2 | 3) => {
    const rawMode = raw[`about_spirit_${n}_mode`] || 'text';
    const mode = ['text', 'image', 'text_image'].includes(rawMode) ? rawMode : 'text';
    const image = (raw[`about_spirit_${n}_image`] || '').trim();
    const body = (raw[`about_spirit_${n}_body`] || '').trim() || 'Nội dung';
    const color = (raw[`about_spirit_${n}_text_color`] || '').trim() || undefined;
    const fontSize = spiritFontSize(raw[`about_spirit_${n}_text_size`]);
    const textStyle = { whiteSpace: 'pre-line' as const, color, fontSize };

    // Image only.
    if (mode === 'image' && image) {
      return (
        <Image
          className="about-page__spirit-image"
          src={image}
          alt={raw[`about_spirit_${n}_image_alt`] || ''}
          width={480}
          height={360}
          unoptimized
        />
      );
    }

    // Text overlaid on a background image (falls back to plain text if no image).
    if (mode === 'text_image' && image) {
      return (
        <div
          className="about-page__spirit-textimage"
          style={{ backgroundImage: `url("${image}")` }}
        >
          <p style={textStyle}>{body}</p>
        </div>
      );
    }

    // Text only (default).
    return <p style={textStyle}>{body}</p>;
  };

  const s3Image = get('about_s3_image');

  return (
    <main className="about-page">

      {/* ── Section 1: content left, cloud asset right ── */}
      <section className="about-page__section about-page__section--one">
        <h2 className="about-page__title">{get('about_s1_title')}</h2>
        <div className="about-page__text-card">
          <p style={{ whiteSpace: 'pre-line' }}>{get('about_s1_body')}</p>
        </div>
        <div className="about-page__asset-col">
          <Image
            className="about-page__asset about-page__asset--cloud"
            src={get('about_s1_image')}
            alt={get('about_s1_image_alt')}
            width={620}
            height={500}
            unoptimized
          />
        </div>
      </section>

      {/* ── Section 2: chick asset left, content right ── */}
      <section className="about-page__section about-page__section--two">
        <h2 className="about-page__title">{get('about_s2_title')}</h2>
        <div className="about-page__asset-col">
          <Image
            className="about-page__asset about-page__asset--chicks"
            src={get('about_s2_image')}
            alt={get('about_s2_image_alt')}
            width={560}
            height={500}
            unoptimized
          />
        </div>
        <div className="about-page__text-card">
          <p style={{ whiteSpace: 'pre-line' }}>{get('about_s2_body')}</p>
        </div>
      </section>

      {/* ── Section 3: content left, group photo right ── */}
      <section className="about-page__section about-page__section--three">
        <h2 className="about-page__title">{get('about_s3_title')}</h2>
        <div className="about-page__text-card">
          <p style={{ whiteSpace: 'pre-line' }}>{get('about_s3_body')}</p>
        </div>
        <div className="about-page__asset-col">
          {/* Always keep the pink frame as container; image fills it via cover */}
          <div className="about-page__group-photo">
            {s3Image ? (
              <Image
                className="about-page__group-photo-img"
                src={s3Image}
                alt={get('about_s3_image_alt')}
                fill
                unoptimized
                style={{ objectFit: 'cover', borderRadius: 24 }}
              />
            ) : (
              <span>Ảnh nhóm</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Tinh Thần Thương Hiệu — fixed image asset ── */}
      <section className="about-page__brand-section">
        <Image
          className="about-page__brand-title-image"
          src={BRAND_TITLE_IMG}
          alt="Tinh Thần Thương Hiệu"
          width={1200}
          height={280}
          unoptimized
        />
      </section>

      {/* ── Brand spirit cards — each is text or image per admin ── */}
      <section className="about-page__cards-section">
        <div className="about-page__spirit-grid">

          <div className="about-page__spirit-card-wrap about-page__spirit-card-wrap--first">
            <Image
              className="about-page__sticker about-page__sticker--star"
              src={STAR_STICKER_IMG}
              alt=""
              aria-hidden="true"
              width={80}
              height={80}
              unoptimized
            />
            <div className="about-page__spirit-card">
              {spiritCard(1)}
            </div>
          </div>

          <div className="about-page__spirit-card-wrap">
            <div className="about-page__spirit-card">
              {spiritCard(2)}
            </div>
          </div>

          <div className="about-page__spirit-card-wrap about-page__spirit-card-wrap--last">
            <div className="about-page__spirit-card">
              {spiritCard(3)}
            </div>
            <Image
              className="about-page__sticker about-page__sticker--heart"
              src={HEART_STICKER_IMG}
              alt=""
              aria-hidden="true"
              width={80}
              height={80}
              unoptimized
            />
          </div>

        </div>
      </section>

    </main>
  );
}
