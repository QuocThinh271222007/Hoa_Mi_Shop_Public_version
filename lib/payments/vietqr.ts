export type VietQrParams = {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  addInfo: string;
  template?: 'compact' | 'compact2' | 'qr_only';
};

/**
 * Builds a VietQR Quick Link image URL so the banking app auto-fills amount
 * and transfer content when the customer scans the QR.
 * Returns '' if any required field is missing or amount ≤ 0.
 * This is a pure URL builder — no external call is made server-side.
 */
export function buildVietQrImageUrl(params: VietQrParams): string {
  const { bankId, accountNo, accountName, amount, addInfo, template = 'compact2' } = params;

  if (!bankId?.trim() || !accountNo?.trim() || !accountName?.trim() || !addInfo?.trim()) return '';
  if (!Number.isFinite(amount) || amount <= 0) return '';

  const amountInt = Math.round(amount);
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bankId.trim())}-${encodeURIComponent(accountNo.trim())}-${encodeURIComponent(template)}.png`;
  const query = new URLSearchParams({
    amount: String(amountInt),
    addInfo: addInfo.trim(),
    accountName: accountName.trim(),
  });

  return `${base}?${query.toString()}`;
}
