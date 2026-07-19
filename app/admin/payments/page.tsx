import { requireAdmin } from '@/lib/admin/auth-check';
import { getPaymentRequests, getBankTransactions, getProviderUsageSummary } from '@/lib/admin/payments-data';
import { getOrderLifecycleMap } from '@/lib/admin/orders-data';
import { canAdminConfirmPayment, canAdminMarkFailed } from '@/lib/orders/status-mapping';
import { AdminShell } from '../_components/AdminShell';
import { StatusBadge } from '../_components/StatusBadge';
import { actionManualMatch, actionMarkPaid, actionMarkFailed, actionReconcileQuota } from './actions';
import { currentQuotaMonth } from '@/lib/payments/provider-quota';
import { formatDateTimeVN } from '@/lib/time';

function fmt(n: number) { return `${n.toLocaleString('vi-VN')}đ`; }
function fmtDate(s: string | null) { return formatDateTimeVN(s); }

const PR_STATUSES    = ['all', 'awaiting_payment', 'awaiting_verification', 'paid', 'failed', 'expired'];
const PR_MODES       = ['all', 'sepay_auto', 'manual_bank_transfer', 'cod'];
const TXN_STATUSES   = ['all', 'unmatched', 'matched_pending_admin', 'matched'];
const SEPAY_PROVIDER = process.env.SEPAY_PROVIDER_NAME ?? 'sepay';

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ prStatus?: string; prMode?: string; txnStatus?: string; q?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const quotaMonth = currentQuotaMonth();
  const sePayEnabled     = process.env.SEPAY_ENABLED === 'true';
  const sePayConfigured  = !!process.env.SEPAY_WEBHOOK_SECRET;
  const defaultQuotaLimit = parseInt(process.env.SEPAY_MONTHLY_FREE_QUOTA ?? '50', 10);

  const [paymentRequests, transactions, usageSummary] = await Promise.all([
    getPaymentRequests(sp.prStatus ?? 'all', sp.prMode ?? 'all', 'all', sp.q),
    getBankTransactions(sp.txnStatus ?? 'all'),
    getProviderUsageSummary(SEPAY_PROVIDER, quotaMonth),
  ]);

  // Lifecycle snapshot per order — lets us gate COD confirmation (money is only
  // collected once the order is out for delivery / delivered).
  const orderMap = await getOrderLifecycleMap(paymentRequests.map((p) => p.order_id));

  const unmatched     = transactions.filter((t) => t.status === 'unmatched');
  const pendingAdmin  = transactions.filter((t) => t.status === 'matched_pending_admin');
  const awaiting      = paymentRequests.filter((p) => p.status === 'awaiting_payment' || p.status === 'awaiting_verification');

  const usedCount     = usageSummary?.auto_success_count ?? 0;
  const quotaLimit    = usageSummary?.auto_quota_limit ?? defaultQuotaLimit;
  const manualAdjust  = usageSummary?.manual_adjustment ?? 0;
  // Effective usage/remaining include the admin reconciliation offset (F6) so the
  // display matches the SePay dashboard and the auto→manual fallback.
  const effectiveUsed = Math.max(0, usedCount + manualAdjust);
  const remaining     = Math.max(0, quotaLimit - effectiveUsed);
  const manualCount   = usageSummary?.manual_fallback_count ?? 0;

  return (
    <AdminShell email={email} activePath="/admin/payments">
      <header className="admin-header">
        <h1 className="admin-header__title">Payments & Bank Reconciliation</h1>
        <p className="admin-header__subtitle">
          {awaiting.length > 0 && <span style={{ color: '#d97706', marginRight: 12 }}>⚠️ {awaiting.length} chờ thanh toán</span>}
          {pendingAdmin.length > 0 && <span style={{ color: '#dc2626', marginRight: 12 }}>⚠️ {pendingAdmin.length} tiền đã về, cần xác nhận</span>}
          {unmatched.length > 0 && <span style={{ color: '#d97706' }}>⚠️ {unmatched.length} giao dịch chưa khớp</span>}
        </p>
      </header>

      {/* SePay Quota Card */}
      <section className="admin-section" style={{ marginBottom: 16 }}>
        <h2 className="admin-section__heading">SePay Auto-Confirm Quota — {quotaMonth}</h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 20px', minWidth: 180 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Auto-confirmed (qua web)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: effectiveUsed >= quotaLimit ? '#dc2626' : '#16a34a' }}>
              {effectiveUsed} / {quotaLimit}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              {remaining > 0 ? `Còn lại thực tế: ${remaining}` : 'Đã hết quota tháng này'}
            </div>
            {manualAdjust !== 0 && (
              <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
                Đã điều chỉnh {manualAdjust > 0 ? '+' : ''}{manualAdjust} (giao dịch ngoài web)
              </div>
            )}
          </div>

          {/* F6 — reconcile against the real SePay dashboard number */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 20px', minWidth: 220 }}>
            <div style={{ fontSize: 11, color: '#92400e', marginBottom: 6 }}>Đối chiếu quota thực tế</div>
            <form action={actionReconcileQuota} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                name="actualRemaining"
                min={0}
                max={quotaLimit}
                defaultValue={remaining}
                className="admin-form__input admin-form__input--sm"
                style={{ width: 72 }}
                aria-label="Số lượt còn lại thực tế theo SePay"
              />
              <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lưu</button>
            </form>
            <div style={{ fontSize: 10, color: '#b45309', marginTop: 4, maxWidth: 200 }}>
              Nhập số &quot;còn lại&quot; đọc trên dashboard SePay. Các auto-confirm sau vẫn tự trừ tiếp.
            </div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 20px', minWidth: 180 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Manual xác nhận</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#374151' }}>{manualCount}</div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 20px', minWidth: 200 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Trạng thái SePay</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {sePayEnabled && sePayConfigured
                ? <span style={{ color: '#16a34a' }}>✓ Đang hoạt động</span>
                : !sePayEnabled
                ? <span style={{ color: '#9ca3af' }}>Đã tắt (SEPAY_ENABLED=false)</span>
                : <span style={{ color: '#dc2626' }}>⚠ SEPAY_WEBHOOK_SECRET chưa cấu hình</span>}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Fallback: manual_bank_transfer
            </div>
          </div>
        </div>
      </section>

      <div className="admin-banner">
        💡 Hệ thống tự động khớp khi nhận webhook từ SePay (<code>/api/payments/sepay-webhook</code>).
        Dùng form bên dưới để khớp/xác nhận thủ công.
        {!sePayConfigured && (
          <> <strong>SEPAY_WEBHOOK_SECRET</strong> chưa cấu hình — auto-confirm chưa hoạt động.</>
        )}
      </div>

      {/* Payment Requests */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Payment Requests</h2>
        <form method="get" className="admin-filter-bar" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            name="q"
            className="admin-form__input admin-form__input--sm"
            placeholder="Tìm theo mã đơn..."
            defaultValue={sp.q ?? ''}
            style={{ width: 200 }}
          />
          <select name="prStatus" className="admin-form__select" defaultValue={sp.prStatus ?? 'all'}>
            {PR_STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'Tất cả status' : s}</option>)}
          </select>
          <select name="prMode" className="admin-form__select" defaultValue={sp.prMode ?? 'all'}>
            {PR_MODES.map((m) => <option key={m} value={m}>{m === 'all' ? 'Tất cả mode' : m}</option>)}
          </select>
          <input type="hidden" name="txnStatus" value={sp.txnStatus ?? 'all'} />
          <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lọc</button>
          <a href="/admin/payments" className="admin-btn admin-btn--sm admin-btn--ghost">Xóa lọc</a>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th><th>Order</th><th>Số tiền</th><th>Mode</th>
                <th>Status</th><th>Provider</th><th>Lý do manual</th>
                <th>Expires</th><th>Paid at</th><th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {paymentRequests.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#bbb' }}>Không có</td></tr>
              ) : (
                paymentRequests.map((pr) => {
                  const isCodPr   = pr.payment_mode === 'cod';
                  const orderLike = orderMap.get(pr.order_id)
                    ?? { status: null, payment_status: null, payment_method: isCodPr ? 'cod' : null };
                  const prOpen    = pr.status === 'awaiting_payment' || pr.status === 'awaiting_verification';
                  const canConfirm = prOpen && canAdminConfirmPayment(orderLike);
                  const canFail    = prOpen && canAdminMarkFailed(orderLike);
                  // COD awaiting confirmation but not yet delivered → payment step is
                  // still pending downstream; explain instead of showing a dead button.
                  const codWaitingDelivery = isCodPr && prOpen && !canConfirm;
                  return (
                  <tr key={pr.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{pr.payment_code}</td>
                    <td>
                      <a href={`/admin/orders/${pr.order_id}`} className="admin-link" style={{ fontSize: 11 }}>
                        {pr.order_id.slice(0, 8)}…
                      </a>
                    </td>
                    <td>{fmt(pr.amount)}</td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        background: pr.payment_mode === 'sepay_auto' ? '#dcfce7' : pr.payment_mode === 'cod' ? '#fef3c7' : '#f3f4f6',
                        color: pr.payment_mode === 'sepay_auto' ? '#166534' : pr.payment_mode === 'cod' ? '#92400e' : '#374151',
                      }}>
                        {pr.payment_mode === 'sepay_auto' ? 'SePay Auto' : pr.payment_mode === 'cod' ? 'COD' : 'Manual'}
                      </span>
                    </td>
                    <td><StatusBadge status={pr.status} /></td>
                    <td style={{ fontSize: 11 }}>{pr.provider ?? '–'}</td>
                    <td style={{ fontSize: 10, color: '#d97706' }}>
                      {pr.manual_required_reason
                        ? pr.manual_required_reason.replace(/_/g, ' ')
                        : '–'}
                    </td>
                    <td style={{ fontSize: 11 }}>{fmtDate(pr.expires_at)}</td>
                    <td style={{ fontSize: 11 }}>{fmtDate(pr.paid_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {canConfirm && (
                          <form action={actionMarkPaid} style={{ display: 'contents' }}>
                            <input type="hidden" name="paymentRequestId" value={pr.id} />
                            <input type="hidden" name="adminNote" value={isCodPr ? 'COD cash collected — confirmed by admin' : 'Manually confirmed by admin'} />
                            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary"
                              title={isCodPr ? 'Xác nhận đã thu tiền COD' : 'Xác nhận đã thanh toán (không đếm vào SePay quota)'}>
                              {isCodPr ? '✓ Đã thu tiền (COD)' : '✓ Xác nhận TT'}
                            </button>
                          </form>
                        )}
                        {canFail && (
                          <form action={actionMarkFailed} style={{ display: 'contents' }}>
                            <input type="hidden" name="paymentRequestId" value={pr.id} />
                            <input type="hidden" name="reason" value="Marked failed by admin" />
                            <button type="submit" className="admin-btn admin-btn--sm"
                              style={{ color: '#dc2626', borderColor: '#dc2626' }}>
                              ✗ Thất bại
                            </button>
                          </form>
                        )}
                        {codWaitingDelivery && (
                          <span style={{ fontSize: 10, color: '#d97706' }}>
                            Chờ giao hàng — thu tiền khi giao
                          </span>
                        )}
                        <a href={`/admin/orders/${pr.order_id}`} className="admin-btn admin-btn--sm admin-btn--ghost">
                          Mở đơn
                        </a>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bank Transactions */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Bank Transactions</h2>
        <form method="get" className="admin-filter-bar" style={{ marginBottom: 12 }}>
          <input type="hidden" name="q" value={sp.q ?? ''} />
          <input type="hidden" name="prStatus" value={sp.prStatus ?? 'all'} />
          <input type="hidden" name="prMode" value={sp.prMode ?? 'all'} />
          <select name="txnStatus" className="admin-form__select" defaultValue={sp.txnStatus ?? 'all'}>
            {TXN_STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'Tất cả' : s}</option>)}
          </select>
          <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lọc</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider TXN</th><th>Thời gian</th><th>Số tiền</th>
                <th>Nội dung</th><th>Status</th><th>Lý do không khớp</th><th>Khớp thủ công</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#bbb' }}>Chưa có giao dịch</td></tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                      {t.provider_transaction_id?.slice(0, 12) ?? t.id.slice(0, 8)}
                    </td>
                    <td style={{ fontSize: 11 }}>{fmtDate(t.transaction_time)}</td>
                    <td>{fmt(t.amount)}</td>
                    <td style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description ?? '–'}
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ fontSize: 11, color: '#d97706' }}>{t.match_failure_reason ?? '–'}</td>
                    <td>
                      {(t.status === 'unmatched' || t.status === 'matched_pending_admin') && (
                        <form action={actionManualMatch}>
                          <input type="hidden" name="transactionId" value={t.id} />
                          <input type="hidden" name="adminNote" value="Manually matched by admin" />
                          <div className="admin-inline-form">
                            <select
                              name="paymentRequestId"
                              className="admin-form__select"
                              style={{ fontSize: 11, width: 160 }}
                              defaultValue={t.matched_payment_request_id ?? ''}
                            >
                              <option value="">Chọn payment request…</option>
                              {awaiting.map((pr) => (
                                <option key={pr.id} value={pr.id}>
                                  {pr.payment_code} — {fmt(pr.amount)}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">
                              {t.status === 'matched_pending_admin' ? 'Xác nhận' : 'Khớp'}
                            </button>
                          </div>
                          {t.status === 'matched_pending_admin' && (
                            <span style={{ fontSize: 10, color: '#d97706', display: 'block', marginTop: 2 }}>
                              Tiền đã về (chế độ thủ công) — cần admin xác nhận
                            </span>
                          )}
                        </form>
                      )}
                      {t.status === 'matched' && (
                        <span style={{ fontSize: 11, color: '#16a34a' }}>
                          ✓ Khớp với {t.matched_payment_request_id?.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>
          Giao dịch SePay nhận qua <code>/api/payments/sepay-webhook</code>.
          Cần cấu hình <code>SEPAY_WEBHOOK_SECRET</code> và <code>SEPAY_ENABLED=true</code>.
        </p>
      </section>
    </AdminShell>
  );
}
