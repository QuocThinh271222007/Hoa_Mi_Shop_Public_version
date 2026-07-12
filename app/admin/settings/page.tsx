import { requireAdmin } from '@/lib/admin/auth-check';
import { getSiteSettings, getLocationOptions, getSettingsMap, getPickupDayOverrides, getPickupWeekdayRules } from '@/lib/admin/settings-data';
import { BANK_OPTIONS } from '@/lib/payments/banks';
import { SUPPORTED_TIME_ZONES, DEFAULT_TIME_ZONE } from '@/lib/time';
import { AdminShell } from '../_components/AdminShell';
import {
  actionSaveSettings, actionCreateLocation, actionDeleteLocation,
  actionUpsertPickupDayOverride, actionDeletePickupDayOverride,
  actionUpsertPickupWeekdayRule, actionDeletePickupWeekdayRule,
} from './actions';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const [allSettings, provinces, stores, pickupTimes, pickupOffsetMap, dayOverrides, weekdayRules] = await Promise.all([
    getSiteSettings(['checkout', 'bank', 'shipping', 'time']),
    getLocationOptions('province'),
    getLocationOptions('store'),
    getLocationOptions('pickup_time'),
    getSettingsMap(['pickup_offset_min_days', 'pickup_offset_max_days']),
    getPickupDayOverrides().catch(() => []),
    getPickupWeekdayRules().catch(() => []),
  ]);

  // Group pick-up times under their store (parent_id).
  const timesByStore = new Map<string, typeof pickupTimes>();
  for (const t of pickupTimes) {
    const key = t.parent_id ?? '';
    if (!timesByStore.has(key)) timesByStore.set(key, []);
    timesByStore.get(key)!.push(t);
  }
  const pickupOffsetMin = pickupOffsetMap['pickup_offset_min_days'] || '2';
  const pickupOffsetMax = pickupOffsetMap['pickup_offset_max_days'] || '3';

  const checkoutSettings = allSettings.filter((s) => s.group_name === 'checkout');
  const bankSettings     = allSettings.filter((s) => s.group_name === 'bank');
  const shippingSettings = allSettings.filter((s) => s.group_name === 'shipping');
  const timeSettings     = allSettings.filter((s) => s.group_name === 'time');

  const timeMap: Record<string, string> = {};
  for (const s of timeSettings) timeMap[s.key] = s.value ?? '';
  const currentTimeZone = timeMap['site_timezone'] || DEFAULT_TIME_ZONE;

  // Build a lookup map for bank settings
  const bankMap: Record<string, string> = {};
  for (const s of bankSettings) bankMap[s.key] = s.value ?? '';

  // Bank-group keys that get custom UI (excluded from the generic loop)
  const CUSTOM_BANK_KEYS = new Set([
    'checkout_bank_id',
    'checkout_bank_name',
    'checkout_bank_account_number',
    'checkout_bank_account_name',
    'checkout_bank_branch',
    'checkout_bank_qr_template',
  ]);
  const genericBankSettings = bankSettings.filter((s) => !CUSTOM_BANK_KEYS.has(s.key));

  const currentBankId = bankMap['checkout_bank_id'] || '970403';

  return (
    <AdminShell email={email} activePath="/admin/settings">
      <header className="admin-header">
        <h1 className="admin-header__title">Settings</h1>
        <p className="admin-header__subtitle">Cài đặt checkout và địa chỉ</p>
      </header>

      {sp.success && <div className="admin-banner">✓ Đã lưu cài đặt.</div>}
      {sp.error   && <div className="admin-banner admin-banner--error">⚠️ {decodeURIComponent(sp.error)}</div>}

      {/* Bank Payment Settings — uses checkout_bank_id (BIN) for VietQR URL */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Cài đặt thanh toán ngân hàng</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Bank ID (BIN) được dùng trong URL VietQR để tạo mã QR động. Tên hiển thị là tên ngân hàng hiển thị cho khách.
        </p>
        <form action={actionSaveSettings} className="admin-form">
          <div className="admin-form__grid">
            {/* Bank selector — saves checkout_bank_id (BIN) */}
            <div className="admin-form__field">
              <label className="admin-form__label">Ngân hàng (Bank ID / BIN)</label>
              <select
                name="setting_checkout_bank_id"
                defaultValue={currentBankId}
                className="admin-form__input"
              >
                {BANK_OPTIONS.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.shortName} — {bank.id} ({bank.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Display name shown to customers */}
            <div className="admin-form__field">
              <label className="admin-form__label">Tên ngân hàng hiển thị</label>
              <input
                name="setting_checkout_bank_name"
                type="text"
                defaultValue={bankMap['checkout_bank_name'] ?? ''}
                placeholder="Sacombank"
                className="admin-form__input"
              />
            </div>

            {/* Account number */}
            <div className="admin-form__field">
              <label className="admin-form__label">Số tài khoản</label>
              <input
                name="setting_checkout_bank_account_number"
                type="text"
                defaultValue={bankMap['checkout_bank_account_number'] ?? ''}
                placeholder="Nhập số tài khoản"
                className="admin-form__input"
              />
            </div>

            {/* Account holder */}
            <div className="admin-form__field">
              <label className="admin-form__label">Tên chủ tài khoản</label>
              <input
                name="setting_checkout_bank_account_name"
                type="text"
                defaultValue={bankMap['checkout_bank_account_name'] ?? ''}
                placeholder="NGUYEN VAN A"
                className="admin-form__input"
              />
            </div>

            {/* Branch */}
            <div className="admin-form__field">
              <label className="admin-form__label">Chi nhánh</label>
              <input
                name="setting_checkout_bank_branch"
                type="text"
                defaultValue={bankMap['checkout_bank_branch'] ?? ''}
                className="admin-form__input"
              />
            </div>

            {/* QR template */}
            <div className="admin-form__field">
              <label className="admin-form__label">QR template</label>
              <select
                name="setting_checkout_bank_qr_template"
                defaultValue={bankMap['checkout_bank_qr_template'] || 'compact2'}
                className="admin-form__input"
              >
                <option value="compact2">compact2 (mặc định)</option>
                <option value="compact">compact</option>
                <option value="qr_only">qr_only</option>
              </select>
            </div>
          </div>

          {/* Remaining bank-group fields not handled above */}
          {genericBankSettings.length > 0 && (
            <div className="admin-form__grid" style={{ marginTop: 12 }}>
              {genericBankSettings.map((s) => (
                <div key={s.key} className={`admin-form__field${s.type === 'textarea' ? ' admin-form__field--full' : ''}`}>
                  <label className="admin-form__label">{s.label ?? s.key}</label>
                  {s.type === 'textarea' ? (
                    <textarea name={`setting_${s.key}`} rows={3} defaultValue={s.value ?? ''} className="admin-form__textarea" />
                  ) : (
                    <input name={`setting_${s.key}`} type={s.type === 'number' ? 'number' : 'text'} defaultValue={s.value ?? ''} className="admin-form__input" />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Lưu cài đặt ngân hàng</button>
          </div>
        </form>
      </section>

      {/* Other checkout settings (shipping fee, expiry, instructions, etc.) */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Cài đặt Checkout</h2>
        {checkoutSettings.length === 0 ? (
          <div className="admin-banner">Chưa có cài đặt. Chạy migration SQL trước.</div>
        ) : (
          <form action={actionSaveSettings} className="admin-form">
            <div className="admin-form__grid">
              {checkoutSettings.map((s) => (
                <div key={s.key} className={`admin-form__field${s.type === 'textarea' ? ' admin-form__field--full' : ''}`}>
                  <label className="admin-form__label">{s.label ?? s.key}</label>
                  {s.type === 'textarea' ? (
                    <textarea
                      name={`setting_${s.key}`}
                      rows={3}
                      defaultValue={s.value ?? ''}
                      className="admin-form__textarea"
                    />
                  ) : (
                    <input
                      name={`setting_${s.key}`}
                      type={s.type === 'number' ? 'number' : 'text'}
                      defaultValue={s.value ?? ''}
                      className="admin-form__input"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="admin-form__actions">
              <button type="submit" className="admin-btn admin-btn--primary">Lưu cài đặt</button>
            </div>
          </form>
        )}
      </section>

      {/* Shipping settings */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Vận chuyển</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Phí giao được tính lại trên server khi tạo đơn — khách không thể sửa. Phí nội thành
          TP.HCM và tỉnh khác được chọn theo địa chỉ giao hàng.
        </p>
        {shippingSettings.length === 0 ? (
          <div className="admin-banner">Chưa có cài đặt vận chuyển. Chạy migration <code>20260624_shipping_discount_time_settings.sql</code>.</div>
        ) : (
          <form action={actionSaveSettings} className="admin-form">
            <div className="admin-form__grid">
              {shippingSettings.map((s) => (
                <div key={s.key} className="admin-form__field">
                  <label className="admin-form__label">{s.label ?? s.key}</label>
                  <input
                    name={`setting_${s.key}`}
                    type={s.type === 'number' ? 'number' : 'text'}
                    defaultValue={s.value ?? ''}
                    className="admin-form__input"
                  />
                </div>
              ))}
            </div>
            <div className="admin-form__actions">
              <button type="submit" className="admin-btn admin-btn--primary">Lưu cài đặt vận chuyển</button>
            </div>
          </form>
        )}
      </section>

      {/* Time / timezone settings */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Thời gian</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Múi giờ dùng cho hiển thị ngày giờ và tính ngày giao dự kiến. Mặc định giờ Việt Nam (UTC+7).
        </p>
        {timeSettings.length === 0 ? (
          <div className="admin-banner">Chưa có cài đặt thời gian. Chạy migration <code>20260624_shipping_discount_time_settings.sql</code>.</div>
        ) : (
          <form action={actionSaveSettings} className="admin-form">
            <div className="admin-form__grid">
              <div className="admin-form__field">
                <label className="admin-form__label">Múi giờ hệ thống</label>
                <select name="setting_site_timezone" defaultValue={currentTimeZone} className="admin-form__input">
                  {SUPPORTED_TIME_ZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              {timeSettings.filter((s) => s.key !== 'site_timezone').map((s) => (
                <div key={s.key} className="admin-form__field">
                  <label className="admin-form__label">{s.label ?? s.key}</label>
                  <input
                    name={`setting_${s.key}`}
                    type={s.type === 'number' ? 'number' : 'text'}
                    defaultValue={s.value ?? ''}
                    className="admin-form__input"
                  />
                </div>
              ))}
            </div>
            <div className="admin-form__actions">
              <button type="submit" className="admin-btn admin-btn--primary">Lưu cài đặt thời gian</button>
            </div>
          </form>
        )}
      </section>

      {/* Pick-up store locations */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Điểm lấy hàng (Pick up)</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Danh sách cửa hàng khách có thể chọn khi đặt đơn ở chế độ &quot;Pick up&quot;. Nhập địa chỉ đầy đủ vào ô Tên.
          Chỉ các điểm đang bật (Active) mới hiển thị ở trang checkout.
        </p>

        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead><tr><th>Địa chỉ</th><th>Thứ tự</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {stores.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>Chưa có điểm lấy hàng nào.</td></tr>
              ) : (
                stores.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.sort_order}</td>
                    <td>{s.is_active ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>
                      <form action={actionDeleteLocation} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="admin-link" style={{ color: '#dc2626' }}>Xóa</button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form action={actionCreateLocation} className="admin-inline-form">
          <input type="hidden" name="type" value="store" />
          <input name="name" className="admin-form__input" placeholder="Địa chỉ cửa hàng (vd: 279 Nguyễn Tri Phương, Q10, TP.HCM)" style={{ flex: 1, minWidth: 240 }} required />
          <input name="sort_order" type="number" className="admin-form__input admin-form__input--sm" placeholder="Thứ tự" style={{ width: 70 }} />
          <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">+ Thêm</button>
        </form>
      </section>

      {/* Pick-up: date offset + per-store time slots */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Thời gian lấy hàng (Pick up)</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Chỉ nhập <strong>GIỜ</strong> (vd &quot;8h30&quot;). Ngày được tính theo thời gian thực:
          hôm nay + độ lệch bên dưới. Mỗi cửa hàng có khung giờ riêng.
        </p>

        {/* Date offset (min–max days) */}
        <form action={actionSaveSettings} className="admin-form" style={{ marginBottom: 20 }}>
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label className="admin-form__label">Độ lệch ngày — tối thiểu (ngày)</label>
              <input name="setting_pickup_offset_min_days" type="number" min={0} defaultValue={pickupOffsetMin} className="admin-form__input" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Độ lệch ngày — tối đa (ngày)</label>
              <input name="setting_pickup_offset_max_days" type="number" min={0} defaultValue={pickupOffsetMax} className="admin-form__input" />
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Lưu độ lệch ngày</button>
          </div>
        </form>

        {/* Per-store time slots */}
        {stores.length === 0 ? (
          <div className="admin-banner">Thêm điểm lấy hàng ở mục trên trước, rồi thêm khung giờ cho từng cửa hàng.</div>
        ) : (
          stores.map((s) => {
            const times = timesByStore.get(s.id) ?? [];
            return (
              <div key={s.id} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>{s.name}</p>
                {times.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>Chưa có khung giờ.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {times.map((t) => (
                      <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fce7f3', borderRadius: 999, padding: '4px 8px 4px 12px', fontSize: 13 }}>
                        {t.name}
                        <form action={actionDeleteLocation} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className="admin-link" style={{ color: '#c0392b' }} aria-label="Xóa">✕</button>
                        </form>
                      </span>
                    ))}
                  </div>
                )}
                <form action={actionCreateLocation} className="admin-inline-form">
                  <input type="hidden" name="type" value="pickup_time" />
                  <input type="hidden" name="parent_id" value={s.id} />
                  <input name="name" className="admin-form__input admin-form__input--sm" placeholder="Giờ (vd: 8h30)" style={{ width: 120 }} required />
                  <input name="sort_order" type="number" className="admin-form__input admin-form__input--sm" placeholder="Thứ tự" style={{ width: 70 }} />
                  <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">+ Thêm giờ</button>
                </form>
              </div>
            );
          })
        )}
      </section>

      {/* Pickup day-offset overrides */}
      <section className="admin-section" id="pickup-overrides">
        <h2 className="admin-section__heading">Ngày đặc biệt / Ghi đè khung giờ</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
          Chặn hoặc đổi khung giờ theo <strong>vị trí trong cửa sổ offset</strong> (tính từ hôm nay).
          Ví dụ: offset min=1, max=7 — nhập <strong>3</strong> để áp dụng cho ngày hôm nay+3.
          Áp dụng cho tất cả cửa hàng, tự tính toán theo thời gian thực.
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Offset hiện tại: <strong>min = {pickupOffsetMin}</strong>, <strong>max = {pickupOffsetMax}</strong> ngày.
          Giá trị hợp lệ: {pickupOffsetMin}–{pickupOffsetMax}.
        </p>

        {/* Existing overrides */}
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Offset (ngày)</th>
                <th>Chế độ</th>
                <th>Khung giờ tùy chỉnh</th>
                <th>Ghi chú</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dayOverrides.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>
                    Chưa có ghi đè nào.
                  </td>
                </tr>
              ) : (
                dayOverrides.map((ov) => (
                  <tr key={ov.id}>
                    <td style={{ fontWeight: 600 }}>Ngày +{ov.day_offset}</td>
                    <td>
                      {ov.mode === 'blocked' ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>🚫 Chặn</span>
                      ) : (
                        <span style={{ color: '#7c3aed', fontWeight: 600 }}>🕐 Đổi giờ</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {ov.mode === 'custom' && ov.custom_times?.length
                        ? ov.custom_times.join(', ')
                        : '–'}
                    </td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{ov.note ?? '–'}</td>
                    <td>
                      <form action={actionDeletePickupDayOverride} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={ov.id} />
                        <button type="submit" className="admin-link" style={{ color: '#dc2626' }}>
                          Xóa
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Upsert override — nhập offset number, không phải ngày cố định */}
        <form action={actionUpsertPickupDayOverride} className="admin-form">
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label className="admin-form__label">
                Offset (ngày từ hôm nay) *
                <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
                  [{pickupOffsetMin}–{pickupOffsetMax}]
                </span>
              </label>
              <input
                name="day_offset"
                type="number"
                min={pickupOffsetMin}
                max={pickupOffsetMax}
                required
                className="admin-form__input"
                placeholder={`VD: ${pickupOffsetMin}`}
              />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Chế độ *</label>
              <select name="mode" className="admin-form__input" defaultValue="blocked">
                <option value="blocked">🚫 Chặn ngày (không nhận đơn)</option>
                <option value="custom">🕐 Đổi khung giờ</option>
              </select>
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">
                Khung giờ tùy chỉnh{' '}
                <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                  (chỉ dùng khi chế độ = Đổi giờ — phân cách bằng dấu phẩy, VD: 9h00, 15h30)
                </span>
              </label>
              <input
                name="custom_times"
                className="admin-form__input"
                placeholder="9h00, 15h30, 17h00"
              />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Ghi chú nội bộ</label>
              <input name="note" className="admin-form__input" placeholder="VD: Nghỉ lễ, sự kiện..." />
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
            Nếu offset đã tồn tại sẽ được ghi đè (upsert).
          </p>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">+ Lưu ghi đè</button>
          </div>
        </form>
      </section>

      {/* Pickup weekday rules */}
      <section className="admin-section" id="pickup-weekdays">
        <h2 className="admin-section__heading">Chặn / Đổi giờ theo thứ hằng tuần</h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Áp dụng lặp lại mỗi tuần. Nếu ngày đó cũng có ghi đè offset thì <strong>offset ưu tiên hơn</strong>.
        </p>

        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr><th>Thứ</th><th>Chế độ</th><th>Khung giờ tùy chỉnh</th><th>Ghi chú</th><th></th></tr>
            </thead>
            <tbody>
              {weekdayRules.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>
                    Chưa có quy tắc nào.
                  </td>
                </tr>
              ) : (
                weekdayRules.map((wr) => {
                  const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                  return (
                    <tr key={wr.id}>
                      <td style={{ fontWeight: 600 }}>{WEEKDAY_LABELS[wr.weekday]}</td>
                      <td>
                        {wr.mode === 'blocked'
                          ? <span style={{ color: '#dc2626', fontWeight: 600 }}>🚫 Chặn</span>
                          : <span style={{ color: '#7c3aed', fontWeight: 600 }}>🕐 Đổi giờ</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {wr.mode === 'custom' && wr.custom_times?.length ? wr.custom_times.join(', ') : '–'}
                      </td>
                      <td style={{ fontSize: 13, color: '#6b7280' }}>{wr.note ?? '–'}</td>
                      <td>
                        <form action={actionDeletePickupWeekdayRule} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={wr.id} />
                          <button type="submit" className="admin-link" style={{ color: '#dc2626' }}>Xóa</button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <form action={actionUpsertPickupWeekdayRule} className="admin-form">
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label className="admin-form__label">Thứ *</label>
              <select name="weekday" className="admin-form__input" defaultValue="2">
                <option value="0">Chủ nhật</option>
                <option value="1">Thứ 2</option>
                <option value="2">Thứ 3</option>
                <option value="3">Thứ 4</option>
                <option value="4">Thứ 5</option>
                <option value="5">Thứ 6</option>
                <option value="6">Thứ 7</option>
              </select>
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Chế độ *</label>
              <select name="mode" className="admin-form__input" defaultValue="blocked">
                <option value="blocked">🚫 Chặn (không nhận đơn)</option>
                <option value="custom">🕐 Đổi khung giờ</option>
              </select>
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">
                Khung giờ tùy chỉnh{' '}
                <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                  (chỉ dùng khi chế độ = Đổi giờ — phân cách bằng dấu phẩy, VD: 9h00, 15h30)
                </span>
              </label>
              <input name="custom_times" className="admin-form__input" placeholder="9h00, 15h30" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Ghi chú nội bộ</label>
              <input name="note" className="admin-form__input" placeholder="VD: Nghỉ cố định thứ 3, 5..." />
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
            Nếu thứ đó đã tồn tại sẽ được ghi đè (upsert).
          </p>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">+ Lưu quy tắc</button>
          </div>
        </form>
      </section>

      {/* Provinces / Cities */}
      <section className="admin-section">
        <h2 className="admin-section__heading">Tỉnh / Thành phố</h2>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
          Danh sách này được dùng trong trang checkout (Phase 2 wiring).
          Hiện tại checkout dùng danh sách hardcoded — cập nhật tại đây sẽ cần thêm 1 bước nối dây.
        </p>

        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead><tr><th>Tên</th><th>Thứ tự</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {provinces.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>Chưa có. Chạy migration SQL để seed.</td></tr>
              ) : (
                provinces.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sort_order}</td>
                    <td>{p.is_active ? <span className="admin-check">✓</span> : <span className="admin-dash">–</span>}</td>
                    <td>
                      <form action={actionDeleteLocation} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="admin-link" style={{ color: '#dc2626' }}>Xóa</button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form action={actionCreateLocation} className="admin-inline-form">
          <input type="hidden" name="type" value="province" />
          <input name="name" className="admin-form__input admin-form__input--sm" placeholder="Tên tỉnh/thành" required />
          <input name="sort_order" type="number" className="admin-form__input admin-form__input--sm" placeholder="Thứ tự" style={{ width: 70 }} />
          <button type="submit" className="admin-btn admin-btn--sm admin-btn--primary">+ Thêm</button>
        </form>
      </section>
    </AdminShell>
  );
}
