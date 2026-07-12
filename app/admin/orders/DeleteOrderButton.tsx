'use client';

import { actionDeleteOrder } from './actions';
import { ConfirmSubmitButton } from './ConfirmSubmitButton';

export function DeleteOrderButton({
  orderId,
  label,
}: {
  orderId: string;
  label: string;
}) {
  return (
    <form action={actionDeleteOrder} style={{ display: 'inline' }}>
      <input type="hidden" name="orderId" value={orderId} />
      <ConfirmSubmitButton
        confirmMessage={`Xóa đơn hàng ${label}? Hành động không thể hoàn tác.`}
        className="admin-link"
        style={{
          color: '#dc2626',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: 'inherit',
        }}
      >
        Xóa
      </ConfirmSubmitButton>
    </form>
  );
}
