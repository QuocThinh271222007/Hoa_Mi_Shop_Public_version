export interface BlogPost {
  slug: string;
  date: string;
  readTime: string;
  title: string;
  excerpt: string;
  content: string;
  views: number;
  commentsCount: number;
  likes: number;
  imageUrl?: string;
  showDetailImage?: boolean;
}

export interface BlogComment {
  id: string;
  author: string;
  text: string;
}

export const MOCK_POSTS: BlogPost[] = [
  {
    slug: 'content-blog-1',
    date: '07 thg 06, 2026',
    readTime: '2 phút đọc',
    title: 'TITLE',
    excerpt: 'Content Blog 1',
    content: 'Content Blog:',
    views: 37,
    commentsCount: 0,
    likes: 21,
  },
  {
    slug: 'content-blog-2',
    date: '07 thg 06, 2026',
    readTime: '2 phút đọc',
    title: 'TITLE',
    excerpt: 'Content Blog 1',
    content: 'Content Blog:',
    views: 37,
    commentsCount: 0,
    likes: 21,
  },
  {
    slug: 'content-blog-3',
    date: '07 thg 06, 2026',
    readTime: '2 phút đọc',
    title: 'TITLE',
    excerpt: 'Content Blog 1',
    content: 'Content Blog:',
    views: 37,
    commentsCount: 0,
    likes: 21,
  },
];

export const MOCK_COMMENTS: BlogComment[] = [
  { id: '1', author: 'Chu Choe', text: 'Hihihahahahohoho' },
  { id: '2', author: 'Chu Choe', text: 'Hihihahahahohoho' },
  { id: '3', author: 'Chu Choe', text: 'Hihihahahahohoho' },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return MOCK_POSTS.find((p) => p.slug === slug);
}

export function getSuggestedPosts(currentSlug: string): BlogPost[] {
  return MOCK_POSTS.filter((p) => p.slug !== currentSlug).slice(0, 3);
}
