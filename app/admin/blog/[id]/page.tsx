import { redirect, notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getBlogPostById, updateBlogPost } from '@/lib/admin/blog-data';
import { AdminShell } from '../../_components/AdminShell';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { BUCKETS } from '@/lib/admin/storage';

export const dynamic = 'force-dynamic';

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { email } = await requireAdmin();

  const post = await getBlogPostById(id).catch(() => null);
  if (!post) notFound();

  async function updateAction(formData: FormData) {
    'use server';
    const fields = {
      slug: formData.get('slug') as string,
      title: formData.get('title') as string,
      excerpt: (formData.get('excerpt') as string) || null,
      content: (formData.get('content') as string) || null,
      image_url: (formData.get('image_url') as string) || null,
      image_path: (formData.get('image_path') as string) || null,
      image_alt: (formData.get('image_alt') as string) || null,
      read_time: (formData.get('read_time') as string) || null,
      sort_order: Number(formData.get('sort_order')) || 0,
      is_published: formData.get('is_published') === 'on',
      show_detail_image: formData.get('show_detail_image') === 'on',
    };
    await updateBlogPost(id, fields);
    redirect('/admin/blog');
  }

  return (
    <AdminShell email={email} activePath="/admin/blog">
      <header className="admin-header">
        <h1 className="admin-header__title">Sửa bài viết</h1>
      </header>
      <a href="/admin/blog" className="admin-back-link">← Danh sách bài viết</a>
      <div className="admin-card" style={{ marginTop: '1rem' }}>
        <form action={updateAction} className="admin-form">
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label className="admin-form__label">Slug</label>
              <input name="slug" required defaultValue={post.slug} className="admin-form__input" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Thời gian đọc</label>
              <input name="read_time" defaultValue={post.read_time ?? ''} className="admin-form__input" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Tiêu đề</label>
              <input name="title" required defaultValue={post.title} className="admin-form__input" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Tóm tắt</label>
              <textarea name="excerpt" rows={2} defaultValue={post.excerpt ?? ''} className="admin-form__textarea" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Nội dung</label>
              <BlogEditor name="content" defaultValue={post.content ?? ''} bucket={BUCKETS.blog} />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <ImageDropzone
                bucket={BUCKETS.blog}
                label="Ảnh bài viết"
                defaultUrl={post.image_url ?? ''}
                defaultAlt={post.image_alt ?? ''}
                pathName="image_path"
              />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Thứ tự</label>
              <input name="sort_order" type="number" defaultValue={post.sort_order} className="admin-form__input" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__check">
                <input type="checkbox" name="is_published" defaultChecked={post.is_published} />
                Xuất bản
              </label>
            </div>
            <div className="admin-form__field">
              <label className="admin-form__check">
                <input type="checkbox" name="show_detail_image" defaultChecked={post.show_detail_image !== false} />
                Hiển thị ảnh ở trang chi tiết
              </label>
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Lưu thay đổi</button>
            <a href="/admin/blog" className="admin-btn admin-btn--ghost">Hủy</a>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
