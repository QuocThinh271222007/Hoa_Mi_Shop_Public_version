import 'server-only';
// SERVER-ONLY. Never import in client components.
// Determines whether a new payment request should use SePay auto-confirm
// or fall back to manual bank transfer, based on the monthly free quota.

import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';
import { APP_TIME_ZONE } from '@/lib/time';

export interface PaymentModeResult {
  paymentMode: 'sepay_auto' | 'manual_bank_transfer';
  provider: 'sepay' | null;
  quotaMonth: string;
  autoConfirmEligible: boolean;
  manualRequiredReason: string | null;
  quotaLimit: number;
  usedCount: number;
}

// Returns the current quota month as YYYY-MM in the shop's timezone (Vietnam).
// Using UTC here put the first 7 hours of each month into the PREVIOUS month's
// bucket, so quota was counted against — and reconciled on — the wrong row.
export function currentQuotaMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
}

/**
 * Robust boolean env parser. Accepts 'true' / '1' / 'yes' (case-insensitive,
 * whitespace-trimmed). Prevents a stray space or quote from silently disabling
 * SePay auto-confirm.
 */
export function envFlag(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export async function choosePaymentModeForNewRequest(): Promise<PaymentModeResult> {
  const enabled       = envFlag(process.env.SEPAY_ENABLED);
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
  const quotaLimit    = parseInt(process.env.SEPAY_MONTHLY_FREE_QUOTA ?? '50', 10);
  const providerName  = process.env.SEPAY_PROVIDER_NAME ?? 'sepay';
  const quotaMonth    = currentQuotaMonth();

  // Distinguish "explicitly disabled" from "enabled but secret missing" so the
  // admin/checkout reason is accurate.
  if (!enabled) {
    return {
      paymentMode: 'manual_bank_transfer',
      provider: null,
      quotaMonth,
      autoConfirmEligible: false,
      manualRequiredReason: 'sepay_disabled',
      quotaLimit,
      usedCount: 0,
    };
  }
  if (!webhookSecret) {
    return {
      paymentMode: 'manual_bank_transfer',
      provider: null,
      quotaMonth,
      autoConfirmEligible: false,
      manualRequiredReason: 'sepay_not_configured',
      quotaLimit,
      usedCount: 0,
    };
  }

  const db = createAdminSupabaseClient();
  const { data: usage } = await db
    .from('payment_provider_usage')
    .select('auto_success_count, auto_quota_limit, manual_adjustment')
    .eq('provider', providerName)
    .eq('quota_month', quotaMonth)
    .maybeSingle();

  const row = usage as { auto_success_count: number; auto_quota_limit: number; manual_adjustment: number | null } | null;
  const effectiveLimit = row?.auto_quota_limit ?? quotaLimit;
  // Effective usage includes the admin reconciliation offset for off-web credits,
  // so the auto→manual fallback triggers based on REAL remaining quota (F6).
  const usedCount = Math.max(0, (row?.auto_success_count ?? 0) + (row?.manual_adjustment ?? 0));

  if (usedCount < effectiveLimit) {
    return {
      paymentMode: 'sepay_auto',
      provider: 'sepay',
      quotaMonth,
      autoConfirmEligible: true,
      manualRequiredReason: null,
      quotaLimit: effectiveLimit,
      usedCount,
    };
  }

  return {
    paymentMode: 'manual_bank_transfer',
    provider: null,
    quotaMonth,
    autoConfirmEligible: false,
    manualRequiredReason: 'sepay_monthly_quota_exceeded',
    quotaLimit: effectiveLimit,
    usedCount,
  };
}

// Called after a SePay webhook auto-confirms a payment.
// Must not be called for admin manual confirmations.
// Low-concurrency safe: read-modify-write is fine for ~50/month volume.
export async function incrementSePayQuota(
  provider: string,
  quotaMonth: string,
  defaultLimit: number
): Promise<void> {
  const db = createAdminSupabaseClient();
  // Atomic upsert-increment (Q1). The previous read-modify-write silently lost
  // increments when two auto-confirms ran concurrently, and its `catch` block was
  // dead code (supabase-js returns { error } instead of throwing), so a duplicate
  // insert was swallowed and the increment vanished — a direct cause of the quota
  // drift admins had to reconcile by hand.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).rpc('increment_provider_quota', {
    p_provider: provider,
    p_quota_month: quotaMonth,
    p_default_limit: defaultLimit,
  });
  if (error) {
    // Never block payment confirmation on quota accounting — log and continue.
    console.error('increment_provider_quota failed:', error.message);
  }
}

export async function getProviderUsage(
  provider: string,
  quotaMonth: string
): Promise<{ auto_success_count: number; auto_quota_limit: number; manual_fallback_count: number; manual_adjustment: number } | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('payment_provider_usage')
    .select('auto_success_count, auto_quota_limit, manual_fallback_count, manual_adjustment')
    .eq('provider', provider)
    .eq('quota_month', quotaMonth)
    .maybeSingle();
  return data as { auto_success_count: number; auto_quota_limit: number; manual_fallback_count: number; manual_adjustment: number } | null;
}

/**
 * F6 reconciliation. Admin reads the REAL remaining free quota from the SePay
 * dashboard and enters it here; we store a manual_adjustment offset so both the
 * admin display and the auto→manual fallback reflect reality. Subsequent
 * auto-confirms keep decrementing correctly from this corrected baseline.
 *
 * manual_adjustment = effectiveLimit − auto_success_count − actualRemaining
 * (may be negative if we had over-counted). actualRemaining is clamped to
 * [0, effectiveLimit].
 */
export async function reconcileQuotaRemaining(
  provider: string,
  quotaMonth: string,
  actualRemaining: number,
  defaultLimit: number
): Promise<void> {
  const db = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from('payment_provider_usage')
    .select('id, auto_success_count, auto_quota_limit')
    .eq('provider', provider)
    .eq('quota_month', quotaMonth)
    .maybeSingle();
  const row = existing as { id: string; auto_success_count: number; auto_quota_limit: number } | null;

  const limit = row?.auto_quota_limit ?? defaultLimit;
  const auto  = row?.auto_success_count ?? 0;
  const clampedRemaining = Math.max(0, Math.min(limit, Math.floor(actualRemaining)));
  const adjustment = limit - auto - clampedRemaining;

  if (row) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('payment_provider_usage') as any)
      .update({ manual_adjustment: adjustment, updated_at: now })
      .eq('id', row.id);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('payment_provider_usage') as any).insert({
      provider,
      quota_month: quotaMonth,
      auto_quota_limit: limit,
      auto_success_count: 0,
      manual_fallback_count: 0,
      manual_adjustment: adjustment,
    });
  }
}
