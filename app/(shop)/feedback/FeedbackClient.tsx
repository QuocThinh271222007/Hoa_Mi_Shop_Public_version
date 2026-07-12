"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import type { FeedbackItem } from "@/lib/feedback/items";
import { truncateWords } from "@/lib/feedback/truncate-words";

// Assets with special characters → plain <img> to avoid Next.js double-encoding
const FEEDBACK_TITLE = "/assets/brand/5.%20Feedback.png";
const HEART_FRAME = "/assets/ui/FRAME%20%E1%BA%A2NH.png";
const CTA_WITH_BTN = "/assets/ui/CTA%20(C%C3%93%20N%C3%9AT).png";
const HEART_OUTLINE = "/assets/ui/heart-outline.png";
const HEART_LIKED = "/assets/ui/heart-liked.png";

function HeartDivider() {
  return (
    <div className="feedback-page__heart-divider" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <img
          key={i}
          src={i % 2 === 0 ? HEART_OUTLINE : HEART_LIKED}
          alt=""
          className="feedback-page__heart-divider-icon"
        />
      ))}
    </div>
  );
}

export default function FeedbackClient({
  items,
  padletTitle,
}: {
  items: FeedbackItem[];
  padletTitle?: string;
}) {
  const FEEDBACK_ITEMS = items;
  const [active, setActive] = useState(0);
  const total = FEEDBACK_ITEMS.length;
  const item: FeedbackItem = FEEDBACK_ITEMS[active] ?? {
    id: "",
    name: "",
    text: "",
    image_url: null,
  };
  // Right heart shows the short feedback DESCRIPTION (max 10 words) — not the name.
  const reviewerDescription = truncateWords((item.description ?? "").trim(), 10);
  // Optional per-feedback font size for that description.
  const reviewerStyle: CSSProperties = {};
  if (item.reviewer_font_size && item.reviewer_font_size > 0) {
    reviewerStyle.fontSize = `${item.reviewer_font_size}px`;
  }

  const detailTitleText =
    item.detail_title?.trim() || "FEEDBACK CHI TIẾT\nCỦA NGƯỜI ĐÓ";
  const detailTitleStyle: CSSProperties = { whiteSpace: "pre-line" };
  if (item.detail_title_font_size && item.detail_title_font_size > 0) {
    detailTitleStyle.fontSize = `${item.detail_title_font_size}px`;
  }

  const padletHeading = padletTitle?.trim() || "PADLET";

  // Feedback submission modal (goes to admin as unpublished for review)
  const [modalOpen, setModalOpen] = useState(false);
  const [fbName, setFbName] = useState("");
  const [fbDescription, setFbDescription] = useState("");
  const [fbMessage, setFbMessage] = useState("");
  const [fbImage, setFbImage] = useState<File | null>(null);
  const [fbPreview, setFbPreview] = useState<string | null>(null);
  const [fbStatus, setFbStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [fbError, setFbError] = useState("");

  // Reject keystrokes that would push the description past 10 words, while
  // still allowing normal typing (including the trailing space between words).
  function handleDescriptionChange(next: string) {
    const wordCount = next.trim() ? next.trim().split(/\s+/).length : 0;
    if (wordCount <= 10) setFbDescription(next);
  }

  function handlePickImage(file: File | null) {
    setFbError("");
    if (!file) {
      setFbImage(null);
      setFbPreview(null);
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
        file.type,
      )
    ) {
      setFbError("Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFbError("Ảnh vượt quá 5MB.");
      return;
    }
    setFbImage(file);
    setFbPreview(URL.createObjectURL(file));
  }

  async function handleFeedbackSubmit(e: FormEvent) {
    e.preventDefault();
    setFbError("");
    if (!fbName.trim()) {
      setFbError("Vui lòng nhập tên của bạn.");
      return;
    }
    if (!fbMessage.trim()) {
      setFbError("Vui lòng nhập nội dung feedback.");
      return;
    }
    setFbStatus("submitting");
    try {
      const fd = new FormData();
      fd.set("name", fbName);
      fd.set("description", fbDescription);
      fd.set("message", fbMessage);
      if (fbImage) fd.set("image", fbImage);
      const res = await fetch("/api/feedback", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFbStatus("success");
        setFbName("");
        setFbDescription("");
        setFbMessage("");
        setFbImage(null);
        setFbPreview(null);
      } else {
        setFbStatus("error");
        setFbError(data.error ?? "Không thể gửi. Vui lòng thử lại.");
      }
    } catch {
      setFbStatus("error");
      setFbError("Lỗi kết nối. Vui lòng thử lại.");
    }
  }

  function closeModal() {
    setModalOpen(false);
    setFbStatus("idle");
    setFbError("");
    setFbImage(null);
    setFbPreview(null);
  }

  return (
    <main className="feedback-page">
      {/* ── Hero ── */}
      <section className="feedback-page__hero">
        <img
          className="feedback-page__title-image"
          src={FEEDBACK_TITLE}
          alt="Đánh Giá Sản Phẩm"
        />
        <p className="feedback-page__intro-line">
          Mỗi lời nhắn gửi từ nàng là một &ldquo;nụ hoa&rdquo; tiếp thêm sức
          mạnh để vườn HOA ngày càng nở rộ!
        </p>
        <p className="feedback-page__intro-line feedback-page__intro-line--bold">
          Cùng xem các cô gái đã biến hóa cùng Họa Mi ra sao nhé!
        </p>
      </section>

      {/* ── Carousel ── */}
      <section className="feedback-page__carousel">
        <button
          className="feedback-page__carousel-arrow feedback-page__carousel-arrow--left"
          onClick={() => setActive((i) => (i - 1 + total) % total)}
          aria-label="Trước"
        >
          ◀
        </button>

        <div className="feedback-page__heart-card">
          {/* Base double-heart frame image */}
          <img
            className="feedback-page__heart-frame"
            src={HEART_FRAME}
            alt=""
            aria-hidden="true"
          />
          {/* Customer photo clipped to the left (outline) heart of the frame */}
          {item.image_url && (
            <img
              className="feedback-page__heart-photo"
              src={item.image_url}
              alt={item.name ? `Ảnh feedback của ${item.name}` : "Ảnh feedback"}
            />
          )}
          {/* Name overlay sits over the right pink heart area */}
          <div className="feedback-page__heart-overlay" aria-live="polite">
            <p className="feedback-page__reviewer-description" style={reviewerStyle}>
              {reviewerDescription}
            </p>
          </div>
        </div>

        <button
          className="feedback-page__carousel-arrow feedback-page__carousel-arrow--right"
          onClick={() => setActive((i) => (i + 1) % total)}
          aria-label="Tiếp theo"
        >
          ▶
        </button>
      </section>

      {/* ── Pagination dots ── */}
      <div
        className="feedback-page__carousel-dots"
        role="group"
        aria-label="Chọn feedback"
      >
        {FEEDBACK_ITEMS.map((_, i) => (
          <button
            key={i}
            className={`feedback-page__carousel-dot${i === active ? " feedback-page__carousel-dot--active" : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Feedback ${i + 1}`}
            aria-pressed={i === active}
          />
        ))}
      </div>

      {/* ── Detail panel ── */}
      <section className="feedback-page__detail-panel">
        <p className="feedback-page__detail-title" style={detailTitleStyle}>
          {detailTitleText}
        </p>
      </section>

      {/* ── PADLET section ── */}
      <section className="feedback-page__padlet">
        <h2 className="feedback-page__padlet-title">{padletHeading}</h2>
        <div className="feedback-page__cta">
          <button
            type="button"
            className="feedback-page__cta-button"
            onClick={() => setModalOpen(true)}
            aria-label="Gửi feedback của bạn"
          >
            <img
              className="feedback-page__cta-image"
              src={CTA_WITH_BTN}
              alt="Khoe nhẹ chiếc OOTD của bạn với Họa Mi tại đây nha!"
            />
          </button>
        </div>
      </section>

      {/* ── Heart divider strip ── */}
      <HeartDivider />

      {/* ── Feedback submission modal ── */}
      {modalOpen && (
        <div
          className="feedback-modal__backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Gửi feedback"
        >
          <div className="feedback-modal">
            <button
              type="button"
              className="feedback-modal__close"
              onClick={closeModal}
              aria-label="Đóng"
            >
              ✕
            </button>
            {fbStatus === "success" ? (
              <div className="feedback-modal__done">
                <h2 className="feedback-modal__title">Cảm ơn nàng ♡</h2>
                <p className="feedback-modal__text">
                  Feedback của bạn đã được gửi và đang chờ shop duyệt. Cảm ơn
                  bạn rất nhiều!
                </p>
                <button
                  type="button"
                  className="feedback-modal__submit"
                  onClick={closeModal}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <>
                <h2 className="feedback-modal__title">Gửi feedback của bạn</h2>
                <form
                  className="feedback-modal__form"
                  onSubmit={handleFeedbackSubmit}
                >
                  <input
                    className="feedback-modal__input"
                    type="text"
                    placeholder="Tên của bạn"
                    value={fbName}
                    onChange={(e) => setFbName(e.target.value)}
                    maxLength={100}
                  />
                  <input
                    className="feedback-modal__input"
                    type="text"
                    placeholder="Mô tả ngắn (vd: Sinh viên năm 3)"
                    value={fbDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    style={{ fontFamily: "var(--title-font)" }}
                  />
                  <textarea
                    className="feedback-modal__textarea"
                    placeholder="Cảm nhận của bạn về Họa Mi…"
                    value={fbMessage}
                    onChange={(e) => setFbMessage(e.target.value)}
                    rows={4}
                    maxLength={1000}
                  />

                  <label className="feedback-modal__file">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        handlePickImage(e.target.files?.[0] ?? null)
                      }
                    />
                    <span>
                      {fbImage
                        ? "Đổi ảnh khác"
                        : "📷 Thêm ảnh (không bắt buộc)"}
                    </span>
                  </label>
                  {fbPreview && (
                    <div className="feedback-modal__preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fbPreview} alt="Ảnh xem trước" />
                      <button
                        type="button"
                        className="feedback-modal__preview-remove"
                        onClick={() => handlePickImage(null)}
                        aria-label="Xoá ảnh"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {fbError && (
                    <p className="feedback-modal__error" role="alert">
                      {fbError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="feedback-modal__submit"
                    disabled={fbStatus === "submitting"}
                  >
                    {fbStatus === "submitting" ? "Đang gửi…" : "Gửi feedback"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
