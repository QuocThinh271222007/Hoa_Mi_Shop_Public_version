"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { BlogPost, BlogComment } from "@/lib/blog/mock-posts";
import { renderRichContent } from "@/lib/html/rich-content";

const VIEW_ICON = "/assets/ui/2. LƯỢT XEM.png";
const COMMENT_ICON = "/assets/ui/3. BÌNH LUẬN.png";
const HEART_ICON = "/assets/ui/4.%20TIM.png";
const ARROW_ICON = "/assets/ui/1.%20M%C5%A8I%20T%C3%8AN.png";
const AVATAR_ICON = "/assets/ui/profile-icon.png";

interface Props {
  post: BlogPost;
  suggestions: BlogPost[];
  comments: BlogComment[];
  targetSlug: string;
  submitCommentAction: (
    formData: FormData,
  ) => Promise<{ ok: boolean; error?: string }>;
}

// ── Share popup (same style as listing page) ──
function SharePopup({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const pageUrl = () =>
    typeof window !== "undefined" ? window.location.href : "";

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl())}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500",
    );
  };

  // Instagram / TikTok / Threads have no web share-intent for a URL — copy the
  // link (with Web Share API where available) so the control is no longer dead.
  const shareCopy = async () => {
    const url = pageUrl();
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed share sheet — no-op */
    }
  };

  return (
    <div
      ref={ref}
      className="blog-share-popup"
      role="dialog"
      aria-label="Chia sẻ"
    >
      {copied && (
        <span
          style={{
            position: "absolute",
            top: -26,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 11,
            background: "#111",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}
        >
          Đã sao chép liên kết
        </span>
      )}
      <button
        className="blog-share-popup__icon-btn"
        aria-label="Facebook"
        onClick={shareFacebook}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H8.078V12h2.36v-2.045c0-2.332 1.388-3.62 3.513-3.62 1.018 0 2.083.182 2.083.182v2.287h-1.173c-1.156 0-1.517.718-1.517 1.455V12h2.579l-.412 2.891h-2.167v6.987C18.343 21.128 22 16.991 22 12z" />
        </svg>
      </button>
      <button
        className="blog-share-popup__icon-btn"
        aria-label="Instagram"
        onClick={shareCopy}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4" />
          <circle
            cx="17.5"
            cy="6.5"
            r="1.2"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      </button>
      <button
        className="blog-share-popup__icon-btn"
        aria-label="TikTok"
        onClick={shareCopy}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.89a4.85 4.85 0 01-1.01-.2z" />
        </svg>
      </button>
      <button
        className="blog-share-popup__icon-btn"
        aria-label="Threads"
        onClick={shareCopy}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161" />
        </svg>
      </button>
    </div>
  );
}

export default function BlogPostClient({
  post,
  suggestions,
  comments: initialComments,
  targetSlug,
  submitCommentAction,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [comments] = useState<BlogComment[]>(initialComments);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");

  const closeShare = useCallback(() => setShareOpen(false), []);
  const toggleShare = useCallback(() => setShareOpen((v) => !v), []);

  // Show the detail hero image only when the admin toggle is on AND an image
  // exists — otherwise the content spans the full card width.
  const showDetailImage = post.showDetailImage !== false && !!post.imageUrl;

  const handleCommentSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = commentText.trim();
      if (!trimmed) return;
      const fd = new FormData();
      fd.set("target_type", "blog");
      fd.set("target_slug", targetSlug);
      fd.set("content", trimmed);
      startTransition(async () => {
        const result = await submitCommentAction(fd);
        if (result.ok) {
          setCommentText("");
          setSubmitStatus("success");
          setSubmitError("");
        } else {
          setSubmitStatus("error");
          setSubmitError(result.error ?? "Không thể gửi bình luận.");
        }
      });
    },
    [commentText, targetSlug, submitCommentAction],
  );

  return (
    <main className="blog-post-page">
      <div className="blog-post-page__inner">
        {/* Back link */}
        <Link className="blog-post__back" href="/blog">
          ◀ All Posts
        </Link>

        {/* ── Detail card ── */}
        <article
          className={`blog-post-card${showDetailImage ? "" : " blog-post-card--no-image"}`}
        >
          {/* Left: content */}
          <div className="blog-post-card__content">
            <div className="blog-post-card__meta-row">
              <span className="blog-post-card__meta-text">
                {post.date} &bull; {post.readTime}
              </span>
              <div className="blog-post-card__meta-actions">
                <button
                  type="button"
                  className="blog-post-card__share-btn"
                  onClick={toggleShare}
                  aria-label="Chia sẻ"
                >
                  Chia Sẻ
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="blog-post-card__dots-btn"
                  onClick={toggleShare}
                  aria-label="Thêm"
                >
                  ⋮
                </button>
              </div>
            </div>

            <h1 className="blog-post-card__title">{post.title}</h1>

            <div
              className="blog-post-card__body blog-content"
              dangerouslySetInnerHTML={{ __html: renderRichContent(post.content) }}
            />

            <div className="blog-post-card__stats-row">
              <span className="blog-post-card__stat">
                <img
                  className="blog-post-card__stat-icon"
                  src={HEART_ICON}
                  alt=""
                  aria-hidden="true"
                  width={18}
                  height={18}
                />
                {post.likes}
              </span>
              <span className="blog-post-card__stat">
                <img
                  className="blog-post-card__stat-icon"
                  src={VIEW_ICON}
                  alt=""
                  aria-hidden="true"
                  width={18}
                  height={18}
                />
                {post.views} lượt xem
              </span>
              <span className="blog-post-card__stat">
                <img
                  className="blog-post-card__stat-icon"
                  src={COMMENT_ICON}
                  alt=""
                  aria-hidden="true"
                  width={18}
                  height={18}
                />
                {post.commentsCount} bình luận
              </span>
            </div>
          </div>

          {/* Right: image frame — hidden when the admin toggle is off / no image */}
          {showDetailImage && (
            <div className="blog-post-card__img-col">
              <div className="blog-post-card__img-frame">
                <Image
                  src={post.imageUrl!}
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  style={{ objectFit: "cover", borderRadius: "inherit" }}
                />
              </div>
            </div>
          )}

          {/* Share popup (absolute inside card) */}
          {shareOpen && <SharePopup onClose={closeShare} />}
        </article>

        {/* ── Gợi Ý ── */}
        {suggestions.length > 0 && (
          <section className="blog-suggestions">
            <div className="blog-section-heading">
              <h2 className="blog-section-heading__text">Gợi Ý</h2>
              <hr className="blog-section-heading__line" />
            </div>
            <div className="blog-suggestions__grid">
              {suggestions.map((s) => (
                <Link
                  key={s.slug}
                  className="blog-suggestion-card"
                  href={`/blog/${s.slug}`}
                >
                  <div className="blog-suggestion-card__img-frame">
                    {s.imageUrl ? (
                      <Image
                        src={s.imageUrl}
                        alt={s.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 240px"
                        style={{ objectFit: "cover", borderRadius: "inherit" }}
                      />
                    ) : (
                      <span className="blog-suggestion-card__img-label">
                        ẢNH
                      </span>
                    )}
                  </div>
                  <h3 className="blog-suggestion-card__title">{s.title}</h3>
                  <hr className="blog-suggestion-card__divider" />
                  <div className="blog-suggestion-card__stats">
                    <span className="blog-suggestion-card__stat">
                      <img
                        className="blog-suggestion-card__stat-icon"
                        src={VIEW_ICON}
                        alt=""
                        aria-hidden="true"
                        width={16}
                        height={16}
                      />
                      {s.views}
                    </span>
                    <span className="blog-suggestion-card__stat">
                      <img
                        className="blog-suggestion-card__stat-icon"
                        src={COMMENT_ICON}
                        alt=""
                        aria-hidden="true"
                        width={16}
                        height={16}
                      />
                      {s.commentsCount}
                    </span>
                    <span className="blog-suggestion-card__heart">
                      <img
                        className="blog-suggestion-card__heart-icon"
                        src={HEART_ICON}
                        alt=""
                        aria-hidden="true"
                        width={18}
                        height={18}
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Bình luận ── */}
        <section className="blog-comments">
          <div className="blog-section-heading">
            <button
              type="button"
              className="blog-comments__toggle"
              onClick={() => setCommentsOpen((v) => !v)}
              aria-expanded={commentsOpen}
              aria-controls="blog-comments-list"
            >
              <span className="blog-section-heading__text">Bình luận</span>
              <span
                className={`blog-comments__caret${commentsOpen ? " blog-comments__caret--open" : ""}`}
                aria-hidden="true"
              >
                ▸
              </span>
            </button>
            <hr className="blog-section-heading__line" />
          </div>

          {commentsOpen && (
            <div id="blog-comments-list">
              {comments.length > 0 ? (
                <div className="blog-comments__list">
                  {comments.map((c) => (
                    <div key={c.id} className="blog-comment">
                      <img
                        className="blog-comment__avatar"
                        src={AVATAR_ICON}
                        alt={c.author}
                        width={48}
                        height={48}
                      />
                      <div className="blog-comment__body">
                        <span className="blog-comment__author">{c.author}</span>
                        <span className="blog-comment__bubble">{c.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="blog-comments__empty">
                  Chưa có bình luận. Hãy là người đầu tiên!
                </p>
              )}
            </div>
          )}

          {submitStatus === "success" && (
            <p style={{ fontSize: 13, color: "#16a34a", marginBottom: 8 }}>
              Cảm ơn bạn đã bình luận.
            </p>
          )}
          {submitStatus === "error" && (
            <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 8 }}>
              {submitError}
            </p>
          )}
          <form
            className="blog-comments__input-row"
            onSubmit={handleCommentSubmit}
          >
            <input
              className="blog-comments__input"
              type="text"
              placeholder="Viết gì đó...."
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                if (submitStatus !== "idle") setSubmitStatus("idle");
              }}
              aria-label="Viết bình luận"
              disabled={pending}
            />
            <button
              type="submit"
              className="blog-comments__send-btn"
              aria-label="Gửi bình luận"
              disabled={pending}
            >
              <img
                className="blog-comments__send-icon"
                src={ARROW_ICON}
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
              />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
