import { getBlogPosts } from '@/lib/blog/posts';
import BlogClient from './BlogClient';
import './blog.css';

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const posts = await getBlogPosts();
  return <BlogClient posts={posts} />;
}
