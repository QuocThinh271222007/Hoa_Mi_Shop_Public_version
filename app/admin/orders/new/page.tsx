import { requireAdmin } from "@/lib/admin/auth-check";
import { getAllProducts } from "@/lib/admin/products-data";
import { getLocationOptions, getSettingsMap, getPickupDayOverrideMap, getPickupWeekdayRuleMap } from "@/lib/admin/settings-data";
import { AdminShell } from "../../_components/AdminShell";
import {
  CreateOrderForm,
  type ProductOption,
} from "@/components/admin/CreateOrderForm";
import { actionCreateOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; names?: string }>;
}) {
  const { email } = await requireAdmin();
  const sp = await searchParams;
  const errorMessage =
    sp.error === 'stock'
      ? `Không đủ tồn kho cho: ${sp.names || 'một số sản phẩm'}. Đơn chưa được tạo — vui lòng kiểm tra lại số lượng.`
      : sp.error
        ? 'Không thể tạo đơn — vui lòng kiểm tra lại thông tin.'
        : '';
  type SlotOv = { mode: 'blocked' | 'custom'; custom_times?: string[] | null };
  const [products, storeRows, timeRows, offsetMap, dayOverrides, weekdayRules] = await Promise.all([
    getAllProducts().catch(() => []),
    getLocationOptions("store").catch(() => []),
    getLocationOptions("pickup_time").catch(() => []),
    getSettingsMap(["pickup_offset_min_days", "pickup_offset_max_days"]).catch(() => ({} as Record<string, string>)),
    getPickupDayOverrideMap().catch(() => ({} as Record<number, SlotOv>)),
    getPickupWeekdayRuleMap().catch(() => ({} as Record<number, SlotOv>)),
  ]);
  const options: ProductOption[] = products
    .filter((p) => p.is_active !== false)
    .map((p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock }));
  const stores = storeRows
    .filter((s) => s.is_active !== false)
    .map((s) => ({ id: s.id, name: s.name }));

  // Build pickupTimesByStore map: { storeId: ["8h30", "10h00", ...] }
  const pickupTimesByStore: Record<string, string[]> = {};
  for (const t of timeRows) {
    if (!t.parent_id || !t.is_active) continue;
    (pickupTimesByStore[t.parent_id] ??= []).push(t.name);
  }

  const minDays = parseInt(offsetMap["pickup_offset_min_days"] || "2", 10);
  const maxDays = parseInt(offsetMap["pickup_offset_max_days"] || "3", 10);
  const pickupOffset = {
    min: Number.isFinite(minDays) ? Math.max(0, minDays) : 2,
    max: Number.isFinite(maxDays) ? Math.max(0, maxDays) : 3,
  };

  return (
    <AdminShell email={email} activePath="/admin/orders">
      <header className="admin-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/admin/orders"
            className="admin-link"
            style={{ fontSize: 13 }}
          >
            ← Quay lại
          </a>
          <h1 className="admin-header__title" style={{ margin: 0 }}>
            Tạo đơn hàng
          </h1>
        </div>
        <p className="admin-header__subtitle">
          Đơn tạo tay (bán tại quầy / qua điện thoại) — vào thẳng danh sách xử
          lý.
        </p>
      </header>

      <section className="admin-section">
        {errorMessage && (
          <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {errorMessage}
          </p>
        )}
        <CreateOrderForm
          products={options}
          stores={stores}
          pickupTimesByStore={pickupTimesByStore}
          pickupOffset={pickupOffset}
          dayOverrides={dayOverrides}
          weekdayRules={weekdayRules}
          action={actionCreateOrder}
        />
      </section>
    </AdminShell>
  );
}
