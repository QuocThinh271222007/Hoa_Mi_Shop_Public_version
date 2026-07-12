// SERVER-ONLY. Never import in client components.
// Determines whether a new payment request should use SePay auto-confirm
// or fall back to manual bank transfer, based on the monthly free quota.

import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

export interface PaymentModeResult {
  paymentMode: 'sepay_auto' | 'manual_bank_transfer';
  provider: 'sepay' | null;
  quotaMonth: string;
  autoConfirmEligible: boolean;
  manualRequiredReason: string | null;
  quotaLimit: number;
  usedCount: number;
}

// Returns current quota month as YYYY-MM in UTC.
export function currentQuotaMonth(): string {
  return new Date().toISOString().slice(0, 7);
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
    .select('auto_success_count, auto_quota_limit')
    .eq('provider', providerName)
    .eq('quota_month', quotaMonth)
    .maybeSingle();

  const row = usage as { auto_success_count: number; auto_quota_limit: number } | null;
  const usedCount      = row?.auto_success_count ?? 0;
  const effectiveLimit = row?.auto_quota_limit ?? quotaLimit;

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
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from('payment_provider_usage')
    .select('id, auto_success_count')
    .eq('provider', provider)
    .eq('quota_month', quotaMonth)
    .maybeSingle();

  const row = existing as { id: string; auto_success_count: number } | null;

  if (row) {
    await db.from('payment_provider_usage').update({
      auto_success_count: row.auto_success_count + 1,
      updated_at: now,
    }).eq('id', row.id);
  } else {
    try {
      await db.from('payment_provider_usage').insert({
        provider,
        quota_month: quotaMonth,
        auto_quota_limit: defaultLimit,
        auto_success_count: 1,
        manual_fallback_count: 0,
      });
    } catch {
      // Row was concurrently inserted — increment
      await db.from('payment_provider_usage').update({
        auto_success_count: 1,
        updated_at: now,
      }).eq('provider', provider).eq('quota_month', quotaMonth);
    }
  }
}

export async function getProviderUsage(
  provider: string,
  quotaMonth: string
): Promise<{ auto_success_count: number; auto_quota_limit: number; manual_fallback_count: number } | null> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from('payment_provider_usage')
    .select('auto_success_count, auto_quota_limit, manual_fallback_count')
    .eq('provider', provider)
    .eq('quota_month', quotaMonth)
    .maybeSingle();
  return data as { auto_success_count: number; auto_quota_limit: number; manual_fallback_count: number } | null;
}
