'use client';

import { actionDeleteProduct } from './actions';

// Delete button + native confirm. Client component so the confirm() handler is
// allowed (server components can't attach onClick).
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={actionDeleteProduct} style={{ display: 'inline' }}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="admin-link"
        style={{
          color: '#dc2626',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: 'inherit',
        }}
        onClick={(e) => {
          if (!confirm(`Xóa sản phẩm "${name}"? Hành động không thể hoàn tác.`)) {
            e.preventDefault();
          }
        }}
      >
        Xóa
      </button>
    </form>
  );
}
