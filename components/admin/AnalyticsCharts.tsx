// Lightweight, dependency-free analytics charts (pure SVG + CSS).
// Server components — safe to render in the admin analytics page. All handle
// empty data gracefully and never crash.

import type { DaySeriesRow } from '@/lib/admin/analytics-data';

const PINK = '#e6679a';
const BLUE = '#6b9bd1';

function EmptyState() {
  return <p style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 13 }}>Chưa có dữ liệu</p>;
}

// ── Line chart: views + unique visitors over time ──
export function TrendChart({ series }: { series: DaySeriesRow[] }) {
  const hasData = series.some((d) => d.views > 0 || d.visitors > 0);
  if (series.length === 0 || !hasData) return <EmptyState />;

  const W = 760;
  const H = 200;
  const padX = 8;
  const padY = 16;
  const max = Math.max(1, ...series.map((d) => Math.max(d.views, d.visitors)));
  const stepX = series.length > 1 ? (W - padX * 2) / (series.length - 1) : 0;
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);
  const x = (i: number) => padX + i * stepX;

  const line = (key: 'views' | 'visitors') =>
    series.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Lưu lượng theo ngày">
        {/* baseline */}
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="#eee" strokeWidth={1} />
        <path d={line('views')} fill="none" stroke={PINK} strokeWidth={2} strokeLinejoin="round" />
        <path d={line('visitors')} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeDasharray="4 3" />
      </svg>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', fontSize: 12, marginTop: 4 }}>
        <span style={{ color: PINK }}>● Lượt xem</span>
        <span style={{ color: BLUE }}>● Khách duy nhất</span>
        <span style={{ color: '#9ca3af' }}>{series[0]?.day} → {series[series.length - 1]?.day}</span>
      </div>
    </div>
  );
}

// ── Horizontal bar list (top pages / referrers / devices) ──
export function BarList({ items }: { items: { label: string; value: number }[] }) {
  if (items.length === 0) return <EmptyState />;
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: '0 0 42%', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
            {item.label}
          </span>
          <span style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 14, position: 'relative' }}>
            <span style={{
              position: 'absolute', insetBlock: 0, left: 0,
              width: `${Math.max(3, (item.value / max) * 100)}%`,
              background: PINK, borderRadius: 4,
            }} />
          </span>
          <span style={{ flex: '0 0 auto', fontSize: 12, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
