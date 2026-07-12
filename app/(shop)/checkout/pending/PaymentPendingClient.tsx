"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/demo-products";
import { clearCart } from "@/lib/shop/cart-store";

// ── Types ──

type CheckoutStoredData = {
  orderId: string;
  paymentRequestId: string | null;
  paymentCode: string;
  amount: number;
  subtotal: number;
  shippingFee: number;
  shippingDiscount: number;
  productDiscount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  qrImageUrl: string | null;
  cartItems: Array<{
    name: string;
    price: number;
    quantity: number;
    image: string;
  }>;
};

type QrDisplayData = {
  paymentCode: string;
  codeSignature?: string | null;
  amount: number;
  subtotal: number;
  shippingFee: number;
  shippingDiscount: number;
  productDiscount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  qrImageUrl: string | null;
  cartItems: Array<{
    name: string;
    price: number;
    quantity: number;
    image: string;
  }>;
};

type QrPendingStore = {
  createdAt?: number; // ms since epoch; used to expire stale sessions
  formData: Record<string, unknown>;
  display: QrDisplayData;
};

// ── Helpers ──

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════
// QR-NEW mode — order does NOT exist yet in DB.
// Created only when customer clicks "Tôi đã chuyển khoản".
// ══════════════════════════════════════════════════════════
function QrNewPending() {
  const router = useRouter();
  const [pending, setPending] = useState<QrPendingStore | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<
    "idle" | "submitting" | "not_paid" | "wrong_content" | "error"
  >("idle");
  const [confirmMessage, setConfirmMessage] = useState("");

  // Red for "chưa thanh toán" / lỗi; amber for "sai nội dung".
  const confirmColor =
    confirmStatus === "wrong_content" ? "#b45309" : "#dc2626";

  const QR_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cuc_qr_pending_v1");
      if (!raw) return;
      const parsed: QrPendingStore = JSON.parse(raw);
      // Expire stale sessions — prices/discounts may have changed after 24h.
      if (parsed.createdAt && Date.now() - parsed.createdAt > QR_MAX_AGE_MS) {
        localStorage.removeItem("cuc_qr_pending_v1");
        setConfirmStatus("error");
        setConfirmMessage(
          "Phiên thanh toán đã hết hạn (quá 24 giờ). Vui lòng đặt lại đơn hàng.",
        );
        return;
      }
      setPending(parsed);
    } catch {
      /* corrupted */
    }
  }, []);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {});
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    setConfirmStatus("submitting");
    setConfirmMessage("");

    try {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pending.formData,
          paymentCode: pending.display.paymentCode,
          codeSignature: pending.display.codeSignature ?? undefined,
        }),
      });
      const data = await res.json();

      // Paid → order created, go to success (green).
      if (res.ok && data.ok && data.status === "paid") {
        try {
          localStorage.removeItem("cuc_qr_pending_v1");
        } catch {
          /* ignore */
        }
        clearCart();
        router.push(
          data.redirectTo ?? `/checkout/success?orderId=${data.orderId}`,
        );
        return;
      }

      // No matching transfer → red "chưa thanh toán".
      if (data.status === "not_paid") {
        setConfirmStatus("not_paid");
        setConfirmMessage(
          data.message ?? "Chưa ghi nhận được giao dịch. Vui lòng thử lại.",
        );
        return;
      }

      // Transfer found but memo/amount wrong → amber "sai nội dung".
      if (data.status === "wrong_content") {
        setConfirmStatus("wrong_content");
        setConfirmMessage(
          data.message ??
            "Giao dịch chưa khớp. Vui lòng liên hệ admin hoặc fanpage.",
        );
        return;
      }

      // Anything else (server error, auth, etc.)
      setConfirmStatus("error");
      setConfirmMessage(
        data.error ??
          data.message ??
          "Không thể xác nhận. Vui lòng thử lại hoặc liên hệ hỗ trợ.",
      );
    } catch {
      setConfirmStatus("error");
      setConfirmMessage("Lỗi kết nối. Vui lòng thử lại hoặc liên hệ hỗ trợ.");
    }
  }, [pending, router]);

  const d = pending?.display;

  if (!d) {
    return (
      <main className="checkout-page">
        <div className="checkout-page__inner">
          <div
            className="checkout-page__panel"
            style={{ maxWidth: 560, margin: "0 auto" }}
          >
            <h1 className="checkout-page__panel-title">
              Đang chờ xác nhận thanh toán
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: "#374151",
                marginBottom: 20,
              }}
            >
              Vui lòng chuyển khoản đúng nội dung và số tiền, sau đó bấm
              &quot;Tôi đã chuyển khoản&quot; để ghi nhận đơn hàng.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="checkout-page__place-order"
                onClick={handleConfirm}
                disabled={confirmStatus === "submitting"}
              >
                {confirmStatus === "submitting"
                  ? "Đang xử lý…"
                  : "Tôi đã chuyển khoản"}
              </button>
              {confirmMessage && (
                <p
                  style={{
                    fontSize: 13,
                    textAlign: "center",
                    color: confirmColor,
                  }}
                  role="alert"
                >
                  {confirmMessage}
                </p>
              )}
              <Link
                href="/collection"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  fontSize: 14,
                  color: "#6b7280",
                  padding: "10px 0",
                }}
              >
                ◀ Tiếp tục mua hàng
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const shippingPayable = Math.max(0, d.shippingFee - d.shippingDiscount);

  return (
    <main className="checkout-page">
      <div className="checkout-page__inner">
        <div className="checkout-page__layout">
          {/* ════════════ LEFT COLUMN ════════════ */}
          <div className="checkout-page__left">
            <div className="checkout-page__panel">
              <p className="checkout-page__pending-order-id">
                Mã chuyển khoản: {d.paymentCode}
              </p>
              <h1 className="checkout-page__panel-title">Chờ thanh toán</h1>
              <div
                className="checkout-page__summary-rows"
                style={{ marginBottom: 20 }}
              >
                <div className="checkout-page__summary-row">
                  <span>Số tiền cần chuyển</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(d.amount)}
                  </span>
                </div>
                <div className="checkout-page__summary-row">
                  <span>Phương thức</span>
                  <span className="checkout-page__summary-val">
                    Chuyển khoản qua QR
                  </span>
                </div>
              </div>

              {/* Transfer info + QR */}
              <div className="checkout-page__transfer-layout">
                <div className="checkout-page__transfer-table-wrap">
                  <h3
                    className="checkout-page__panel-title"
                    style={{
                      fontSize: "clamp(15px, 1.4vw, 18px)",
                      marginBottom: 10,
                    }}
                  >
                    Thông tin chuyển khoản
                  </h3>
                  <table className="checkout-page__transfer-table">
                    <tbody>
                      <tr>
                        <td>Chủ tài khoản</td>
                        <td>
                          <strong>{d.bankAccountName || "—"}</strong>
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td>Ngân hàng</td>
                        <td>
                          <strong>{d.bankName || "—"}</strong>
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td>Số tài khoản</td>
                        <td>
                          <strong>{d.bankAccountNumber || "—"}</strong>
                        </td>
                        <td>
                          <button
                            className="checkout-page__copy-btn"
                            onClick={() =>
                              handleCopy(d.bankAccountNumber, "accno")
                            }
                            title="Copy"
                          >
                            {copied === "accno" ? "✓" : <CopyIcon />}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>Nội dung CK</td>
                        <td>
                          <strong style={{ color: "#1d4ed8" }}>
                            {d.paymentCode}
                          </strong>
                        </td>
                        <td>
                          <button
                            className="checkout-page__copy-btn"
                            onClick={() => handleCopy(d.paymentCode, "note")}
                            title="Copy"
                          >
                            {copied === "note" ? "✓" : <CopyIcon />}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>Số tiền</td>
                        <td>
                          <strong style={{ color: "#dc2626" }}>
                            {d.amount.toLocaleString("vi-VN")}đ
                          </strong>
                        </td>
                        <td>
                          <button
                            className="checkout-page__copy-btn"
                            onClick={() =>
                              handleCopy(String(d.amount), "amount")
                            }
                            title="Copy"
                          >
                            {copied === "amount" ? "✓" : <CopyIcon />}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p
                    style={{
                      fontSize: 15,
                      color: "red",
                      marginBottom: 16,
                      lineHeight: 1.6,
                    }}
                  >
                    Chuyển khoản đúng <strong>số tiền</strong> và{" "}
                    <strong>nội dung</strong> bên dưới, sau đó bấm &quot;Tôi đã
                    chuyển khoản&quot; để tạo đơn hàng.
                  </p>
                </div>

                {d.qrImageUrl && (
                  <div className="checkout-page__qr-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.qrImageUrl}
                      alt="QR chuyển khoản"
                      width={150}
                      height={150}
                      style={{ borderRadius: 8, display: "block" }}
                    />
                  </div>
                )}
              </div>

              {/* Confirm button */}
              <button
                type="button"
                className="checkout-page__place-order"
                style={{ marginTop: 20, fontSize: "clamp(16px, 1.6vw, 22px)" }}
                onClick={handleConfirm}
                disabled={confirmStatus === "submitting"}
              >
                {confirmStatus === "submitting"
                  ? "Đang tạo đơn hàng…"
                  : "Tôi đã chuyển khoản"}
              </button>

              {confirmMessage && (
                <p
                  style={{ fontSize: 13, marginTop: 8, color: confirmColor }}
                  role="alert"
                >
                  {confirmMessage}
                </p>
              )}
            </div>
          </div>

          {/* ════════════ RIGHT COLUMN ════════════ */}
          <div className="checkout-page__right">
            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Your Cart</h2>
              <div className="checkout-page__cart-list">
                {d.cartItems.map((item, idx) => (
                  <div key={idx}>
                    <div className="checkout-page__cart-item">
                      <div className="checkout-page__item-image">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="72px"
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                      <div className="checkout-page__item-info">
                        <p className="checkout-page__item-name">{item.name}</p>
                        <p className="checkout-page__item-price">
                          {formatPrice(item.price)}
                        </p>
                        <p
                          style={{ fontSize: 12, color: "#6b7280", margin: 0 }}
                        >
                          x{item.quantity}
                        </p>
                      </div>
                    </div>
                    {idx < d.cartItems.length - 1 && (
                      <hr className="checkout-page__item-divider" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Order Summary</h2>
              <div className="checkout-page__summary-rows">
                <div className="checkout-page__summary-row">
                  <span>Subtotal</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(d.subtotal)}
                  </span>
                </div>
                {d.productDiscount > 0 && (
                  <div className="checkout-page__summary-row checkout-page__summary-row--discount">
                    <span>Discount</span>
                    <span className="checkout-page__summary-val">
                      −{formatPrice(d.productDiscount)}
                    </span>
                  </div>
                )}
                <div className="checkout-page__summary-row">
                  <span>Shipping fee</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(d.shippingFee)}
                  </span>
                </div>
                {d.shippingDiscount > 0 && (
                  <div className="checkout-page__summary-row checkout-page__summary-row--discount">
                    <span>Miễn phí vận chuyển</span>
                    <span className="checkout-page__summary-val">
                      −{formatPrice(d.shippingDiscount)}
                    </span>
                  </div>
                )}
              </div>
              <div className="checkout-page__summary-total">
                <span>Total amount</span>
                <span>{formatPrice(d.amount)}</span>
              </div>
              {shippingPayable === 0 && d.shippingFee > 0 && (
                <p style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>
                  ✓ Miễn phí vận chuyển đã áp dụng
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href="/collection"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  fontSize: 14,
                  color: "#6b7280",
                  padding: "10px 0",
                }}
              >
                ◀ Tiếp tục mua hàng
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ══════════════════════════════════════════════════════════
// LEGACY mode — order already exists in DB (created before this refactor,
// or for any other legacy path). Keeps the old "report-transfer" flow intact.
// ══════════════════════════════════════════════════════════
function LegacyPending({
  orderId,
  paymentRequestId,
}: {
  orderId: string | null;
  paymentRequestId: string | null;
}) {
  const router = useRouter();
  const [checkoutData, setCheckoutData] = useState<CheckoutStoredData | null>(
    null,
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<
    "idle" | "submitting" | "error" | "failed" | "recorded"
  >("idle");
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    if (!orderId) return;
    try {
      const raw = localStorage.getItem(`cuc_checkout_data_${orderId}`);
      if (raw) setCheckoutData(JSON.parse(raw));
    } catch {
      /* corrupted */
    }
  }, [orderId]);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {});
  }, []);

  const fetchPaymentStatus = useCallback(
    async (oId: string, prId: string | null) => {
      const sp = new URLSearchParams({ orderId: oId });
      if (prId) sp.set("paymentRequestId", prId);
      try {
        const res = await fetch(`/api/payments/status?${sp.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data?.ok ? data : null;
      } catch {
        return null;
      }
    },
    [],
  );

  const handleCustomerReportedTransfer = useCallback(async () => {
    const oId = orderId ?? checkoutData?.orderId;
    const prId = paymentRequestId ?? checkoutData?.paymentRequestId ?? null;
    if (!oId) return;

    setReportStatus("submitting");
    setReportMessage("");

    try {
      const status = await fetchPaymentStatus(oId, prId);

      if (status?.nextAction === "success") {
        router.push(status.redirectTo);
        return;
      }
      if (status?.nextAction === "failed") {
        setReportStatus("failed");
        setReportMessage(
          "Thanh toán đã bị hủy hoặc hết hạn. Vui lòng tạo lại đơn hàng hoặc liên hệ hỗ trợ.",
        );
        return;
      }

      if (status?.paymentMode === "sepay_auto") {
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const polled = await fetchPaymentStatus(oId, prId);
          if (polled?.nextAction === "success") {
            router.push(polled.redirectTo);
            return;
          }
          if (polled?.nextAction === "failed") {
            setReportStatus("failed");
            setReportMessage(
              "Thanh toán đã bị hủy hoặc hết hạn. Vui lòng tạo lại đơn hàng hoặc liên hệ hỗ trợ.",
            );
            return;
          }
        }
      }

      const res = await fetch("/api/payments/report-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: oId, paymentRequestId: prId }),
      });
      const data = await res
        .json()
        .catch(() => ({}) as Record<string, unknown>);

      if (res.ok) {
        if ((data as { state?: string }).state === "already_paid") {
          router.push(
            (data as { redirectTo?: string }).redirectTo ??
              `/checkout/success?orderId=${oId}`,
          );
          return;
        }
        setReportStatus("failed");
        setReportMessage(
          "Chưa xác nhận được giao dịch. Nếu bạn đã chuyển khoản đúng nội dung và số tiền, " +
            "chúng mình sẽ xác nhận trong thời gian sớm nhất; nếu chưa, vui lòng hoàn tất chuyển khoản rồi thử lại.",
        );
        return;
      }

      const errCode = (data as { error?: string }).error;
      if (errCode === "AUTH_REQUIRED") {
        setReportStatus("error");
        setReportMessage("Vui lòng đăng nhập trước khi xác nhận chuyển khoản.");
        return;
      }
      if (errCode === "PAYMENT_NOT_ACTIVE") {
        setReportStatus("failed");
        setReportMessage(
          "Thanh toán đã bị hủy hoặc hết hạn. Vui lòng tạo lại đơn hàng hoặc liên hệ hỗ trợ.",
        );
        return;
      }
      setReportStatus("error");
      setReportMessage(
        "Không thể ghi nhận. Vui lòng thử lại hoặc liên hệ hỗ trợ.",
      );
    } catch {
      setReportStatus("error");
      setReportMessage("Lỗi kết nối. Vui lòng thử lại hoặc liên hệ hỗ trợ.");
    }
  }, [orderId, paymentRequestId, checkoutData, router, fetchPaymentStatus]);

  const displayOrderId =
    checkoutData?.paymentCode?.trim() ||
    (orderId ?? checkoutData?.orderId ?? "").slice(0, 8).toUpperCase();
  const d = checkoutData;

  if (!d) {
    return (
      <main className="checkout-page">
        <div className="checkout-page__inner">
          <div
            className="checkout-page__panel"
            style={{ maxWidth: 560, margin: "0 auto" }}
          >
            <p className="checkout-page__pending-order-id">
              {displayOrderId ? `Order #${displayOrderId}` : ""}
            </p>
            <h1 className="checkout-page__panel-title">
              Đang chờ xác nhận thanh toán
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: "#374151",
                marginBottom: 20,
              }}
            >
              Chúng mình đã ghi nhận đơn hàng của bạn. Vui lòng chuyển khoản
              đúng nội dung và số tiền theo thông tin đã được gửi. Sau khi xác
              nhận, trạng thái sẽ cập nhật trong{" "}
              <strong>Lịch sử đơn hàng</strong>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="checkout-page__place-order"
                onClick={handleCustomerReportedTransfer}
                disabled={reportStatus === "submitting"}
              >
                {reportStatus === "submitting"
                  ? "Đang kiểm tra…"
                  : "Tôi đã chuyển khoản"}
              </button>
              {reportMessage && (
                <p
                  style={{
                    fontSize: 13,
                    textAlign: "center",
                    color:
                      reportStatus === "error" || reportStatus === "failed"
                        ? "#dc2626"
                        : "#15803d",
                  }}
                  role="alert"
                >
                  {reportMessage}
                </p>
              )}
              <Link
                href="/profile?tab=orders"
                className="checkout-page__place-order"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  marginTop: 8,
                }}
              >
                Xem lịch sử đơn hàng
              </Link>
              <Link
                href="/collection"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  fontSize: 14,
                  color: "#6b7280",
                  padding: "10px 0",
                }}
              >
                ◀ Tiếp tục mua hàng
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const shippingPayable = Math.max(0, d.shippingFee - d.shippingDiscount);

  return (
    <main className="checkout-page">
      <div className="checkout-page__inner">
        <div className="checkout-page__layout">
          <div className="checkout-page__left">
            <div className="checkout-page__panel">
              <p className="checkout-page__pending-order-id">
                Order #{displayOrderId}
              </p>
              <h1 className="checkout-page__panel-title">Awaiting payment</h1>

              <div
                className="checkout-page__summary-rows"
                style={{ marginBottom: 20 }}
              >
                <div className="checkout-page__summary-row">
                  <span>Total order amount</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(d.amount)}
                  </span>
                </div>
                <div className="checkout-page__summary-row">
                  <span>Amount due</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(d.amount)}
                  </span>
                </div>
                <div className="checkout-page__summary-row">
                  <span>Payment method</span>
                  <span className="checkout-page__summary-val">
                    Chuyển khoản qua QR
                  </span>
                </div>
              </div>

              <div className="checkout-page__transfer-layout">
                <div className="checkout-page__transfer-table-wrap">
                  <h3
                    className="checkout-page__panel-title"
                    style={{
                      fontSize: "clamp(15px, 1.4vw, 18px)",
                      marginBottom: 10,
                    }}
                  >
                    Transfer Description
                  </h3>
                  <table className="checkout-page__transfer-table">
                    <tbody>
                      <tr>
                        <td>Account</td>
                        <td>
                          <strong>{d.bankAccountName || "xxx"}</strong>
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td>Receiving Bank</td>
                        <td>
                          <strong>{d.bankName || "xxx"}</strong>
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td>Account Number</td>
                        <td>
                          <strong>{d.bankAccountNumber || "xxx"}</strong>
                        </td>
                        <td>
                          <button
                            className="checkout-page__copy-btn"
                            onClick={() =>
                              handleCopy(d.bankAccountNumber, "accno")
                            }
                            title="Copy"
                          >
                            {copied === "accno" ? "✓" : <CopyIcon />}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>Transfer Note</td>
                        <td>
                          <strong style={{ color: "#1d4ed8" }}>
                            {d.paymentCode}
                          </strong>
                        </td>
                        <td>
                          <button
                            className="checkout-page__copy-btn"
                            onClick={() => handleCopy(d.paymentCode, "note")}
                            title="Copy"
                          >
                            {copied === "note" ? "✓" : <CopyIcon />}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>Transfer amount</td>
                        <td>
                          <strong style={{ color: "#dc2626" }}>
                            {d.amount.toLocaleString("vi-VN")}đ
                          </strong>
                        </td>
                        <td>
                          <button
                            className="checkout-page__copy-btn"
                            onClick={() =>
                              handleCopy(String(d.amount), "amount")
                            }
                            title="Copy"
                          >
                            {copied === "amount" ? "✓" : <CopyIcon />}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {d.qrImageUrl && (
                  <div className="checkout-page__qr-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.qrImageUrl}
                      alt="QR chuyển khoản"
                      width={150}
                      height={150}
                      style={{ borderRadius: 8, display: "block" }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                className="checkout-page__place-order"
                style={{ marginTop: 20, fontSize: "clamp(16px, 1.6vw, 22px)" }}
                onClick={handleCustomerReportedTransfer}
                disabled={
                  reportStatus === "submitting" || reportStatus === "recorded"
                }
              >
                {reportStatus === "submitting"
                  ? "Đang kiểm tra…"
                  : "Tôi đã chuyển khoản"}
              </button>
              {reportMessage && (
                <p
                  style={{
                    fontSize: 13,
                    marginTop: 8,
                    color:
                      reportStatus === "failed" || reportStatus === "error"
                        ? "#dc2626"
                        : "#15803d",
                  }}
                  role="alert"
                >
                  {reportMessage}
                </p>
              )}
            </div>
          </div>

          <div className="checkout-page__right">
            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Your Card</h2>
              <div className="checkout-page__cart-list">
                {d.cartItems.map((item, idx) => (
                  <div key={idx}>
                    <div className="checkout-page__cart-item">
                      <div className="checkout-page__item-image">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="72px"
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                      <div className="checkout-page__item-info">
                        <p className="checkout-page__item-name">{item.name}</p>
                        <p className="checkout-page__item-price">
                          {formatPrice(item.price)}
                        </p>
                        <p
                          style={{ fontSize: 12, color: "#6b7280", margin: 0 }}
                        >
                          x{item.quantity}
                        </p>
                      </div>
                    </div>
                    {idx < d.cartItems.length - 1 && (
                      <hr className="checkout-page__item-divider" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Order Summary</h2>
              <div className="checkout-page__summary-rows">
                <div className="checkout-page__summary-row">
                  <span>Subtotal</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(d.subtotal)}
                  </span>
                </div>
                {d.productDiscount > 0 && (
                  <div className="checkout-page__summary-row checkout-page__summary-row--discount">
                    <span>Discount</span>
                    <span className="checkout-page__summary-val">
                      −{formatPrice(d.productDiscount)}
                    </span>
                  </div>
                )}
                <div className="checkout-page__summary-row">
                  <span>Shipping fee</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(d.shippingFee)}
                  </span>
                </div>
                {d.shippingDiscount > 0 && (
                  <div className="checkout-page__summary-row checkout-page__summary-row--discount">
                    <span>Miễn phí vận chuyển</span>
                    <span className="checkout-page__summary-val">
                      −{formatPrice(d.shippingDiscount)}
                    </span>
                  </div>
                )}
              </div>
              <div className="checkout-page__summary-total">
                <span>Total amount</span>
                <span>{formatPrice(d.amount)}</span>
              </div>
              {shippingPayable === 0 && d.shippingFee > 0 && (
                <p style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>
                  ✓ Miễn phí vận chuyển đã áp dụng
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href="/profile?tab=orders"
                className="checkout-page__place-order"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  fontSize: "clamp(14px, 1.4vw, 18px)",
                }}
              >
                Xem lịch sử đơn hàng
              </Link>
              <Link
                href="/collection"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  fontSize: 14,
                  color: "#6b7280",
                  padding: "10px 0",
                }}
              >
                ◀ Tiếp tục mua hàng
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ══════════════════════════════════════════════════════════
// Entry point — routes to QrNewPending or LegacyPending
// ══════════════════════════════════════════════════════════
export default function PaymentPendingClient() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const orderId = searchParams.get("orderId");
  const paymentRequestId = searchParams.get("paymentRequestId");

  // mode=qr → new flow (no order in DB yet)
  if (mode === "qr") return <QrNewPending />;

  // legacy → order already exists
  return (
    <LegacyPending orderId={orderId} paymentRequestId={paymentRequestId} />
  );
}
