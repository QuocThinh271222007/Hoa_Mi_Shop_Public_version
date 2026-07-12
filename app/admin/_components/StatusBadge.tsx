const BADGE_MAP: Record<string, string> = {
  pending:                'admin-badge admin-badge--pending',
  proof_submitted:        'admin-badge admin-badge--pending',
  awaiting_payment:       'admin-badge admin-badge--pending',
  awaiting_verification:  'admin-badge admin-badge--pending',
  returned:               'admin-badge admin-badge--pending',
  new:             'admin-badge admin-badge--new',
  confirmed:       'admin-badge admin-badge--new',
  delivering:      'admin-badge admin-badge--new',
  paid:            'admin-badge admin-badge--done',
  delivered:       'admin-badge admin-badge--done',
  resolved:        'admin-badge admin-badge--done',
  published:       'admin-badge admin-badge--done',
  refunded:        'admin-badge admin-badge--refunded',
  read:            'admin-badge admin-badge--read',
  cancelled:       'admin-badge admin-badge--read',
  draft:           'admin-badge admin-badge--read',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = BADGE_MAP[status] ?? 'admin-badge admin-badge--read';
  return <span className={cls}>{status}</span>;
}
