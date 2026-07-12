"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import type { BlogPost } from "@/lib/blog/mock-posts";

const VIEW_ICON = "/assets/ui/2. LƯỢT XEM.png";
const COMMENT_ICON = "/assets/ui/3. BÌNH LUẬN.png";
const HEART_ICON = "/assets/ui/4.%20TIM.png";
const BLOGS_TITLE = "/assets/brand/Blogs.png";

function SharePopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="blog-share-popup"
      role="dialog"
      aria-label="Chia sẻ"
    >
      <button className="blog-share-popup__icon-btn" aria-label="Facebook">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H8.078V12h2.36v-2.045c0-2.332 1.388-3.62 3.513-3.62 1.018 0 2.083.182 2.083.182v2.287h-1.173c-1.156 0-1.517.718-1.517 1.455V12h2.579l-.412 2.891h-2.167v6.987C18.343 21.128 22 16.991 22 12z" />
        </svg>
      </button>
      <button className="blog-share-popup__icon-btn" aria-label="Instagram">
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
      <button className="blog-share-popup__icon-btn" aria-label="TikTok">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.89a4.85 4.85 0 01-1.01-.2z" />
        </svg>
      </button>
      <button className="blog-share-popup__icon-btn" aria-label="Threads">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          fill="currentColor"
          className="bi bi-threads"
          viewBox="0 0 16 16"
        >
          <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161" />
        </svg>
      </button>
    </div>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  const [shareOpen, setShareOpen] = useState(false);
  const closeShare = useCallback(() => setShareOpen(false), []);

  return (
    <article className="blog-card">
      {/* image column */}
      <div className="blog-card__img-col">
        <div className="blog-card__img-frame">
          {post.imageUrl ? (
            <Image
              src={post.imageUrl}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 340px"
              style={{ objectFit: "cover", borderRadius: "inherit" }}
            />
          ) : (
            <span className="blog-card__img-label">ẢNH</span>
          )}
        </div>
      </div>

      {/* content column */}
      <div className="blog-card__content">
        <div className="blog-card__meta-row">
          <span className="blog-card__meta-text">
            {post.date} &bull; {post.readTime}
          </span>
          <div className="blog-card__meta-actions">
            <button
              className="blog-card__share-btn"
              onClick={() => setShareOpen((v) => !v)}
              aria-label="Chia sẻ"
            >
              Chia Sẻ
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
            <button className="blog-card__dots-btn" aria-label="Thêm">
              ⋮
            </button>
          </div>
        </div>

        <h2 className="blog-card__title">{post.title}</h2>
        <p className="blog-card__excerpt">{post.excerpt}</p>
        <Link className="blog-card__readmore" href={`/blog/${post.slug}`}>
          Xem thêm
        </Link>

        <hr className="blog-card__divider" />

        <div className="blog-card__stats-row">
          <span className="blog-card__stat">
            <Image
              className="blog-card__stat-icon"
              src={VIEW_ICON}
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              unoptimized
            />
            {post.views} lượt xem
          </span>
          <span className="blog-card__stat">
            <Image
              className="blog-card__stat-icon"
              src={COMMENT_ICON}
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              unoptimized
            />
            {post.commentsCount} bình luận
          </span>
          <button className="blog-card__heart-btn" aria-label="Thích">
            <Image
              className="blog-card__heart-icon"
              src={HEART_ICON}
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              unoptimized
            />
          </button>
        </div>
      </div>

      <SharePopup open={shareOpen} onClose={closeShare} />
    </article>
  );
}

export default function BlogClient({ posts }: { posts: BlogPost[] }) {
  return (
    <main className="blog-page">
      <div className="blog-page__hero">
        <Image
          className="blog-page__hero-image"
          src={BLOGS_TITLE}
          alt="Bảng Tin"
          width={560}
          height={160}
          priority
        />
      </div>

      <div className="blog-page__intro">
        <p className="blog-page__intro-text">
          Đoán xem hôm nay nhà Hoạ Mi có gì nà?
        </p>
      </div>

      <div className="blog-page__posts">
        {posts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>
    </main>
  );
}
