'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth-check';
import {
  upsertSiteSetting, createLocationOption, updateLocationOption, deleteLocationOption,
  upsertPickupDayOverride, deletePickupDayOverride,
  upsertPickupWeekdayRule, deletePickupWeekdayRule,
} from '@/lib/admin/settings-data';

// Keys that directly affect where customer money is sent.
// Changes to these are logged with admin identity and timestamp.
const SENSITIVE_SETTING_KEYS = new Set([
  'checkout_bank_account_number',
  'checkout_bank_account_name',
  'checkout_bank_name',
  'checkout_bank_id',
  'checkout_bank_branch',
]);

export async function actionSaveSettings(formData: FormData) {
  const admin = await requireAdmin();
  const entries = Array.from(formData.entries());
  for (const [key, value] of entries) {
    if (key.startsWith('setting_')) {
      const settingKey = key.replace('setting_', '');
      if (SENSITIVE_SETTING_KEYS.has(settingKey)) {
        // Audit log for bank/payment settings — critical for fraud detection.
        console.warn(
          `[AUDIT] Admin "${admin.email}" changed sensitive setting "${settingKey}" at ${new Date().toISOString()}`,
        );
      }
      await upsertSiteSetting(settingKey, value as string);
    }
  }
  revalidatePath('/admin/settings');
  redirect('/admin/settings?success=saved');
}

export async function actionCreateLocation(formData: FormData) {
  await requireAdmin();
  const name = (formData.get('name') as string | null)?.trim();
  const type = formData.get('type') as string || 'province';
  const parentId = (formData.get('parent_id') as string | null)?.trim() || null;
  if (!name) redirect('/admin/settings?error=required');

  try {
    await createLocationOption({
      type,
      name,
      parent_id:  parentId,
      sort_order: parseInt(formData.get('sort_order') as string || '0'),
      shipping_fee: Math.max(0, parseInt(formData.get('shipping_fee') as string || '0') || 0),
      is_active:  true,
    });
  } catch (err) {
    const isDuplicate = err instanceof Error && /duplicate key|unique/i.test(err.message);
    const msg = isDuplicate
      ? `Đã tồn tại địa điểm cùng tên: "${name}". Vui lòng đặt tên/địa chỉ khác.`
      : 'Không thể thêm địa điểm. Vui lòng thử lại.';
    redirect(`/admin/settings?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/admin/settings');
  redirect('/admin/settings?success=location_added');
}

export async function actionToggleLocation(formData: FormData) {
  await requireAdmin();
  const id       = formData.get('id') as string;
  const isActive = formData.get('is_active') === 'true';
  await updateLocationOption(id, { is_active: isActive });
  revalidatePath('/admin/settings');
}

export async function actionDeleteLocation(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await deleteLocationOption(id);
  revalidatePath('/admin/settings');
}

export async function actionUpsertPickupDayOverride(formData: FormData) {
  await requireAdmin();
  const raw = (formData.get('day_offset') as string | null)?.trim();
  const mode = formData.get('mode') as 'blocked' | 'custom';
  const offset = raw ? parseInt(raw, 10) : NaN;
  if (isNaN(offset) || offset < 0 || !['blocked', 'custom'].includes(mode)) {
    redirect('/admin/settings?error=required');
  }

  let custom_times: string[] | null = null;
  if (mode === 'custom') {
    const rawTimes = (formData.get('custom_times') as string | null) ?? '';
    custom_times = rawTimes
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (custom_times.length === 0) custom_times = null;
  }

  const note = (formData.get('note') as string | null)?.trim() || null;
  await upsertPickupDayOverride({ day_offset: offset, mode, custom_times, note });
  revalidatePath('/admin/settings');
  redirect('/admin/settings?success=override_saved#pickup-overrides');
}

export async function actionDeletePickupDayOverride(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await deletePickupDayOverride(id);
  revalidatePath('/admin/settings');
}

export async function actionUpsertPickupWeekdayRule(formData: FormData) {
  await requireAdmin();
  const raw = (formData.get('weekday') as string | null)?.trim();
  const mode = formData.get('mode') as 'blocked' | 'custom';
  const weekday = raw ? parseInt(raw, 10) : NaN;
  if (isNaN(weekday) || weekday < 0 || weekday > 6 || !['blocked', 'custom'].includes(mode)) {
    redirect('/admin/settings?error=required');
  }

  let custom_times: string[] | null = null;
  if (mode === 'custom') {
    const rawTimes = (formData.get('custom_times') as string | null) ?? '';
    custom_times = rawTimes.split(',').map((t) => t.trim()).filter(Boolean);
    if (custom_times.length === 0) custom_times = null;
  }

  const note = (formData.get('note') as string | null)?.trim() || null;
  await upsertPickupWeekdayRule({ weekday, mode, custom_times, note });
  revalidatePath('/admin/settings');
  redirect('/admin/settings?success=weekday_saved#pickup-weekdays');
}

export async function actionDeletePickupWeekdayRule(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return;
  await deletePickupWeekdayRule(id);
  revalidatePath('/admin/settings');
}
