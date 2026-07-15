import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { incrementSePayQuota, currentQuotaMonth, envFlag } from '@/lib/payments/provider-quota';
import { countDiscountUsageForPaidOrder } from '@/lib/payments/discount-usage';
import { paymentCodeMatchesContent } from '@/lib/payments/payment-code';
import { sendPurchaseForOrder } from '@/lib/analytics/ga-server';

// POST /api/payments/sepay-webhook
// Receives transaction notifications from SePay.
//
// Authentication: HMAC-SHA256
//   SePay signs the raw JSON body with SEPAY_WEBHOOK_SECRET.
//   Signature is delivered in header:  x-SePay-Signature  (hex or sha256=<hex>)
//   Secret format: whsec_...
//
// Required env (server-only):
//   SEPAY_WEBHOOK_SECRET  — HMAC secret from SePay dashboard (whsec_...)
//   SEPAY_ENABLED         — must be 'true' to process webhooks
//
// SePay webhook body format (HMAC mode — no apiKey field in body):
// {
//   id:              number,      // SePay transaction ID
//   gateway:         string,      // bank gateway e.g. 'VCB'
//   transactionDate: string,      // 'YYYY-MM-DD HH:mm:ss'
//   accountNumber:   string,      // bank account number
//   code:            string|null, // payment code extracted by SePay
//   content:         string,      // full transfer description — contains DH-XXXXXX-XXXX
//   transferType:    string,      // 'in' | 'out'
//   transferAmount:  number,      // amount in VND
//   accumulated:     number,
//   referenceCode:   string|null,
//   description:     string,
// }

/**
 * Verifies the SePay HMAC-SHA256 signature.
 *
 * Per the SePay dashboard config, the signature is computed over
 *   timestamp + "." + rawBody
 * and delivered as  x-SePay-Signature: sha256=<hex>  with the timestamp in
 * the  x-SePay-Timestamp  header. Uses a timing-safe comparison.
 */
function verifySePaySignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !signature || !timestamp) return false;

  // expected = "sha256=" + HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
  const expected = 'sha256=' + createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  // Normalize the provided signature to always carry the 'sha256=' prefix
  const provided = signature.startsWith('sha256=') ? signature : `sha256=${signature}`;

  // Length mismatch means invalid format — reject without timing leak
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(provided.toLowerCase(), 'utf8')
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // 1. Read raw body BEFORE any parsing — HMAC is computed over the raw bytes
  const rawBody = await req.text();

  // 2. Guard: SePay must be configured
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret || !envFlag(process.env.SEPAY_ENABLED)) {
    return NextResponse.json({ error: 'SePay not configured' }, { status: 503 });
  }

  // 3. Verify HMAC-SHA256 signature over `timestamp + "." + rawBody`.
  //    NextRequest.headers.get() is case-insensitive per HTTP spec.
  const signature = req.headers.get('x-sepay-signature');
  const timestamp = req.headers.get('x-sepay-timestamp');
  const sigValid  = verifySePaySignature(rawBody, timestamp, signature, secret);

  // 4. Parse JSON (needed for audit log and processing)
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sePayId  = String(payload.id ?? '');
  const provider = 'sepay';
  const db       = createAdminSupabaseClient();

  // 5. Reject invalid signature — store audit event then return 401
  //    Do NOT check idempotency or process transactions for invalid requests.
  if (!sigValid) {
    await db.from('payment_webhook_events').insert({
      provider,
      event_id:        sePayId || null,
      event_type:      'transaction.credit',
      signature_valid: false,
      raw_payload:     payload,
      processed_at:    new Date().toISOString(),
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 6. Idempotency check — only for requests with valid signatures
  //    Prevents double-confirming an order or double-counting quota on retries.
  if (sePayId) {
    const { data: existingEvent } = await db
      .from('payment_webhook_events')
      .select('id')
      .eq('provider', provider)
      .eq('event_id', sePayId)
      .eq('signature_valid', true)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  // 7. Skip non-credit (outgoing) transactions
  if ((payload.transferType as string | null) !== 'in') {
    await db.from('payment_webhook_events').insert({
      provider,
      event_id:        sePayId || null,
      event_type:      'transaction.debit',
      signature_valid: true,
      raw_payload:     payload,
      processed_at:    new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, skipped: 'not_credit' });
  }

  const amount = Number(payload.transferAmount ?? 0);
  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: true, skipped: 'no_amount' });
  }

  // 8. Store validated webhook event
  await db.from('payment_webhook_events').insert({
    provider,
    event_id:        sePayId || null,
    event_type:      'transaction.credit',
    signature_valid: true,
    raw_payload:     payload,
    processed_at:    new Date().toISOString(),
  });

  // 9. Normalize to bank_transactions
  const description = (payload.content as string | null) ?? (payload.description as string | null) ?? null;
  const txDate      = (payload.transactionDate as string | null) ?? null;
  const txTime      = txDate
    ? new Date(txDate.replace(' ', 'T') + '+07:00').toISOString()
    : new Date().toISOString();

  const { data: bankTxn, error: txnErr } = await db
    .from('bank_transactions')
    .insert({
      provider,
      provider_transaction_id: sePayId || null,
      transaction_time:        txTime,
      amount,
      currency:                'VND',
      description,
      bank_account_number:     (payload.accountNumber as string | null) ?? null,
      counterparty_name:       null,
      counterparty_account:    null,
      status:                  'unmatched',
      raw_payload:             payload,
    })
    .select('id')
    .single();

  if (txnErr) {
    // Duplicate provider_transaction_id — already stored, matching already ran
    return NextResponse.json({ ok: true, skipped: 'duplicate_transaction' });
  }

  // 10. Match to payment_request
  const bankTxnId = (bankTxn as { id: string }).id;
  const result    = await tryMatchSePayTransaction(bankTxnId, description, amount, db);

  return NextResponse.json({ ok: true, ...result });
}

type MatchResult = {
  matched: boolean;
  autoConfirmed?: boolean;
  manualPending?: boolean;
  reason?: string;
};

async function tryMatchSePayTransaction(
  bankTxnId: string,
  description: string | null,
  amount: number,
  db: ReturnType<typeof createAdminSupabaseClient>
): Promise<MatchResult> {
  if (!description) {
    await db.from('bank_transactions').update({
      status: 'unmatched',
      match_failure_reason: 'no_description',
    }).eq('id', bankTxnId);
    return { matched: false, reason: 'no_description' };
  }

  // Scan ALL awaiting requests (awaiting_payment OR awaiting_verification) by
  // payment code — NOT just sepay_auto. A request created while SEPAY_ENABLED was
  // still false (or before a restart) is `manual_bank_transfer`; we must still be
  // able to LINK the transaction so admin sees it matched, even though we will not
  // auto-confirm a manual-mode request. (This was the root cause of "paid but not
  // auto-confirmed": the matcher previously skipped non-sepay_auto requests.)
  const { data: candidates } = await db
    .from('payment_requests')
    .select('id, order_id, amount, status, expires_at, payment_mode, quota_month, quota_counted, payment_code')
    .in('status', ['awaiting_payment', 'awaiting_verification'])
    .order('created_at', { ascending: false })
    .limit(200);

  type PrRow = {
    id: string; order_id: string; amount: number; status: string;
    expires_at: string | null; payment_mode: string;
    quota_month: string | null; quota_counted: boolean;
    payment_code: string;
  };

  // Exact (dashed) match first, then compact (alphanumeric) fallback — banking
  // apps often strip dashes from the VietQR memo, so DB `DH-20964F-LABO` can arrive
  // as `DH20964FLABO`. compactPaymentCode/paymentCodeMatchesContent handle both.
  const p = ((candidates ?? []) as PrRow[]).find(
    (row) => row.payment_code && paymentCodeMatchesContent(row.payment_code, description)
  );

  if (!p) {
    await db.from('bank_transactions').update({
      status: 'unmatched',
      match_failure_reason: 'payment_code_not_found',
    }).eq('id', bankTxnId);
    return { matched: false, reason: 'payment_code_not_found' };
  }

  if (p.amount !== amount) {
    await db.from('bank_transactions').update({
      status: 'unmatched',
      matched_payment_request_id: p.id,
      matched_order_id: p.order_id,
      match_failure_reason: `amount_mismatch: expected ${p.amount}, got ${amount}`,
    }).eq('id', bankTxnId);
    return { matched: false, reason: 'amount_mismatch' };
  }

  if (p.expires_at && new Date(p.expires_at) < new Date()) {
    await db.from('bank_transactions').update({
      status: 'unmatched',
      matched_payment_request_id: p.id,
      matched_order_id: p.order_id,
      match_failure_reason: 'expired',
    }).eq('id', bankTxnId);
    return { matched: false, reason: 'expired' };
  }

  const now = new Date().toISOString();

  // Code + amount matched and not expired. Branch on payment mode.
  // Business rule: only sepay_auto requests are auto-confirmed (these were eligible
  // within the monthly quota at creation time). Manual-mode requests are linked but
  // left for admin to confirm — the webhook never overrides the manual fallback.
  if (p.payment_mode !== 'sepay_auto') {
    await db.from('bank_transactions').update({
      status:                     'matched_pending_admin',
      matched_payment_request_id: p.id,
      matched_order_id:           p.order_id,
      matched_at:                 now,
      match_failure_reason:       `manual_mode_admin_confirmation_required (payment_mode=${p.payment_mode})`,
    }).eq('id', bankTxnId);
    // Record that the customer's money arrived, without confirming payment.
    await db.from('payment_requests').update({
      provider_status: 'matched_pending_admin',
      updated_at:      now,
    }).eq('id', p.id);
    return { matched: true, autoConfirmed: false, manualPending: true };
  }

  // sepay_auto — auto-confirm. Update all records (best-effort; no distributed tx).
  await db.from('bank_transactions').update({
    status:                      'matched',
    matched_payment_request_id:  p.id,
    matched_order_id:            p.order_id,
    matched_at:                  now,
  }).eq('id', bankTxnId);

  await db.from('payment_requests').update({
    status:                 'paid',
    paid_at:                now,
    matched_transaction_id: bankTxnId,
    provider_status:        'confirmed',
    quota_counted:          true,
    updated_at:             now,
  }).eq('id', p.id);

  await db.from('orders').update({
    payment_status:      'paid',
    paid_at:             now,
    bank_transaction_id: bankTxnId,
    status:              'confirmed',
    updated_at:          now,
  }).eq('id', p.order_id);

  // Count discount usage exactly once now that payment is confirmed (idempotent)
  await countDiscountUsageForPaidOrder(p.order_id);

  // GA4 purchase — server-side, exactly once (dedup via orders.ga_purchase_sent_at).
  // This is the authoritative purchase for bank-transfer orders: it fires only
  // after SePay confirms the money arrived, never at order creation.
  await sendPurchaseForOrder(db, p.order_id);

  // Increment monthly quota — only once per payment (idempotency via quota_counted)
  if (!p.quota_counted) {
    const quotaMonth   = p.quota_month ?? currentQuotaMonth();
    const defaultLimit = parseInt(process.env.SEPAY_MONTHLY_FREE_QUOTA ?? '50', 10);
    await incrementSePayQuota('sepay', quotaMonth, defaultLimit);
  }

  return { matched: true, autoConfirmed: true };
}
