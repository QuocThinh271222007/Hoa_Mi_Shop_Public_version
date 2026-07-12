export function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number | string;
  variant?: 'accent' | 'warn';
}) {
  const cls = variant ? `admin-card admin-card--${variant}` : 'admin-card';
  return (
    <div className={cls}>
      <p className="admin-card__label">{label}</p>
      <p className="admin-card__value">{value}</p>
    </div>
  );
}
