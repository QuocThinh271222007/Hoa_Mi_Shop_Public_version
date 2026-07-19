'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth-check';
import {
  manualMatchTransaction,
  adminMarkPaymentPaid,
  adminMarkPaymentFailed,
} from '@/lib/admin/payments-data';
import { reconcileQuotaRemaining, currentQuotaMonth } from '@/lib/payments/provider-quota';

export async function actionManualMatch(formData: FormData) {
  await requireAdmin();
  const transactionId    = formData.get('transactionId') as string;
  const paymentRequestId = formData.get('paymentRequestId') as string;
  const adminNote        = (formData.get('adminNote') as string | null) ?? '';
  if (!transactionId || !paymentRequestId) return;

  await manualMatchTransaction(transactionId, paymentRequestId, adminNote);
  revalidatePath('/admin/payments');
  revalidatePath('/admin/orders');
}

export async function actionMarkPaid(formData: FormData) {
  await requireAdmin();
  const paymentRequestId = formData.get('paymentRequestId') as string;
  const adminNote        = (formData.get('adminNote') as string | null) ?? '';
  if (!paymentRequestId) return;

  await adminMarkPaymentPaid(paymentRequestId, adminNote);
  revalidatePath('/admin/payments');
  revalidatePath('/admin/orders');
}

// F6 — admin reconciles the real remaining SePay free quota (read off the SePay
// dashboard). provider + quota month are resolved server-side; only the number is
// taken from the form.
export async function actionReconcileQuota(formData: FormData) {
  await requireAdmin();
  const raw = (formData.get('actualRemaining') as string | null) ?? '';
  const actualRemaining = parseInt(raw, 10);
  if (Number.isNaN(actualRemaining) || actualRemaining < 0) return;

  const provider    = process.env.SEPAY_PROVIDER_NAME ?? 'sepay';
  const quotaMonth  = currentQuotaMonth();
  const defaultLimit = parseInt(process.env.SEPAY_MONTHLY_FREE_QUOTA ?? '50', 10);

  await reconcileQuotaRemaining(provider, quotaMonth, actualRemaining, defaultLimit);
  revalidatePath('/admin/payments');
}

export async function actionMarkFailed(formData: FormData) {
  await requireAdmin();
  const paymentRequestId = formData.get('paymentRequestId') as string;
  const reason           = (formData.get('reason') as string | null) ?? '';
  if (!paymentRequestId) return;

  await adminMarkPaymentFailed(paymentRequestId, reason);
  revalidatePath('/admin/payments');
  revalidatePath('/admin/orders');
}
