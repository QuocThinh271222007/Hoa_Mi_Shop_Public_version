import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getSuggestedBlogPosts, getAllBlogSlugs, incrementBlogViews } from '@/lib/blog/posts';
import { getApprovedComments } from '@/lib/comments/public';
import { submitComment } from '@/lib/comments/public';
import BlogPostClient from './BlogPostClient';
import '../blog.css';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const [suggestions, approvedComments] = await Promise.all([
    getSuggestedBlogPosts(slug),
    getApprovedComments('blog', slug),
  ]);

  // Count this visit (best-effort, non-blocking).
  await incrementBlogViews(slug);

  const comments = approvedComments.map((c) => ({
    id: c.id,
    author: c.author_name ?? 'Ẩn danh',
    text: c.content,
  }));

  // Show live figures: the visit we just counted, and the real approved-comment
  // total (rather than the stored counter which can drift).
  const postWithCounts = {
    ...post,
    views: post.views + 1,
    commentsCount: approvedComments.length,
  };

  return (
    <BlogPostClient
      post={postWithCounts}
      suggestions={suggestions}
      comments={comments}
      targetSlug={slug}
      submitCommentAction={submitComment}
    />
  );
}
