import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getOrderById, getOrderItems } from '@/lib/admin/orders-data';
import { getPaymentRequestByOrderId } from '@/lib/admin/payments-data';
import {
  getAdminOrderStatusLabel,
  getAdminOrderBucket,
  isCodOrder,
  canAdminConfirmOrder,
  canAdminCancelOrder,
  canAdminMarkPacking,
  canAdminMarkShipped,
  canAdminMarkDelivered,
  canAdminMarkReturned,
  canAdminMarkRefunded,
  type AdminOrderBucket,
} from '@/lib/orders/status-mapping';
import { formatDateTimeVN } from '@/lib/time';
import { AdminShell } from '../../_components/AdminShell';
import { StatusBadge } from '../../_components/StatusBadge';
import { actionUpdateOrderStatus, actionUpdateAdminNote, actionMarkCodPaid, actionMarkReturned, actionMarkRefunded, actionDeleteOrder } from '../actions';
import { ConfirmSubmitButton } from '../ConfirmSubmitButton';

function fmt(n: number) { return `${n.toLocaleString('vi-VN')}đ`; }
function fmtDate(s: string | null) { return formatDateTimeVN(s); }

const ORDER_STATUSES: { value: string; label: string }[] = [
  { value: 'pending',   label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'packing',   label: 'Đang chuẩn bị' },
  { value: 'shipped',   label: 'Đang giao hàng' },
  { value: 'delivered', label: 'Đã giao hàng' },
  { value: 'returned',  label: 'Chờ hoàn tiền (Trả hàng)' },
  { value: 'refunded',  label: 'Đã hoàn tiền' },
  { value: 'cancelled', label: 'Đã hủy' },
];

// Compact lifecycle stepper. Highlights progress through the happy path; shows a
// terminal state for cancelled / returned orders.
const STEPPER: { bucket: AdminOrderBucket; label: string }[] = [
  { bucket: 'pending_confirmation', label: 'Chờ xác nhận' },
  { bucket: 'confirmed',           label: 'Đã xác nhận' },
  { bucket: 'preparing',           label: 'Đang chuẩn bị' },
  { bucket: 'shipping',            label: 'Đang giao' },
  { bucket: 'delivered',           label: 'Đã giao' },
];

function LifecycleStepper({ bucket }: { bucket: AdminOrderBucket }) {
  if (bucket === 'cancelled' || bucket === 'returned' || bucket === 'refunded') {
    const cfg =
      bucket === 'refunded' ? { bg: '#dcfce7', color: '#166534', border: '#86efac', label: '✓ Đã hoàn tiền' }
      : bucket === 'returned' ? { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: '↩ Chờ hoàn tiền (Trả hàng)' }
      : { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '✕ Đơn hàng đã hủy' };
    return (
      <div style={{
        padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      }}>
        {cfg.label}
      </div>
    );
  }
  const activeIdx = STEPPER.findIndex((s) => s.bucket === bucket);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {STEPPER.map((step, i) => {
        const done = i <= activeIdx;
        return (
          <div key={step.bucket} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: done ? '#ecfdf5' : '#f3f4f6',
              color: done ? '#047857' : '#9ca3af',
              border: `1px solid ${done ? '#a7f3d0' : '#e5e7eb'}`,
            }}>
              <span>{done ? '✓' : i + 1}</span>{step.label}
            </span>
            {i < STEPPER.length - 1 && <span style={{ color: '#d1d5db' }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}

// One-click lifecycle action. Orders-page actions only ever move the order STATUS
// forward — payment confirmation lives on the Payments page.
function LifecycleAction({
  orderId, value, label, danger,
}: {
  orderId: string; value: string; label: string; danger?: boolean;
}) {
  return (
    <form action={actionUpdateOrderStatus}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={value} />
      <button
        type="submit"
        className={`admin-btn admin-btn--sm ${danger ? 'admin-btn--ghost' : 'admin-btn--primary'}`}
        style={danger ? { color: '#dc2626' } : undefined}
      >
        {label}
      </button>
    </form>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { email } = await requireAdmin();
  const { id } = await params;

  const [order, items, paymentRequest] = await Promise.all([
    getOrderById(id),
    getOrderItems(id),
    getPaymentRequestByOrderId(id),
  ]);

  if (!order) notFound();

  const cod  = isCodOrder(order);
  const paid = (order.payment_status ?? '') === 'paid';
  // Pickup orders store the customer-chosen time slot in pickup_time; delivery
  // orders leave it null. shipping_address holds the store name for pickup.
  const isPickup = !!order.pickup_time;

  return (
    <AdminShell email={email} activePath="/admin/orders">
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/admin/orders" className="admin-link" style={{ fontSize: 13 }}>← Quay lại</a>
          <h1 className="admin-header__title" style={{ margin: 0 }}>
            Đơn hàng {order.payment_code ? `#${order.payment_code}` : ''}
          </h1>
          <StatusBadge status={order.status} />
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
            {getAdminOrderStatusLabel(order)}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            background: cod ? '#fef3c7' : '#e0f2fe',
            color: cod ? '#92400e' : '#075985',
          }}>
            {cod ? 'COD' : 'Chuyển khoản / QR'}
          </span>
        </div>
        <p className="admin-header__subtitle" style={{ fontFamily: 'monospace', marginTop: 4 }}>{order.id}</p>
      </header>

      {/* Lifecycle stepper */}
      <section className="admin-section">
        <LifecycleStepper bucket={getAdminOrderBucket(order)} />
      </section>

      {/* Customer cancellation request — admin reviews then uses "Hủy đơn" below */}
      {order.cancel_requested_at && getAdminOrderBucket(order) !== 'cancelled' && (
        <section className="admin-section" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <h2 className="admin-section__heading" style={{ color: '#b91c1c' }}>⚠ Khách yêu cầu hủy đơn</h2>
          <div className="admin-detail-rows">
            <div className="admin-detail-row"><span>Thời điểm yêu cầu</span><strong>{fmtDate(order.cancel_requested_at)}</strong></div>
            {order.cancel_reason && (
              <div className="admin-detail-row"><span>Lý do</span><strong>{order.cancel_reason}</strong></div>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#991b1b', marginTop: 8 }}>
            Xem xét rồi bấm <strong>"✕ Hủy đơn"</strong> ở mục Quản lý đơn hàng để chấp nhận hủy.
          </p>
        </section>
      )}

      {/* ── Quản lý đơn hàng — chỉ điều khiển vòng đời, không xác nhận thanh toán ── */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Quản lý đơn hàng</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {canAdminConfirmOrder(order) && (
            <LifecycleAction orderId={order.id} value="confirmed" label="✓ Xác nhận đơn" />
          )}
          {canAdminMarkPacking(order) && (
            <LifecycleAction orderId={order.id} value="packing" label="📦 Đang chuẩn bị" />
          )}
          {canAdminMarkShipped(order) && (
            <LifecycleAction orderId={order.id} value="shipped" label="🚚 Giao hàng" />
          )}
          {canAdminMarkDelivered(order) && (
            <LifecycleAction orderId={order.id} value="delivered" label="🎉 Đã giao" />
          )}
          {canAdminMarkReturned(order) && (
            <form action={actionMarkReturned} style={{ display: 'inline' }}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="admin-btn admin-btn--sm" style={{ background: '#fff8e6', color: '#92400e', border: '1px solid #fde68a' }}>
                ↩ Trả hàng
              </button>
            </form>
          )}
          {canAdminMarkRefunded(order) && (
            <form action={actionMarkRefunded} style={{ display: 'inline' }}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="admin-btn admin-btn--sm" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
                💚 Đã hoàn tiền
              </button>
            </form>
          )}
          {canAdminCancelOrder(order) && (
            <LifecycleAction orderId={order.id} value="cancelled" label="✕ Hủy đơn" danger />
          )}
        </div>
        <p style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>
          {cod
            ? 'Đơn COD đi hết vòng đời mà không cần thanh toán trước. Việc xác nhận đã thu tiền được thực hiện ở trang Payments sau khi giao.'
            : 'Đơn chuyển khoản cần được xác nhận thanh toán ở trang Payments trước khi chuẩn bị/giao hàng.'}
          {' '}Mốc thời gian được ghi tự động (không ghi đè giá trị đã có).
        </p>
      </section>

      {/* Customer info */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Thông tin khách hàng</h2>
        <div className="admin-detail-rows">
          <div className="admin-detail-row"><span>Họ tên</span><strong>{order.customer_name}</strong></div>
          <div className="admin-detail-row"><span>SĐT</span><strong>{order.customer_phone}</strong></div>
          <div className="admin-detail-row"><span>Email</span><strong>{order.customer_email || '–'}</strong></div>
          <div className="admin-detail-row">
            <span>{isPickup ? 'Cửa hàng nhận' : 'Địa chỉ giao'}</span>
            <strong>{order.shipping_address}</strong>
          </div>
          {isPickup && (
            <div className="admin-detail-row">
              <span>Giờ khách đến lấy</span>
              <strong style={{ color: '#047857' }}>{order.pickup_time}</strong>
            </div>
          )}
          <div className="admin-detail-row">
            <span>Ghi chú của khách</span>
            <strong style={{ color: order.order_note ? undefined : '#9ca3af', fontWeight: order.order_note ? 600 : 400 }}>
              {order.order_note || 'Khách không để lại ghi chú'}
            </strong>
          </div>
        </div>
      </section>

      {/* Order items */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Sản phẩm</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Sản phẩm</th><th>Đơn giá</th><th>SL</th><th>Thành tiền</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}</td>
                  <td>{fmt(item.unit_price)}</td>
                  <td>{item.quantity}</td>
                  <td>{fmt(item.unit_price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lifecycle timestamps */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Mốc thời gian</h2>
        <div className="admin-detail-rows">
          <div className="admin-detail-row"><span>Tạo đơn</span><strong>{fmtDate(order.created_at)}</strong></div>
          <div className="admin-detail-row"><span>Xác nhận (confirmed_at)</span><strong>{fmtDate(order.confirmed_at)}</strong></div>
          <div className="admin-detail-row"><span>Chuẩn bị (packed_at)</span><strong>{fmtDate(order.packed_at)}</strong></div>
          <div className="admin-detail-row"><span>Giao hàng (shipped_at)</span><strong>{fmtDate(order.shipped_at)}</strong></div>
          <div className="admin-detail-row"><span>Đã giao (delivered_at)</span><strong>{fmtDate(order.delivered_at)}</strong></div>
          <div className="admin-detail-row"><span>Thanh toán (paid_at)</span><strong>{fmtDate(order.paid_at)}</strong></div>
          <div className="admin-detail-row"><span>Hủy (cancelled_at)</span><strong>{fmtDate(order.cancelled_at)}</strong></div>
        </div>
      </section>

      {/* Cập nhật trạng thái đơn (thủ công) — chỉ order status, không có thanh toán */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Cập nhật trạng thái (thủ công)</h2>
        <form action={actionUpdateOrderStatus}>
          <input type="hidden" name="orderId" value={order.id} />
          <div className="admin-inline-form">
            <select name="status" className="admin-form__select" defaultValue={order.status}>
              {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Cập nhật trạng thái</button>
          </div>
        </form>
      </section>

      {/* Admin note */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Ghi chú nội bộ</h2>
        <form action={actionUpdateAdminNote}>
          <input type="hidden" name="orderId" value={order.id} />
          <textarea
            name="adminNote" rows={3} className="admin-form__textarea"
            defaultValue={order.admin_note ?? ''}
            placeholder="Ghi chú nội bộ (không hiển thị cho khách)..."
            style={{ marginBottom: 8 }}
          />
          <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">Lưu ghi chú</button>
        </form>
      </section>

      {/* ── Thanh toán (chỉ xem) — xác nhận/đối soát ở trang Payments ── */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Thanh toán</h2>
        <div className="admin-detail-rows">
          <div className="admin-detail-row"><span>Subtotal</span><strong>{fmt(order.subtotal)}</strong></div>
          {(order.discount_amount ?? 0) > 0 && (
            <div className="admin-detail-row">
              <span>Giảm giá {order.discount_code ? `(${order.discount_code})` : ''}</span>
              <strong>−{fmt(order.discount_amount ?? 0)}</strong>
            </div>
          )}
          <div className="admin-detail-row"><span>Phí giao hàng</span><strong>{fmt(order.shipping_fee ?? 18000)}</strong></div>
          <div className="admin-detail-row" style={{ fontWeight: 700 }}>
            <span>Tổng cộng</span><strong>{fmt(order.total_amount ?? order.subtotal)}</strong>
          </div>
          <div className="admin-detail-row"><span>Phương thức</span><strong>{cod ? 'COD — thu tiền khi giao' : (order.payment_method ?? '–')}</strong></div>
          <div className="admin-detail-row"><span>Trạng thái TT</span><StatusBadge status={order.payment_status ?? 'awaiting_payment'} /></div>
          {order.payment_code && <div className="admin-detail-row"><span>Payment code</span><strong style={{ fontFamily: 'monospace' }}>{order.payment_code}</strong></div>}
          {order.paid_at && <div className="admin-detail-row"><span>Paid at</span><strong>{fmtDate(order.paid_at)}</strong></div>}
          {paymentRequest && (
            <>
              <div className="admin-detail-row"><span>Payment request</span><StatusBadge status={paymentRequest.status} /></div>
              <div className="admin-detail-row"><span>Ngân hàng</span><strong>{paymentRequest.bank_name ?? '–'} {paymentRequest.bank_account_number ?? ''}</strong></div>
              <div className="admin-detail-row"><span>Hết hạn</span><strong>{fmtDate(paymentRequest.expires_at)}</strong></div>
            </>
          )}
          {order.bank_transaction_id && (
            <div className="admin-detail-row">
              <span>Bank TXN</span>
              <a href={`/admin/payments?txn=${order.bank_transaction_id}`} className="admin-link" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                {order.bank_transaction_id.slice(0, 8)}…
              </a>
            </div>
          )}
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* COD: one-click "Đã thu tiền" right here, no need to go to Payments */}
          {cod && !paid && (
            <form action={actionMarkCodPaid}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">
                ✓ Đã thu tiền (COD)
              </button>
            </form>
          )}
          {cod && paid && (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#047857' }}>✓ Đã thu tiền COD</span>
          )}
          {!cod && (
            <a
              href={paymentRequest ? `/admin/payments?pr=${paymentRequest.id}` : '/admin/payments'}
              className="admin-btn admin-btn--ghost admin-btn--sm"
            >
              → {paid ? 'Xem đối soát tại Payments' : 'Xác nhận / đối soát thanh toán tại Payments'}
            </a>
          )}
          {!paid && !cod && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              Việc xác nhận thanh toán chuyển khoản được thực hiện tại trang Payments.
            </span>
          )}
        </div>
      </section>

      <p style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>
        Tạo: {fmtDate(order.created_at)}
        {order.updated_at && ` · Cập nhật: ${fmtDate(order.updated_at)}`}
      </p>

      {/* ── Danger zone ── */}
      <section className="admin-section" style={{ borderColor: '#fecaca', marginTop: 24 }}>
        <h2 className="admin-section__heading" style={{ color: '#dc2626' }}>Vùng nguy hiểm</h2>
        <form action={actionDeleteOrder}>
          <input type="hidden" name="orderId" value={order.id} />
          <ConfirmSubmitButton
            confirmMessage="Xóa vĩnh viễn đơn hàng này? Hành động không thể hoàn tác."
            className="admin-btn admin-btn--sm admin-btn--ghost"
            style={{ color: '#dc2626' }}
          >
            🗑 Xóa đơn hàng
          </ConfirmSubmitButton>
        </form>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
          Xóa vĩnh viễn đơn hàng và các sản phẩm trong đơn. Tồn kho sẽ được hoàn trả nếu đơn đã xử lý.
        </p>
      </section>
    </AdminShell>
  );
}
