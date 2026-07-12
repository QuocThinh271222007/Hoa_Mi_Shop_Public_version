"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { clearCart } from "@/lib/shop/cart-store";

export default function CheckoutSuccessClient() {
  const searchParams = useSearchParams();

  // Reaching this page means the order was successfully created (COD confirmed
  // or QR payment confirmed) — safe to empty the cart now. Doing it here (not on
  // the QR pending page) keeps the cart intact if the customer never pays.
  useEffect(() => {
    clearCart();
  }, []);
  const orderId = searchParams.get("orderId");
  const paymentRequestId = searchParams.get("paymentRequestId");
  const isCod = searchParams.get("cod") === "1";
  // awaiting=1 → QR order created by customer self-report; payment NOT yet
  // verified by admin. Must NOT be shown as "đã thanh toán".
  const isAwaiting = searchParams.get("awaiting") === "1";
  // Unified order code = transfer note (payment_code). Falls back to the UUID
  // prefix for legacy orders that arrive without a code param.
  const code = searchParams.get("code")?.trim();
  const orderCode = code || (orderId ? orderId.slice(0, 8).toUpperCase() : "");

  // Three states:
  // - COD: order placed, pay on delivery (amber).
  // - Awaiting: QR transfer reported, waiting for admin verification (amber).
  // - Paid: payment actually confirmed (green).
  const isPending = isCod || isAwaiting;
  const boxColors = isPending
    ? { bg: "#fffbeb", border: "#fde68a", text: "#b45309" }
    : { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" };

  const heading = isCod
    ? "Đặt hàng thành công"
    : isAwaiting
      ? "Đã ghi nhận đơn hàng"
      : "Thanh toán thành công";

  return (
    <main className="checkout-page">
      <div className="checkout-page__inner">
        <div
          className="checkout-page__panel"
          style={{ maxWidth: 560, margin: "0 auto" }}
        >
          <h1
            className="checkout-page__panel-title"
            style={{ fontSize: "clamp(18px, 2vw, 24px)", marginBottom: 16 }}
          >
            {heading}
          </h1>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: "#374151",
              marginBottom: 20,
            }}
          >
            {isCod ? (
              <>
                Cảm ơn bạn! Đơn hàng COD của bạn đã được ghi nhận. Bạn sẽ thanh
                toán khi nhận hàng. Theo dõi trạng thái trong mục{" "}
                <strong>Lịch sử đơn hàng</strong>.
              </>
            ) : isAwaiting ? (
              <>
                Cảm ơn bạn! Đơn hàng của bạn đã được ghi nhận và đang{" "}
                <strong>chờ xác nhận thanh toán</strong>. Chúng mình sẽ đối soát
                giao dịch chuyển khoản và xác nhận trong thời gian sớm nhất.
                Theo dõi trạng thái trong mục <strong>Lịch sử đơn hàng</strong>.
              </>
            ) : (
              <>
                Cảm ơn bạn! Thanh toán của đơn hàng đã được xác nhận. Đơn hàng
                của bạn sẽ được chuyển sang bước xử lý tiếp theo. Bạn có thể
                theo dõi trạng thái trong mục <strong>Lịch sử đơn hàng</strong>.
              </>
            )}
          </p>

          {(orderId || paymentRequestId) && (
            <div
              style={{
                background: boxColors.bg,
                border: `1.5px solid ${boxColors.border}`,
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {orderId && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Mã đơn hàng</span>
                  <strong
                    style={{ fontFamily: "monospace", color: boxColors.text }}
                  >
                    {orderCode}
                  </strong>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ color: "#6b7280" }}>
                  {isCod ? "Phương thức" : "Trạng thái thanh toán"}
                </span>
                <strong style={{ color: boxColors.text }}>
                  {isCod
                    ? "COD - Thanh toán khi nhận hàng"
                    : isAwaiting
                      ? "Chờ xác nhận chuyển khoản"
                      : "Đã xác nhận"}
                </strong>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href="/profile?tab=orders"
              className="checkout-page__place-order"
              style={{ textAlign: "center", textDecoration: "none" }}
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
