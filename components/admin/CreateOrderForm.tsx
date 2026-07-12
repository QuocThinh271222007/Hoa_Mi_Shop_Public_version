'use client';

import { useMemo, useState } from 'react';

export type ProductOption = { id: string; name: string; price: number; stock: number | null };

type LineItem = { productId: string | null; productName: string; unitPrice: number; quantity: number };
type StoreOpt = { id: string; name: string };
type SlotOverride = { mode: 'blocked' | 'custom'; custom_times?: string[] | null };

function fmt(n: number) { return `${n.toLocaleString('vi-VN')}đ`; }

export function CreateOrderForm({
  products,
  stores,
  pickupTimesByStore = {},
  pickupOffset = { min: 2, max: 3 },
  dayOverrides = {},
  weekdayRules = {},
  action,
}: {
  products: ProductOption[];
  stores: StoreOpt[];
  pickupTimesByStore?: Record<string, string[]>;
  pickupOffset?: { min: number; max: number };
  dayOverrides?: Record<number, SlotOverride>;
  weekdayRules?: Record<number, SlotOverride>;
  action: (fd: FormData) => void;
}) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [picker, setPicker] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer'>('cod');
  const [paid, setPaid] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'delivery' | 'pickup'>('delivery');
  const [pickupStore, setPickupStore] = useState<StoreOpt | null>(null);
  const [pickupTime, setPickupTime] = useState('');
  const [address, setAddress] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [error, setError] = useState('');

  const isPickup = deliveryMode === 'pickup';
  const effectiveFee = isPickup ? 0 : (Number(shippingFee) || 0);
  const effectiveAddress = isPickup
    ? (pickupStore ? `Nhận tại cửa hàng: ${pickupStore.name}` : '')
    : address;

  // Compute time slots: priority = day-offset override > weekday rule > store default.
  const timeSlots = useMemo(() => {
    if (!pickupStore) return [];
    const storeTimes = pickupTimesByStore[pickupStore.id] ?? [];
    const slots: string[] = [];
    const today = new Date();
    for (let d = pickupOffset.min; d <= pickupOffset.max; d++) {
      const dayOv = dayOverrides[d];
      if (dayOv?.mode === 'blocked') continue;

      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const weekday = date.getDay();

      const wdRule = dayOv ? undefined : weekdayRules[weekday];
      if (wdRule?.mode === 'blocked') continue;

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const displayDate = `${dd}/${mm}/${yyyy}`;

      const times =
        dayOv?.mode === 'custom' && dayOv.custom_times?.length ? dayOv.custom_times :
        wdRule?.mode === 'custom' && wdRule.custom_times?.length ? wdRule.custom_times :
        storeTimes;
      for (const t of times) slots.push(`${t} - ${displayDate}`);
    }
    return slots;
  }, [pickupStore, pickupTimesByStore, pickupOffset, dayOverrides, weekdayRules]);

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0), [items]);
  const total = subtotal + effectiveFee;

  function addProduct() {
    if (!picker) return;
    const p = products.find((x) => x.id === picker);
    if (!p) return;
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...prev, { productId: p.id, productName: p.name, unitPrice: p.price, quantity: 1 }];
    });
    setPicker('');
  }

  function addCustomLine() {
    setItems((prev) => [...prev, { productId: null, productName: '', unitPrice: 0, quantity: 1 }]);
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const valid = items.filter((it) => it.productName.trim() && it.quantity > 0);
    if (valid.length === 0) {
      e.preventDefault();
      setError('Vui lòng thêm ít nhất một sản phẩm.');
      return;
    }
    if (isPickup && !pickupStore) {
      e.preventDefault();
      setError('Vui lòng chọn cửa hàng nhận hàng.');
      return;
    }
    if (isPickup && timeSlots.length > 0 && !pickupTime) {
      e.preventDefault();
      setError('Vui lòng chọn thời gian nhận hàng.');
      return;
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="admin-form">
      {/* Serialised line items + resolved shipping fields for the server action */}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="shippingAddress" value={effectiveAddress} />
      <input type="hidden" name="shippingFee" value={effectiveFee} />
      <input type="hidden" name="pickupTime" value={isPickup ? pickupTime : ''} />

      <div className="admin-form__grid">
        <div className="admin-form__field">
          <label className="admin-form__label">Tên khách hàng *</label>
          <input name="customerName" required className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Số điện thoại *</label>
          <input name="customerPhone" required className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Email</label>
          <input name="customerEmail" type="email" className="admin-form__input" />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__label">Hình thức nhận hàng</label>
          <select
            className="admin-form__select"
            value={deliveryMode}
            onChange={(e) => setDeliveryMode(e.target.value as 'delivery' | 'pickup')}
          >
            <option value="delivery">Giao tận nơi</option>
            <option value="pickup">Nhận tại cửa hàng</option>
          </select>
        </div>

        {isPickup ? (
          <>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Cửa hàng nhận *</label>
              <select
                className="admin-form__select"
                value={pickupStore?.id ?? ''}
                onChange={(e) => {
                  const found = stores.find((s) => s.id === e.target.value) ?? null;
                  setPickupStore(found);
                  setPickupTime('');
                }}
                required
              >
                <option value="">Chọn cửa hàng…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {stores.length === 0 && (
                <span style={{ fontSize: 12, color: '#d97706' }}>
                  Chưa có cửa hàng nào — thêm ở Settings → Điểm lấy hàng.
                </span>
              )}
            </div>
            {pickupStore && (
              <div className="admin-form__field admin-form__field--full">
                <label className="admin-form__label">
                  Thời gian nhận{timeSlots.length > 0 ? ' *' : ''}
                </label>
                {timeSlots.length > 0 ? (
                  <select
                    className="admin-form__select"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                  >
                    <option value="">Chọn thời gian…</option>
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      className="admin-form__input"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      placeholder="VD: 8h30 - 10/07/2026 (chưa cấu hình khung giờ)"
                    />
                    <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, display: 'block' }}>
                      Cửa hàng này chưa có khung giờ — thêm ở Settings → Thời gian lấy hàng.
                    </span>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="admin-form__field">
              <label className="admin-form__label">Phí giao hàng</label>
              <input
                type="number" min={0} className="admin-form__input"
                value={shippingFee}
                onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
              />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Địa chỉ giao</label>
              <input
                className="admin-form__input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="admin-form__field">
          <label className="admin-form__label">Phương thức thanh toán</label>
          <select
            name="paymentMethod" className="admin-form__select"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as 'cod' | 'bank_transfer')}
          >
            <option value="cod">COD - Thu tiền khi giao</option>
            <option value="bank_transfer">Chuyển khoản / QR</option>
          </select>
        </div>
        <div className="admin-form__field admin-form__field--checks">
          {paymentMethod === 'bank_transfer' ? (
            <label className="admin-form__check">
              <input type="checkbox" name="paid" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Đã thanh toán
            </label>
          ) : (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>COD: thu tiền khi giao (chưa thanh toán)</span>
          )}
        </div>
      </div>

      {/* Line items */}
      <h3 className="admin-section__heading" style={{ marginTop: 16 }}>Sản phẩm</h3>
      <div className="admin-inline-form" style={{ marginBottom: 10 }}>
        <select className="admin-form__select" value={picker} onChange={(e) => setPicker(e.target.value)} style={{ minWidth: 260 }}>
          <option value="">Chọn sản phẩm…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}{p.stock != null ? ` (tồn ${p.stock})` : ''}</option>
          ))}
        </select>
        <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={addProduct}>+ Thêm</button>
        <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={addCustomLine}>+ Dòng tùy chỉnh</button>
      </div>

      {items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Sản phẩm</th><th>Đơn giá</th><th>SL</th><th>Thành tiền</th><th></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="admin-form__input" value={it.productName}
                      onChange={(e) => updateItem(i, { productName: e.target.value })}
                      placeholder="Tên sản phẩm"
                    />
                  </td>
                  <td>
                    <input
                      className="admin-form__input" type="number" min={0} style={{ width: 110 }}
                      value={it.unitPrice}
                      onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      className="admin-form__input" type="number" min={1} style={{ width: 70 }}
                      value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td>{fmt(it.unitPrice * it.quantity)}</td>
                  <td>
                    <button type="button" className="admin-btn admin-btn--sm" style={{ color: '#dc2626' }} onClick={() => removeItem(i)}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-detail-rows" style={{ marginTop: 12, maxWidth: 320 }}>
        <div className="admin-detail-row"><span>Tạm tính</span><strong>{fmt(subtotal)}</strong></div>
        <div className="admin-detail-row"><span>Phí giao hàng</span><strong>{isPickup ? 'Miễn phí (nhận tại cửa hàng)' : fmt(effectiveFee)}</strong></div>
        <div className="admin-detail-row" style={{ fontWeight: 700 }}><span>Tổng cộng</span><strong>{fmt(total)}</strong></div>
      </div>

      <div className="admin-form__field admin-form__field--full" style={{ marginTop: 12 }}>
        <label className="admin-form__label">Ghi chú nội bộ</label>
        <textarea name="adminNote" rows={2} className="admin-form__textarea" />
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary">Tạo đơn hàng</button>
        <a href="/admin/orders" className="admin-btn admin-btn--ghost">Hủy</a>
      </div>
    </form>
  );
}
