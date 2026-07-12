import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { countDiscountUsageForPaidOrder } from '@/lib/payments/discount-usage';
import { paymentCodeMatchesContent } from '@/lib/payments/payment-code';
import { applyOrderStock } from './order-stock';
import type { AdminPaymentRequest, AdminBankTransaction, AdminPaymentProviderUsage } from './types';

const PR_FIELDS =
  'id, order_id, amount, currency, method, status, payment_code, bank_account_name, bank_account_number, bank_name, bank_branch, qr_payload, provider, provider_status, expires_at, paid_at, matched_transaction_id, admin_note, payment_mode, quota_month, quota_counted, auto_confirm_eligible, manual_required_reason, created_at, updated_at';

const TXN_FIELDS =
  'id, provider, provider_transaction_id, transaction_time, amount, currency, description, bank_account_number, counterparty_name, status, matched_order_id, matched_payment_request_id, match_failure_reason, created_at';

// ── Payment requests ──────────────────────────────────────────────────

export async function getPaymentRequests(status?: string, paymentMode?: string, provider?: string, search?: string): Promise<AdminPaymentRequest[]> {
  const db = createAdminSupabaseClient();
  let query = db
    .from('payment_requests')
    .select(PR_FIELDS)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') query = query.eq('status', status);
  if (paymentMode && paymentMode !== 'all') query = query.eq('payment_mode', paymentMode);
  if (provider && provider !== 'all') query = query.eq('provider', provider);
  // Search by the order code (= payment_code / transfer note).
  if (search && search.trim()) {
    const s = search.trim().replace(/[%,()]/g, '');
    query = query.ilike('payment_code', `%${s}%`);
  }
  const { data } = await query;
  return (data ?? []) as AdminPaymentRequest[];
}

export async function getProviderUsageSummary(provider: string, quotaMonth: string): Promise<AdminPaymentProviderUsage | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('payment_provider_usage')
    .select('id, provider, quota_month, auto_quota_limit, auto_success_count, manual_fallback_count, created_at, updated_at')
    .eq('provider', provider)
    .eq('quota_month', quotaMonth)
    .maybeSingle();
  return (data as AdminPaymentProviderUsage) ?? null;
}

export async function getPaymentRequestByOrderId(orderId: string): Promise<AdminPaymentRequest | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('payment_requests')
    .select(PR_FIELDS)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return (data as AdminPaymentRequest) ?? null;
}

export async function getPaymentRequestById(id: string): Promise<AdminPaymentRequest | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('payment_requests')
    .select(PR_FIELDS)
    .eq('id', id)
    .single();
  return (data as AdminPaymentRequest) ?? null;
}

// ── Bank transactions ────────────────────────────────────────────────

export async function getBankTransactions(status?: string): Promise<AdminBankTransaction[]> {
  const db = createAdminSupabaseClient();
  let query = db
    .from('bank_transactions')
    .select(TXN_FIELDS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data } = await query;
  return (data ?? []) as AdminBankTransaction[];
}

// ── Manual reconciliation (admin only) ─────────────────────────────

export async function manualMatchTransaction(
  transactionId: string,
  paymentRequestId: string,
  adminNote: string
): Promise<void> {
  const db = createAdminSupabaseClient();

  // Fetch both to verify amounts still make sense
  const [txnResult, prResult] = await Promise.all([
    db.from('bank_transactions').select('id, amount, status').eq('id', transactionId).single(),
    db.from('payment_requests').select('id, order_id, amount, status').eq('id', paymentRequestId).single(),
  ]);

  if (!txnResult.data || !prResult.data) {
    throw new Error('Transaction or payment request not found.');
  }

  const now = new Date().toISOString();

  // Update bank_transaction
  await db.from('bank_transactions').update({
    status: 'matched',
    matched_payment_request_id: paymentRequestId,
    matched_order_id: (prResult.data as { order_id: string }).order_id,
  }).eq('id', transactionId);

  // Update payment_request
  await db.from('payment_requests').update({
    status: 'paid',
    paid_at: now,
    matched_transaction_id: transactionId,
    admin_note: adminNote || 'Manually matched by admin',
    updated_at: now,
  }).eq('id', paymentRequestId);

  // Update order — payment confirmed advances it to 'confirmed' (Chờ lấy)
  const orderId = (prResult.data as { order_id: string }).order_id;
  await db.from('orders').update({
    payment_status: 'paid',
    paid_at: now,
    bank_transaction_id: transactionId,
    status: 'confirmed',
    confirmed_at: now,
    updated_at: now,
  }).eq('id', orderId);

  // Count discount usage exactly once now that payment is confirmed (idempotent)
  await countDiscountUsageForPaidOrder(orderId);
  // Payment confirmed → order enters fulfilment → deduct stock (idempotent).
  await applyOrderStock(orderId, 'deduct');
}

export async function adminMarkPaymentPaid(
  paymentRequestId: string,
  adminNote: string
): Promise<void> {
  const db = createAdminSupabaseClient();
  const { data: pr } = await db
    .from('payment_requests')
    .select('id, order_id')
    .eq('id', paymentRequestId)
    .single();
  if (!pr) throw new Error('Payment request not found.');

  const now = new Date().toISOString();
  await db.from('payment_requests').update({
    status: 'paid',
    paid_at: now,
    admin_note: adminNote || 'Manually confirmed by admin',
    updated_at: now,
  }).eq('id', paymentRequestId);

  const paidOrderId = (pr as { order_id: string }).order_id;
  await db.from('orders').update({
    payment_status: 'paid',
    paid_at: now,
    status: 'confirmed',
    confirmed_at: now,
    updated_at: now,
  }).eq('id', paidOrderId);

  // Count discount usage exactly once now that payment is confirmed (idempotent)
  await countDiscountUsageForPaidOrder(paidOrderId);
  await applyOrderStock(paidOrderId, 'deduct');
}

export async function adminMarkPaymentFailed(
  paymentRequestId: string,
  reason: string
): Promise<void> {
  const db = createAdminSupabaseClient();
  const { data: pr } = await db
    .from('payment_requests')
    .select('id, order_id')
    .eq('id', paymentRequestId)
    .single();
  if (!pr) throw new Error('Payment request not found.');

  const now = new Date().toISOString();
  const failedOrderId = (pr as { order_id: string }).order_id;

  // 1. Core payment-request update — only guaranteed columns, so this can never
  //    fail because an optional timestamp column is missing. This is the update
  //    that must always succeed so the request leaves AWAITING_PAYMENT.
  const { error: prErr } = await db.from('payment_requests').update({
    status: 'failed',
    admin_note: reason || 'Marked failed by admin',
    updated_at: now,
  }).eq('id', paymentRequestId);
  if (prErr) throw new Error(prErr.message);

  // 2. Core order update — a failed payment cancels the order so it moves to
  //    "Đã hủy" in customer history (unless already shipped/delivered).
  const { data: ord } = await db.from('orders').select('status').eq('id', failedOrderId).single();
  const status   = (ord as { status: string | null } | null)?.status ?? null;
  const advanced = status === 'delivered' || status === 'shipped' || status === 'shipping';
  const { error: ordErr } = await db.from('orders').update({
    payment_status: 'failed',
    status: advanced ? (status as string) : 'cancelled',
    updated_at: now,
  }).eq('id', failedOrderId);
  if (ordErr) throw new Error(ordErr.message);

  // 3. Best-effort lifecycle timestamps — these columns are added by
  //    20260624_order_flow_completion.sql; ignore errors on older DBs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from('payment_requests') as any).update({ cancelled_at: now }).eq('id', paymentRequestId);
  if (!advanced) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('orders') as any).update({ cancelled_at: now }).eq('id', failedOrderId);
    // Give stock back if this order had been deducted (idempotent — no-op for
    // unpaid orders that were never deducted).
    await applyOrderStock(failedOrderId, 'restore');
  }
}

// ── Transaction matching (called by webhook handler) ─────────────────

export async function tryMatchTransaction(bankTxnId: string): Promise<boolean> {
  const db = createAdminSupabaseClient();

  const { data: txn } = await db
    .from('bank_transactions')
    .select('id, description, amount, transaction_time')
    .eq('id', bankTxnId)
    .single();

  if (!txn) return false;
  const t = txn as { id: string; description: string | null; amount: number; transaction_time: string | null };

  if (!t.description) {
    await db.from('bank_transactions').update({
      status: 'unmatched', match_failure_reason: 'No description/content',
    }).eq('id', bankTxnId);
    return false;
  }

  // Match by scanning awaiting_payment OR awaiting_verification requests whose payment_code appears in the description.
  // awaiting_verification means customer already clicked "Tôi đã chuyển khoản" — webhook can still auto-confirm.
  // Exact (dashed) then compact (alphanumeric) match — banks may strip dashes from the memo.
  const { data: candidates } = await db
    .from('payment_requests')
    .select('id, order_id, amount, status, expires_at, payment_code')
    .in('status', ['awaiting_payment', 'awaiting_verification'])
    .order('created_at', { ascending: false })
    .limit(100);

  type PrRow = { id: string; order_id: string; amount: number; status: string; expires_at: string | null; payment_code: string };

  const pr = ((candidates ?? []) as PrRow[]).find(
    (row) => row.payment_code && paymentCodeMatchesContent(row.payment_code, t.description!)
  );

  if (!pr) {
    await db.from('bank_transactions').update({
      status: 'unmatched', match_failure_reason: 'No matching payment code found in description',
    }).eq('id', bankTxnId);
    return false;
  }

  const p = pr;

  if (p.status !== 'awaiting_payment' && p.status !== 'awaiting_verification') {
    await db.from('bank_transactions').update({
      status: 'unmatched', match_failure_reason: `Payment request already ${p.status}`,
    }).eq('id', bankTxnId);
    return false;
  }

  if (p.amount !== t.amount) {
    await db.from('bank_transactions').update({
      status: 'unmatched',
      match_failure_reason: `Amount mismatch: expected ${p.amount}, got ${t.amount}`,
    }).eq('id', bankTxnId);
    return false;
  }

  if (p.expires_at && new Date(p.expires_at) < new Date()) {
    await db.from('bank_transactions').update({
      status: 'unmatched', match_failure_reason: 'Payment request expired',
    }).eq('id', bankTxnId);
    return false;
  }

  // Matched!
  const now = new Date().toISOString();
  await db.from('bank_transactions').update({
    status: 'matched',
    matched_payment_request_id: p.id,
    matched_order_id: p.order_id,
  }).eq('id', bankTxnId);

  await db.from('payment_requests').update({
    status: 'paid', paid_at: now,
    matched_transaction_id: bankTxnId, updated_at: now,
  }).eq('id', p.id);

  await db.from('orders').update({
    payment_status: 'paid', paid_at: now,
    bank_transaction_id: bankTxnId, updated_at: now,
  }).eq('id', p.order_id);

  // Count discount usage exactly once now that payment is confirmed (idempotent)
  await countDiscountUsageForPaidOrder(p.order_id);
  await applyOrderStock(p.order_id, 'deduct');

  return true;
}
