import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import { getBlogPosts, createBlogPost, deleteBlogPost, toggleBlogPublished } from '@/lib/admin/blog-data';
import { AdminShell } from '../_components/AdminShell';
import { StatusBadge } from '../_components/StatusBadge';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { BUCKETS } from '@/lib/admin/storage';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  const { email } = await requireAdmin();

  const posts = await getBlogPosts().catch(() => []);

  async function createAction(formData: FormData) {
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
      published_at: formData.get('is_published') === 'on' ? new Date().toISOString() : null,
      show_detail_image: formData.get('show_detail_image') === 'on',
    };
    await createBlogPost(fields);
    redirect('/admin/blog');
  }

  async function toggleAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const val = formData.get('is_published') === 'true';
    await toggleBlogPublished(id, !val);
    redirect('/admin/blog');
  }

  async function deleteAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteBlogPost(id);
    redirect('/admin/blog');
  }

  return (
    <AdminShell email={email} activePath="/admin/blog">
      <header className="admin-header">
        <h1 className="admin-header__title">Blog CMS</h1>
        <p className="admin-header__subtitle">{posts.length} bài viết</p>
      </header>

      {/* Create form */}
      <details className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem 0' }}>+ Thêm bài viết mới</summary>
        <form action={createAction} className="admin-form" style={{ marginTop: '1rem' }}>
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label className="admin-form__label">Slug *</label>
              <input name="slug" required className="admin-form__input" placeholder="ten-bai-viet" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Thời gian đọc</label>
              <input name="read_time" className="admin-form__input" placeholder="2 phút đọc" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Tiêu đề *</label>
              <input name="title" required className="admin-form__input" placeholder="Tiêu đề bài viết" />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Tóm tắt</label>
              <textarea name="excerpt" rows={2} className="admin-form__textarea" placeholder="Tóm tắt ngắn..." />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">Nội dung</label>
              <BlogEditor name="content" bucket={BUCKETS.blog} />
            </div>
            <div className="admin-form__field admin-form__field--full">
              <ImageDropzone bucket={BUCKETS.blog} label="Ảnh bài viết" pathName="image_path" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__label">Thứ tự</label>
              <input name="sort_order" type="number" defaultValue={0} className="admin-form__input" />
            </div>
            <div className="admin-form__field">
              <label className="admin-form__check">
                <input type="checkbox" name="is_published" defaultChecked />
                Xuất bản ngay
              </label>
            </div>
            <div className="admin-form__field">
              <label className="admin-form__check">
                <input type="checkbox" name="show_detail_image" defaultChecked />
                Hiển thị ảnh ở trang chi tiết
              </label>
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="admin-btn admin-btn--primary">Tạo bài viết</button>
          </div>
        </form>
      </details>

      {/* List */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Tiêu đề</th>
              <th>Trạng thái</th>
              <th>Lượt xem</th>
              <th>Thứ tự</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr><td colSpan={7} className="admin-table__empty">Chưa có bài viết nào. Thêm bài viết đầu tiên.</td></tr>
            )}
            {posts.map(post => (
              <tr key={post.id}>
                <td><code style={{ fontSize: '0.75rem' }}>{post.slug}</code></td>
                <td>{post.title}</td>
                <td>
                  <StatusBadge status={post.is_published ? 'published' : 'draft'} />
                </td>
                <td>{post.views}</td>
                <td>{post.sort_order}</td>
                <td>{new Date(post.created_at).toLocaleDateString('vi-VN')}</td>
                <td className="admin-table__actions">
                  <form action={toggleAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={post.id} />
                    <input type="hidden" name="is_published" value={String(post.is_published)} />
                    <button type="submit" className="admin-btn admin-btn--sm admin-btn--ghost">
                      {post.is_published ? 'Ẩn' : 'Xuất bản'}
                    </button>
                  </form>
                  <a href={`/admin/blog/${post.id}`} className="admin-btn admin-btn--sm admin-btn--ghost">Sửa</a>
                  <form action={deleteAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={post.id} />
                    <button type="submit" className="admin-btn admin-btn--sm admin-btn--danger">
                      Xóa
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
