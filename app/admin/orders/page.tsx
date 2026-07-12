import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth-check";
import { getOrders } from "@/lib/admin/orders-data";
import {
  getAdminOrderStatusLabel,
  isCodOrder,
} from "@/lib/orders/status-mapping";
import { formatDateVN } from "@/lib/time";
import { AdminShell } from "../_components/AdminShell";
import { StatusBadge } from "../_components/StatusBadge";
import { DeleteOrderButton } from "./DeleteOrderButton";

function formatVND(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

const ORDER_STATUSES = [
  "all",
  "pending",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
];
const PAYMENT_STATUSES = [
  "all",
  "awaiting_payment",
  "awaiting_verification",
  "paid",
  "failed",
];
const METHODS: { value: string; label: string }[] = [
  { value: "all", label: "Tất cả thanh toán" },
  { value: "cod", label: "COD" },
  { value: "bank_transfer", label: "Chuyển khoản / QR" },
];
const DELIVERY_MODES: { value: string; label: string }[] = [
  { value: "all", label: "Tất cả giao hàng" },
  { value: "delivery", label: "Giao tận nơi" },
  { value: "pickup", label: "Nhận tại cửa hàng" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    payment?: string;
    method?: string;
    delivery?: string;
    q?: string;
    from?: string;
    to?: string;
    pickupDate?: string;
    pickupFrom?: string;
    pickupTo?: string;
  }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;

  const orders = await getOrders({
    status: sp.status,
    paymentStatus: sp.payment,
    method: sp.method,
    delivery: sp.delivery,
    search: sp.q,
    dateFrom: sp.from,
    dateTo: sp.to,
    pickupDate: sp.pickupDate,
    pickupTimeFrom: sp.pickupFrom,
    pickupTimeTo: sp.pickupTo,
  });

  return (
    <AdminShell email={email} activePath="/admin/orders">
      <header className="admin-header">
        <h1 className="admin-header__title">Orders</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p className="admin-header__subtitle">{orders.length} đơn hàng</p>
          <a
            href="/admin/orders/new"
            className="admin-btn admin-btn--sm admin-btn--primary"
          >
            + Tạo đơn
          </a>
          <a
            href="/api/admin/orders/export"
            className="admin-btn admin-btn--sm admin-btn--ghost"
          >
            Export CSV
          </a>
        </div>
      </header>

      {/* Filters */}
      <form method="get" className="admin-filter-bar">
        <input
          name="q"
          className="admin-form__input admin-form__input--sm"
          placeholder="Tìm theo tên, SĐT, mã đơn..."
          defaultValue={sp.q ?? ""}
          style={{ width: 220 }}
        />
        <label
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}
        >
          Từ
          <input
            type="date"
            name="from"
            className="admin-form__input admin-form__input--sm"
            defaultValue={sp.from ?? ""}
          />
        </label>
        <label
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}
        >
          Đến
          <input
            type="date"
            name="to"
            className="admin-form__input admin-form__input--sm"
            defaultValue={sp.to ?? ""}
          />
        </label>
        <label
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}
        >
          Lấy hàng: ngày
          <input
            type="date"
            name="pickupDate"
            className="admin-form__input admin-form__input--sm"
            defaultValue={sp.pickupDate ?? ""}
          />
        </label>
        <label
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}
        >
          giờ
          <input
            type="time"
            name="pickupFrom"
            className="admin-form__input admin-form__input--sm"
            defaultValue={sp.pickupFrom ?? ""}
            step={60}
          />
          –
          <input
            type="time"
            name="pickupTo"
            className="admin-form__input admin-form__input--sm"
            defaultValue={sp.pickupTo ?? ""}
            step={60}
          />
        </label>
        <select
          name="status"
          className="admin-form__select"
          defaultValue={sp.status ?? "all"}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "Tất cả trạng thái" : s}
            </option>
          ))}
        </select>
        <select
          name="payment"
          className="admin-form__select"
          defaultValue={sp.payment ?? "all"}
        >
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "Tất cả thanh toán" : s}
            </option>
          ))}
        </select>
        <select
          name="method"
          className="admin-form__select"
          defaultValue={sp.method ?? "all"}
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          name="delivery"
          className="admin-form__select"
          defaultValue={sp.delivery ?? "all"}
        >
          {DELIVERY_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="admin-btn admin-btn--sm admin-btn--primary"
        >
          Lọc
        </button>
        <a
          href="/admin/orders"
          className="admin-btn admin-btn--sm admin-btn--ghost"
        >
          Xóa lọc
        </a>
      </form>

      <section className="admin-section">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>SĐT</th>
                <th>Tổng</th>
                <th>Thanh toán</th>
                <th>Giao hàng</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Ngày</th>
                <th>Giờ lấy hàng</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    style={{ textAlign: "center", padding: 24, color: "#bbb" }}
                  >
                    Không có đơn hàng
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "monospace",
                      }}
                    >
                      {o.payment_code ?? `${o.id.slice(0, 8)}…`}
                    </td>
                    <td>
                      <span style={{ display: "block" }}>{o.customer_name}</span>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: o.user_id ? "#e0f2fe" : "#fef3c7",
                          color: o.user_id ? "#075985" : "#92400e",
                        }}
                      >
                        {o.user_id ? "Web" : "Tạo đơn"}
                      </span>
                    </td>
                    <td>{o.customer_phone}</td>
                    <td>{formatVND(o.total_amount ?? o.subtotal)}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: isCodOrder(o) ? "#fef3c7" : "#e0f2fe",
                          color: isCodOrder(o) ? "#92400e" : "#075985",
                        }}
                      >
                        {isCodOrder(o) ? "COD" : "QR"}
                      </span>
                    </td>
                    <td>
                      {(o as unknown as { pickup_time?: string | null })
                        .pickup_time ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#f3e8ff",
                            color: "#7e22ce",
                          }}
                        >
                          Tại cửa hàng
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#ecfdf5",
                            color: "#065f46",
                          }}
                        >
                          Giao hàng
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                      <span
                        style={{
                          display: "block",
                          fontSize: 10,
                          color: "#9ca3af",
                          marginTop: 2,
                        }}
                      >
                        {getAdminOrderStatusLabel(o)}
                      </span>
                      {o.cancel_requested_at && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 3,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "#fee2e2",
                            color: "#b91c1c",
                          }}
                        >
                          ⚠ Khách yêu cầu hủy
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={o.payment_status ?? "pending"} />
                    </td>
                    <td>{formatDateVN(o.created_at)}</td>
                    <td>
                      {(o as unknown as { pickup_time?: string | null })
                        .pickup_time ? (
                        <span style={{ fontSize: 12, color: "#7e22ce", fontWeight: 600 }}>
                          {
                            (o as unknown as { pickup_time?: string | null })
                              .pickup_time
                          }
                        </span>
                      ) : (
                        <span style={{ color: "#d1d5db" }}>—</span>
                      )}
                    </td>
                    <td
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="admin-link"
                      >
                        Chi tiết
                      </Link>
                      <DeleteOrderButton
                        orderId={o.id}
                        label={o.payment_code ?? o.id.slice(0, 8)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
