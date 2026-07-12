// SERVER-ONLY. Never import in client components.
//
// On-demand reconciliation against the bank_transactions table that the SePay
// webhook populates. Used by /api/checkout/confirm so that clicking
// "Tôi đã chuyển khoản" only succeeds when SePay has actually recorded a matching
// credit — otherwise the customer is told the transfer failed (chưa thanh toán)
// or the memo was wrong (sai nội dung).

import { paymentCodeMatchesContent } from '@/lib/payments/payment-code';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = SupabaseClient<any, any, any>;

export type BankTxn = {
  id: string;
  amount: number;
  description: string | null;
  status: string | null;
  matched_order_id: string | null;
  transaction_time: string | null;
};

export type SePayMatchResult =
  | { outcome: 'paid'; transaction: BankTxn }
  | { outcome: 'wrong_content'; transaction: BankTxn; reason: 'amount_mismatch' | 'code_not_found' }
  | { outcome: 'not_paid' };

/**
 * Looks for a SePay credit that pays for this order.
 *
 * Priority:
 *   1. paid          — a transaction whose memo contains the payment code AND the
 *                      amount matches exactly (and is not already consumed).
 *   2. wrong_content — memo contains the code but the amount is wrong, OR a
 *                      transfer of the exact amount exists but without the code in
 *                      its memo (customer forgot / mistyped the content).
 *   3. not_paid      — no candidate transaction at all.
 *
 * Only recent, unconsumed credits are considered. `bank_transactions` already
 * holds credits only (the webhook skips debits).
 */
export async function findSePayMatch(
  db: AnyDb,
  paymentCode: string,
  expectedAmount: number,
  windowHours = 72,
): Promise<SePayMatchResult> {
  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

  const { data } = await db
    .from('bank_transactions')
    .select('id, amount, description, status, matched_order_id, transaction_time')
    .gte('transaction_time', since)
    .order('transaction_time', { ascending: false })
    .limit(300);

  const txns = (data ?? []) as BankTxn[];

  // Exclude transactions already consumed by a confirmed/paid order.
  const available = txns.filter(
    (t) => t.status !== 'matched' && !t.matched_order_id,
  );

  // 1. Code in memo + exact amount → real payment.
  const paid = available.find(
    (t) =>
      paymentCodeMatchesContent(paymentCode, t.description ?? '') &&
      Number(t.amount) === expectedAmount,
  );
  if (paid) return { outcome: 'paid', transaction: paid };

  // 2a. Code found but amount does not match → needs admin.
  const codeOnly = available.find((t) =>
    paymentCodeMatchesContent(paymentCode, t.description ?? ''),
  );
  if (codeOnly) return { outcome: 'wrong_content', transaction: codeOnly, reason: 'amount_mismatch' };

  // 2b. Exact amount arrived but the memo is missing/wrong → likely wrong content.
  const amountOnly = available.find((t) => Number(t.amount) === expectedAmount);
  if (amountOnly) return { outcome: 'wrong_content', transaction: amountOnly, reason: 'code_not_found' };

  // 3. Nothing found.
  return { outcome: 'not_paid' };
}
