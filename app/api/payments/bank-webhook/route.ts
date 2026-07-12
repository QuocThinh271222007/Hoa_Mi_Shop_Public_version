import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { tryMatchTransaction } from '@/lib/admin/payments-data';

// POST /api/payments/bank-webhook
// Receives bank/payment provider transaction notifications.
// Provider-agnostic: expects a normalized JSON body (see below).
// Set PAYMENT_WEBHOOK_SECRET in .env.local to enable signature validation.
//
// Required env:
//   PAYMENT_WEBHOOK_SECRET  — server-only, validates X-Webhook-Signature header
//
// Expected body (provider-agnostic normalized format):
// {
//   provider:              string,       // e.g. 'sepay', 'vietqr', 'manual'
//   eventId?:             string,        // for idempotency
//   eventType?:           string,        // e.g. 'transaction.credit'
//   transaction: {
//     providerTransactionId?: string,
//     transactionTime?:       string,    // ISO 8601
//     amount:                 number,    // in VND (integer)
//     currency?:              string,    // default 'VND'
//     description?:           string,    // MUST contain payment code (e.g. DH-XXXXXX-XXXX)
//     bankAccountNumber?:     string,
//     counterpartyName?:      string,
//     counterpartyAccount?:   string,
//   }
// }

function validateSignature(
  headerValue: string | null,
  body: string,
  secret: string
): boolean {
  if (!headerValue) return false;
  const expected = createHash('sha256').update(body + secret).digest('hex');
  return headerValue === expected || headerValue === `sha256=${expected}`;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

  // Fail closed: this endpoint can mark orders as paid, so it must NEVER process
  // unsigned requests. If no secret is configured the webhook is disabled entirely
  // (same posture as the SePay webhook). Previously a missing secret meant every
  // request was treated as valid — an unauthenticated payment-confirmation bypass.
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Bank webhook not configured' }, { status: 503 });
  }

  const signature = req.headers.get('x-webhook-signature') ?? req.headers.get('x-signature');
  const sigValid = validateSignature(signature, rawBody, webhookSecret);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const provider  = (payload.provider as string | null) ?? 'unknown';
  const eventId   = (payload.eventId as string | null) ?? null;
  const eventType = (payload.eventType as string | null) ?? null;

  const db = createAdminSupabaseClient();

  // Store webhook event for audit / idempotency
  const { data: existingEvent } = await db
    .from('payment_webhook_events')
    .select('id')
    .eq('provider', provider)
    .eq('event_id', eventId ?? '')
    .maybeSingle();

  if (existingEvent && eventId) {
    // Already processed — idempotent response
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await db.from('payment_webhook_events').insert({
    provider,
    event_id:       eventId,
    event_type:     eventType,
    signature_valid: sigValid,
    raw_payload:    payload,
    processed_at:   new Date().toISOString(),
  });

  // Invalid signature — the audit event is stored above; reject processing.
  if (!sigValid) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  // Extract transaction data
  const txnRaw = (payload.transaction as Record<string, unknown>) ?? {};
  const amount = Number(txnRaw.amount ?? 0);

  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: true, skipped: 'no_amount' });
  }

  // Store bank transaction
  const { data: bankTxn, error: txnErr } = await db
    .from('bank_transactions')
    .insert({
      provider,
      provider_transaction_id: (txnRaw.providerTransactionId as string | null) ?? null,
      transaction_time:        (txnRaw.transactionTime as string | null) ?? new Date().toISOString(),
      amount,
      currency:                (txnRaw.currency as string | null) ?? 'VND',
      description:             (txnRaw.description as string | null) ?? null,
      bank_account_number:     (txnRaw.bankAccountNumber as string | null) ?? null,
      counterparty_name:       (txnRaw.counterpartyName as string | null) ?? null,
      counterparty_account:    (txnRaw.counterpartyAccount as string | null) ?? null,
      status:                  'unmatched',
      raw_payload:             payload,
    })
    .select('id')
    .single();

  if (txnErr) {
    // Likely a duplicate provider_transaction_id — safe to ignore
    console.warn('Bank transaction insert skipped:', txnErr.message);
    return NextResponse.json({ ok: true, skipped: 'duplicate_transaction' });
  }

  // Try automatic matching
  const matched = await tryMatchTransaction((bankTxn as { id: string }).id);

  return NextResponse.json({ ok: true, matched });
}
