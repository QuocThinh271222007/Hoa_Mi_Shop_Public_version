"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addItem } from "@/lib/shop/cart-store";
import {
  MOCK_PROFILE,
  MOCK_ORDERS,
  MOCK_ADDRESSES,
  STATUS_TABS,
} from "@/lib/profile/mock-profile";
import type { Profile, Order, Address } from "@/lib/profile/mock-profile";
import {
  getCustomerProfile,
  upsertCustomerProfile,
  getCustomerAddresses,
  addCustomerAddress,
  updateCustomerAddress,
  setDefaultAddress,
  deleteCustomerAddress,
  getUserOrders,
} from "@/lib/profile/profile-data";
import type {
  UserOrder,
  UserOrderItem,
  CustomerAddress,
} from "@/lib/profile/profile-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { formatDateVN, formatDateTimeVN } from "@/lib/time";
import { getCustomerOrderBucket } from "@/lib/orders/status-mapping";

const HEART_ICON = "/assets/ui/heart-outline.png";
const SEARCH_ICON = "/assets/ui/search-icon.png";
// Store contact for pick-up orders (shown in order detail).
const SHOP_CONTACT = "0386941081 (Mai Linh)";

type Tab = "account" | "orders" | "addresses";
type ModalType = "name" | "phone" | "birthday" | "gender" | null;

function fmtPrice(n: number): string {
  if (n === 0) return "000,000 đ";
  return n.toLocaleString("vi-VN") + " đ";
}

// Birthday is stored/displayed as dd/mm/yyyy; the native date input needs yyyy-mm-dd.
function birthdayToISO(display: string): string {
  const m = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function isoToBirthday(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

type EditAddress = {
  id?: string;
  full_name: string;
  phone: string;
  address_line: string;
  country: string;
};

type OrderStage = { label: string; at: string; reached: boolean; active: boolean };

type DisplayOrder = Order & {
  images?: string[];
  reorderItems?: UserOrderItem[];
  fullId?: string;
  paymentBadge?: PaymentBadge;
  showReorder?: boolean;
  canCancel?: boolean;
  cancelRequested?: boolean;
  // Detail view ("Chi tiết đơn hàng")
  bannerLabel?: string;
  stages?: OrderStage[];
  paymentMethodLabel?: string;
  deliveryMethodLabel?: string;
  pickupTime?: string;
  address?: string;
};

// Small auto-rotating carousel of an order's product images.
function OrderImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 1800);
    return () => clearInterval(t);
  }, [images.length]);
  return (
    <div className="profile-page__order-carousel">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[idx % images.length]}
        alt=""
        className="profile-page__order-carousel-img"
      />
      {images.length > 1 && (
        <div className="profile-page__order-carousel-dots">
          {images.map((_, i) => (
            <span
              key={i}
              className={`profile-page__order-carousel-dot${i === idx ? " profile-page__order-carousel-dot--active" : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type OrderTabKey = "pending" | "delivered" | "returned" | "cancelled";

const normStr = (v?: string | null) => (v ?? "").trim().toLowerCase();

// Collapse the customer buckets into the 4 history tabs shown in the mockups.
function orderTabKey(o: UserOrder): OrderTabKey {
  const b = getCustomerOrderBucket(o);
  if (b === "delivered") return "delivered";
  // Both "returned" (awaiting refund) and "refunded" (money returned) live under
  // the same Trả hàng tab — otherwise a refunded order would vanish from it.
  if (b === "returned" || b === "refunded") return "returned";
  if (b === "cancelled") return "cancelled";
  return "pending"; // pending_confirmation, waiting_pickup, shipping
}

function isRefunded(o: UserOrder): boolean {
  return normStr(o.status) === "refunded" || normStr(o.payment_status) === "refunded";
}

// Pink status label shown top-right of each order card.
function orderStatusLabel(o: UserOrder, tab: OrderTabKey): string {
  if (tab === "delivered") return "Đã giao hàng";
  if (tab === "cancelled") return "Đã hủy";
  if (tab === "returned") return isRefunded(o) ? "Đã hoàn tiền" : "Chờ hoàn tiền";
  return "Đang giao hàng";
}

type PaymentBadge = "paid" | "awaiting" | null;

// Labels shown inside the colored status pill (top-right of each order card).
const PAY_BADGE_LABEL: Record<Exclude<PaymentBadge, null>, string> = {
  paid: "Paid",
  awaiting: "Awaiting payment",
};

// Status pill: only Paid (green) or Awaiting payment (yellow). "Paid" shows whenever
// the money transaction is settled — a completed payment OR a completed refund.
// The ONLY "Awaiting payment" case in the return flow is a returned order whose
// refund has not been paid out yet.
function orderPaymentBadge(o: UserOrder, _tab: OrderTabKey): PaymentBadge {
  const bucket = getCustomerOrderBucket(o);
  if (bucket === "returned") return "awaiting"; // returned, refund not paid out yet
  if (bucket === "refunded") return "paid";     // refund completed → money settled
  const p = normStr(o.payment_status);
  if (p === "paid") return "paid";
  if (p === "awaiting_payment" || p === "awaiting_verification") return "awaiting";
  return null;
}

// Bottom timeline pill of each card.
function orderTimelinePill(o: UserOrder, tab: OrderTabKey): { timelineLabel: string; timelineAt: string } {
  if (tab === "delivered") return { timelineLabel: "Giao hàng thành công vào", timelineAt: formatDateTimeVN(o.delivered_at) };
  if (tab === "cancelled") return { timelineLabel: "Đơn hàng đã hủy vào", timelineAt: formatDateTimeVN(o.cancelled_at ?? o.created_at) };
  if (tab === "returned") {
    return isRefunded(o)
      ? { timelineLabel: "Hoàn tiền thành công vào", timelineAt: formatDateTimeVN(o.refunded_at ?? o.returned_at) }
      : { timelineLabel: "Yêu cầu trả hàng vào", timelineAt: formatDateTimeVN(o.returned_at) };
  }
  return { timelineLabel: "Đặt đơn thành công vào", timelineAt: formatDateTimeVN(o.created_at) };
}

// Fixed detail-view stages that light up as the order advances. COD and QR have
// DIFFERENT stage orders (COD is paid after delivery; QR is paid up front). The
// list runs top→bottom (first step on top); the furthest-reached step is active.
function orderStages(o: UserOrder): OrderStage[] {
  const isCod = normStr(o.payment_method) === "cod";
  const s = normStr(o.status);
  const paid = normStr(o.payment_status) === "paid" || !!o.paid_at;
  const delivered = s === "delivered" || !!o.delivered_at;
  const shipped = s === "shipped" || s === "shipping" || delivered || !!o.shipped_at;
  const bucket = getCustomerOrderBucket(o);

  // Terminal builder — marks every step reached and the last one active.
  const build = (defs: { label: string; reached: boolean; at: string | null }[]): OrderStage[] => {
    let activeIdx = 0;
    defs.forEach((d, i) => { if (d.reached) activeIdx = i; });
    return defs.map((d, i) => ({
      label: d.label,
      at: d.reached && d.at ? formatDateTimeVN(d.at) : "",
      reached: d.reached,
      active: i === activeIdx,
    }));
  };

  // ── Cancelled: order placed → (Paid, if it was) → Cancelled ──
  if (bucket === "cancelled") {
    return build([
      { label: "Successfully place order", reached: true, at: o.created_at },
      ...(paid ? [{ label: "Paid", reached: true, at: o.paid_at }] : []),
      { label: "Order cancelled", reached: true, at: o.cancelled_at ?? o.created_at },
    ]);
  }

  // ── Returned / refunded: full happy path → Returned (or Refunded) ──
  if (bucket === "returned" || bucket === "refunded") {
    const refunded = isRefunded(o);
    return build([
      { label: "Successfully place order", reached: true, at: o.created_at },
      { label: "Paid", reached: paid, at: o.paid_at },
      { label: "In transit", reached: shipped, at: o.shipped_at },
      { label: "Successfully delivered", reached: delivered, at: o.delivered_at },
      {
        label: refunded ? "Refunded" : "Returned",
        reached: true,
        at: o.refunded_at ?? o.returned_at,
      },
    ]);
  }

  const defs: { label: string; reached: boolean; at: string | null }[] = isCod
    ? [
        { label: "Successfully place order", reached: true, at: o.created_at },
        { label: "In transit", reached: shipped, at: o.shipped_at },
        { label: "Successfully delivered", reached: delivered, at: o.delivered_at },
        { label: "Paid", reached: paid, at: o.paid_at },
      ]
    : [
        { label: "Successfully place order", reached: true, at: o.created_at },
        { label: "Paid", reached: paid, at: o.paid_at },
        { label: "In transit", reached: shipped, at: o.shipped_at },
        { label: "Successfully delivered", reached: delivered, at: o.delivered_at },
      ];

  // Active = last reached step in forward order (progress fills top → down).
  return build(defs);
}

export default function ProfileClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── Auth state ──
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // ── Tab state (initialized from URL query) ──
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "orders" || tab === "addresses") return tab;
    return "account";
  });

  // ── Profile state ──
  const [profile, setProfile] = useState<Profile>(MOCK_PROFILE);

  // ── Orders / addresses state ──
  // ordersLoaded = false until we know auth state and have fetched orders
  const [orders, setOrders] = useState<DisplayOrder[]>(MOCK_ORDERS);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>(MOCK_ADDRESSES);
  // Order detail modal ("Chi tiết đơn hàng")
  const [detailOrder, setDetailOrder] = useState<DisplayOrder | null>(null);

  // ── Search + status filter ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  // ── Order status tab horizontal scroll ──
  const statusTabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateTabScrollState = useCallback(() => {
    const el = statusTabsRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
  }, []);

  const scrollTabs = useCallback((direction: "left" | "right") => {
    const el = statusTabsRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.7, 120);
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  // Recompute arrow enabled-state on mount, scroll, and resize.
  useEffect(() => {
    const el = statusTabsRef.current;
    if (!el) return;
    updateTabScrollState();
    el.addEventListener("scroll", updateTabScrollState, { passive: true });
    window.addEventListener("resize", updateTabScrollState);
    return () => {
      el.removeEventListener("scroll", updateTabScrollState);
      window.removeEventListener("resize", updateTabScrollState);
    };
    // activeTab is included so listeners (re)bind when the Orders tab mounts.
  }, [updateTabScrollState, activeTab]);

  // ── Address dots menu ──
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);

  // ── Address add/edit modal ──
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrDraft, setAddrDraft] = useState<EditAddress>({
    full_name: "",
    phone: "",
    address_line: "",
    country: "Vietnam",
  });
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState("");

  // ── Birthday date picker ──
  const birthdayRef = useRef<HTMLInputElement>(null);

  // ── Account edit modals ──
  const [modalType, setModalType] = useState<ModalType>(null);
  const [draftName, setDraftName] = useState(MOCK_PROFILE.name);
  const [draftPhone, setDraftPhone] = useState(MOCK_PROFILE.phone);
  const [phoneError, setPhoneError] = useState("");
  const [draftBirthday, setDraftBirthday] = useState(MOCK_PROFILE.birthday);
  const [draftGender, setDraftGender] = useState(MOCK_PROFILE.gender);

  // ── Load real data when authenticated ──
  const loadUserData = useCallback(async (uid: string, authEmail: string | null) => {
    const [dbProfile, dbAddresses, dbOrders] = await Promise.all([
      getCustomerProfile(uid),
      getCustomerAddresses(uid),
      getUserOrders(uid),
    ]);

    // Always reflect real contact info in the sidebar. Email falls back to the
    // authenticated account email when the profile row has none, so
    // profile-page__sidebar-contact never shows the "Email" placeholder.
    setProfile((prev) => ({
      name: dbProfile?.full_name ?? prev.name,
      email: dbProfile?.email ?? authEmail ?? prev.email,
      phone: dbProfile?.phone ?? prev.phone,
      birthday: dbProfile?.birthday ?? prev.birthday,
      gender: dbProfile?.gender ?? prev.gender,
    }));

    // Always reflect the DB (empty list = no saved addresses, not mock data).
    setAddresses(
      dbAddresses.map((a) => ({
        id: a.id,
        name: a.full_name ?? "",
        phone: a.phone ?? "",
        address: [a.address_line, a.ward, a.district, a.province]
          .filter(Boolean)
          .join(", "),
        country: a.country ?? "Vietnam",
      })),
    );
    setDefaultAddressId(dbAddresses.find((a) => a.is_default)?.id ?? null);

    // Always replace mock orders once auth is confirmed (even with empty list)
    const timeline: DisplayOrder[] = dbOrders.map((o) => {
      const tab = orderTabKey(o);
      const { timelineLabel, timelineAt } = orderTimelinePill(o, tab);
      const orderItems = o.items ?? [];
      const totalQty = orderItems.reduce((s, it) => s + it.quantity, 0) || 1;
      const first = orderItems[0];
      const productName =
        orderItems.length === 0
          ? "Đơn hàng"
          : orderItems.length === 1
            ? first.name
            : `${first.name} +${orderItems.length - 1} sản phẩm`;
      const images = orderItems
        .map((it) => it.image)
        .filter((x): x is string => !!x);
      const bucket = getCustomerOrderBucket(o);
      const canCancel =
        (bucket === "pending_confirmation" || bucket === "waiting_pickup") &&
        !o.cancel_requested_at;
      const stages = orderStages(o);
      return {
        // Unified order code = transfer note (payment_code). Falls back to the
        // UUID prefix for legacy/manual orders that have no payment_code.
        id: o.payment_code?.trim() || o.id.slice(0, 8).toUpperCase(),
        fullId: o.id,
        date: formatDateVN(o.created_at),
        status: tab as Order["status"],
        statusLabel: orderStatusLabel(o, tab),
        paymentBadge: orderPaymentBadge(o, tab),
        productName,
        quantity: totalQty,
        price: o.subtotal,
        total: o.total_amount ?? o.subtotal,
        timelineLabel,
        timelineAt,
        images,
        reorderItems: orderItems,
        showReorder: tab === "delivered" || tab === "cancelled",
        canCancel,
        cancelRequested: !!o.cancel_requested_at,
        // Detail view: banner shows only Paid or Amount due. Uses the same rule as
        // the pay badge — a return/refund flow is not a completed "Paid" state.
        bannerLabel: orderPaymentBadge(o, tab) === "paid" ? "Paid" : "Amount due",
        stages,
        paymentMethodLabel: normStr(o.payment_method) === "cod" ? "COD - Trả tiền khi nhận hàng" : "Chuyển khoản qua QR",
        deliveryMethodLabel: o.pickup_time ? "Nhận tại cửa hàng" : "Giao hàng tận nơi",
        pickupTime: o.pickup_time ?? "",
        address: o.shipping_address ?? "",
      };
    });
    setOrders(timeline);
    setOrdersLoaded(true);
  }, []);

  // ── Check auth on mount ──
  useEffect(() => {
    const db = createSupabaseBrowserClient();
    db.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        loadUserData(uid, data.user?.email ?? null).finally(() =>
          setIsAuthLoading(false),
        );
      } else {
        setIsAuthLoading(false);
        // Not logged in — mark orders as loaded to show mock placeholder clearly
        setOrdersLoaded(false);
      }
    });
  }, [loadUserData]);

  // Close modal on Escape
  useEffect(() => {
    if (!modalType && !addressModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalType(null);
        setAddressModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalType, addressModalOpen]);

  // ── Modal handlers ──
  function openModal(type: ModalType) {
    setDraftName(profile.name);
    setDraftPhone(profile.phone);
    setPhoneError("");
    setDraftBirthday(profile.birthday);
    setDraftGender(profile.gender);
    setModalType(type);
  }

  async function saveModal() {
    // Phone must be digits only and a valid VN length (9–11 digits) before saving.
    if (modalType === "phone") {
      const digits = draftPhone.replace(/\D/g, "");
      if (!/^\d{9,11}$/.test(digits)) {
        setPhoneError("Số điện thoại không hợp lệ (chỉ gồm 9–11 chữ số).");
        return;
      }
    }
    if (modalType === "name") setProfile((p) => ({ ...p, name: draftName }));
    if (modalType === "phone") setProfile((p) => ({ ...p, phone: draftPhone }));
    if (modalType === "birthday")
      setProfile((p) => ({ ...p, birthday: draftBirthday }));
    if (modalType === "gender")
      setProfile((p) => ({ ...p, gender: draftGender }));

    if (userId) {
      try {
        const update: Record<string, string> = {};
        if (modalType === "name") update.full_name = draftName;
        if (modalType === "phone") update.phone = draftPhone;
        if (modalType === "birthday") update.birthday = draftBirthday;
        if (modalType === "gender") update.gender = draftGender;
        await upsertCustomerProfile(userId, update);
      } catch {
        /* fail silently — local state already updated */
      }
    }

    setModalType(null);
  }

  // ── Sign out ── (mirrors the navbar dropdown logout, then returns home)
  async function handleSignOut() {
    try {
      const db = createSupabaseBrowserClient();
      await db.auth.signOut();
    } catch {
      /* ignore — navigate away regardless */
    }
    router.push("/");
    router.refresh();
  }

  // ── Address delete with Supabase ──
  async function handleDeleteAddress(addrId: string) {
    setAddresses((prev) => prev.filter((a) => a.id !== addrId));
    setOpenMenu(null);
    if (userId) {
      try {
        await deleteCustomerAddress(addrId);
      } catch {
        /* local already updated */
      }
    }
  }

  // ── Address add / edit ──
  const reloadAddresses = useCallback(async (uid: string) => {
    const dbAddresses = await getCustomerAddresses(uid);
    setAddresses(
      dbAddresses.map((a: CustomerAddress) => ({
        id: a.id,
        name: a.full_name ?? "",
        phone: a.phone ?? "",
        address: [a.address_line, a.ward, a.district, a.province]
          .filter(Boolean)
          .join(", "),
        country: a.country ?? "Vietnam",
      })),
    );
    setDefaultAddressId(dbAddresses.find((a) => a.is_default)?.id ?? null);
  }, []);

  async function handleSetDefault(addrId: string) {
    setOpenMenu(null);
    if (!userId) return;
    setDefaultAddressId(addrId); // optimistic
    try {
      await setDefaultAddress(userId, addrId);
      await reloadAddresses(userId);
    } catch {
      /* keep optimistic value */
    }
  }

  // ── Reorder: add an order's items back to the cart, then go to checkout ──
  function handleReorder(items?: UserOrderItem[]) {
    if (!items || items.length === 0) return;
    let added = 0;
    for (const it of items) {
      if (!it.productId) continue;
      addItem(
        {
          id: it.productId,
          slug: it.slug ?? it.productId,
          name: it.name,
          price: it.unitPrice,
          image: it.image ?? "/assets/products/product-01.png",
          description: "",
          category: "",
        },
        it.quantity,
      );
      added++;
    }
    if (added > 0) router.push("/checkout");
  }


  function openAddAddress() {
    setEditingAddressId(null);
    setAddrDraft({
      full_name: "",
      phone: "",
      address_line: "",
      country: "Vietnam",
    });
    setAddrError("");
    setAddressModalOpen(true);
  }

  function openEditAddress(addr: Address) {
    setEditingAddressId(addr.id);
    setAddrDraft({
      full_name: addr.name,
      phone: addr.phone,
      address_line: addr.address,
      country: addr.country,
    });
    setAddrError("");
    setOpenMenu(null);
    setAddressModalOpen(true);
  }

  async function saveAddress() {
    if (!userId) return;
    if (
      !addrDraft.full_name.trim() ||
      !addrDraft.phone.trim() ||
      !addrDraft.address_line.trim()
    ) {
      setAddrError("Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ.");
      return;
    }
    if (!/^\d{9,11}$/.test(addrDraft.phone.replace(/\D/g, ""))) {
      setAddrError("Số điện thoại không hợp lệ (chỉ gồm 9–11 chữ số).");
      return;
    }
    setAddrSaving(true);
    setAddrError("");
    try {
      const base = {
        full_name: addrDraft.full_name.trim(),
        phone: addrDraft.phone.trim(),
        address_line: addrDraft.address_line.trim(),
        country: addrDraft.country.trim() || "Vietnam",
      };
      if (editingAddressId) {
        // Flatten to address_line; clear structured parts to avoid stale display.
        await updateCustomerAddress(editingAddressId, {
          ...base,
          province: null,
          district: null,
          ward: null,
        });
      } else {
        await addCustomerAddress(userId, base);
      }
      await reloadAddresses(userId);
      setAddressModalOpen(false);
    } catch {
      setAddrError("Không thể lưu địa chỉ. Vui lòng thử lại.");
    } finally {
      setAddrSaving(false);
    }
  }

  // ── Which orders to display ──
  // Authenticated users only — real orders (empty list = no orders yet).
  // Logged-out visitors never reach this render (gated below), so mock order
  // data is never shown as if it were real.
  const displayOrders: DisplayOrder[] = userId && ordersLoaded ? orders : [];

  // ── Computed: filtered orders ──
  const filteredOrders = displayOrders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      o.id.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Computed: status counts ──
  const statusCounts: Record<string, number> = {};
  for (const { key } of STATUS_TABS) {
    if (key !== "all") {
      statusCounts[key] = displayOrders.filter(
        (o) =>
          o.status === key || (key === "cancelled" && o.status === "canceled"),
      ).length;
    }
  }

  const SIDEBAR_TABS: { key: Tab; label: string }[] = [
    { key: "account", label: "Thông tin tài khoản" },
    { key: "orders", label: "Lịch sử đơn hàng" },
    { key: "addresses", label: "Địa chỉ đã lưu" },
  ];

  // ── Auth gate ──
  // Never show mock profile/orders/addresses to logged-out visitors. While auth
  // is resolving, show a minimal loading state to avoid flashing placeholder data.
  if (isAuthLoading) {
    return (
      <main className="profile-page">
        <div className="profile-page__inner">
          <p className="profile-page__auth-loading">Đang tải…</p>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="profile-page">
        <div className="profile-page__inner">
          <div className="profile-page__auth-required">
            <p className="profile-page__auth-required-text">
              Bạn cần đăng nhập hoặc tạo tài khoản để xem thông tin cá nhân,
              lịch sử đơn hàng và địa chỉ đã lưu.
            </p>
            <button
              type="button"
              className="profile-page__auth-required-cta"
              onClick={() => router.push("/login")}
            >
              Đăng nhập / Đăng ký
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <div className="profile-page__inner">
        <div className="profile-page__layout">
          {/* ══════════ SIDEBAR ══════════ */}
          <aside className="profile-page__sidebar">
            <img
              className="profile-page__sidebar-heart"
              src={HEART_ICON}
              alt=""
              aria-hidden="true"
              width={56}
              height={56}
            />
            <p className="profile-page__sidebar-name">{profile.name}</p>
            <p className="profile-page__sidebar-contact">
              {profile.email} | {profile.phone}
            </p>
            {SIDEBAR_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`profile-page__sidebar-tab${activeTab === key ? " profile-page__sidebar-tab--active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </aside>

          {/* ══════════ CONTENT ══════════ */}
          <div className="profile-page__content">
            {/* ── Thông tin tài khoản ── */}
            {activeTab === "account" && (
              <section className="profile-page__account">
                <h2 className="profile-page__section-title">
                  Thông tin cá nhân
                </h2>

                <div className="profile-page__account-card">
                  <button
                    type="button"
                    className="profile-page__account-row"
                    onClick={() => openModal("name")}
                  >
                    <span className="profile-page__account-row-label">
                      Họ và tên
                    </span>
                    <span className="profile-page__account-row-value">
                      {profile.name}
                      <span className="profile-page__account-row-arrow">▶</span>
                    </span>
                  </button>

                  <hr className="profile-page__account-divider" />

                  <button
                    type="button"
                    className="profile-page__account-row"
                    onClick={() => openModal("birthday")}
                  >
                    <span className="profile-page__account-row-label">
                      Ngày sinh
                    </span>
                    <span className="profile-page__account-row-value">
                      {profile.birthday}
                      <span className="profile-page__account-row-arrow">▶</span>
                    </span>
                  </button>

                  <hr className="profile-page__account-divider" />

                  <button
                    type="button"
                    className="profile-page__account-row"
                    onClick={() => openModal("phone")}
                  >
                    <span className="profile-page__account-row-label">
                      Số điện thoại
                    </span>
                    <span className="profile-page__account-row-value">
                      {profile.phone}
                      <span className="profile-page__account-row-arrow">▶</span>
                    </span>
                  </button>

                  <hr className="profile-page__account-divider" />

                  <button
                    type="button"
                    className="profile-page__account-row"
                    onClick={() => openModal("gender")}
                  >
                    <span className="profile-page__account-row-label">
                      Giới tính
                    </span>
                    <span className="profile-page__account-row-value">
                      {profile.gender}
                      <span className="profile-page__account-row-arrow">▶</span>
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  className="profile-page__signout"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </section>
            )}

            {/* ── Lịch sử đơn hàng ── */}
            {activeTab === "orders" && (
              <section className="profile-page__orders">
                <h2 className="profile-page__section-title">
                  Lịch sử đơn hàng
                </h2>

                {/* Search */}
                <div className="profile-page__search">
                  <img
                    className="profile-page__search-icon"
                    src={SEARCH_ICON}
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                  />
                  <input
                    className="profile-page__search-input"
                    type="text"
                    placeholder="Tìm theo mã đơn hàng hoặc tên sản phẩm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Tìm đơn hàng"
                  />
                </div>

                {/* Status tabs */}
                <div className="profile-page__status-tabs-wrap">
                  <button
                    type="button"
                    className="profile-page__status-arrow"
                    aria-label="Cuộn sang trái"
                    onClick={() => scrollTabs("left")}
                    disabled={!canScrollLeft}
                    hidden={!canScrollLeft && !canScrollRight}
                  >
                    ◀
                  </button>
                  <div
                    className="profile-page__status-tabs"
                    role="tablist"
                    ref={statusTabsRef}
                  >
                    {STATUS_TABS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === key}
                        className={`profile-page__status-tab${statusFilter === key ? " profile-page__status-tab--active" : ""}`}
                        onClick={(e) => {
                          setStatusFilter(key);
                          e.currentTarget.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "nearest",
                          });
                        }}
                      >
                        {label}
                        {key !== "all" && (statusCounts[key] ?? 0) > 0 && (
                          <span className="profile-page__status-badge">
                            {statusCounts[key]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="profile-page__status-arrow"
                    aria-label="Cuộn sang phải"
                    onClick={() => scrollTabs("right")}
                    disabled={!canScrollRight}
                    hidden={!canScrollLeft && !canScrollRight}
                  >
                    ▶
                  </button>
                </div>

                {/* Order list */}
                {userId && !ordersLoaded ? (
                  <div className="profile-page__orders-empty">
                    <p>Đang tải đơn hàng…</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="profile-page__orders-empty">
                    <p>
                      {userId
                        ? "Không tìm thấy đơn hàng nào."
                        : "Vui lòng đăng nhập để xem lịch sử đơn hàng."}
                    </p>
                  </div>
                ) : (
                  <div className="profile-page__order-list">
                    {filteredOrders.map((order, i) => (
                      <div
                        key={`${order.id}-${i}`}
                        className="profile-page__order-card"
                      >
                        {/* Top: id/date + status + payment badge */}
                        <div className="profile-page__order-top">
                          <div className="profile-page__order-id-col">
                            <span className="profile-page__order-id">#{order.id}</span>
                            <span className="profile-page__order-date">{order.date}</span>
                          </div>
                          <div className="profile-page__order-status-col">
                            <span className="profile-page__order-status">{order.statusLabel}</span>
                            {order.paymentBadge && (
                              <span
                                className={`profile-page__pay-badge profile-page__pay-badge--${order.paymentBadge}`}
                              >
                                {PAY_BADGE_LABEL[order.paymentBadge]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Body: image + info */}
                        <div className="profile-page__order-body">
                          <div className="profile-page__order-image">
                            {order.images && order.images.length > 0 ? (
                              <OrderImageCarousel images={order.images} />
                            ) : (
                              <span className="profile-page__order-image-label">Ảnh</span>
                            )}
                          </div>
                          <div className="profile-page__order-info">
                            <p className="profile-page__order-name">{order.productName}</p>
                            <div className="profile-page__order-price-row">
                              <span className="profile-page__order-qty">x{order.quantity}</span>
                              <span className="profile-page__order-price">{fmtPrice(order.price)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Total */}
                        <div className="profile-page__order-total">
                          <span className="profile-page__order-total-label">
                            Tổng tiền (x{order.quantity} sản phẩm)
                          </span>
                          <span className="profile-page__order-total-value">{fmtPrice(order.total)}</span>
                        </div>

                        {/* Timeline pill → opens the order detail view */}
                        <button
                          type="button"
                          className="profile-page__order-timeline"
                          onClick={() => setDetailOrder(order)}
                        >
                          <span className="profile-page__order-timeline-text">
                            {order.timelineLabel}
                            {order.timelineAt ? ` ${order.timelineAt}` : ""}
                          </span>
                          <span className="profile-page__order-timeline-arrow" aria-hidden="true">▶</span>
                        </button>

                        {order.showReorder && (
                          <div className="profile-page__order-actions">
                            <button
                              type="button"
                              className="profile-page__reorder"
                              onClick={() => handleReorder(order.reorderItems)}
                              disabled={!order.reorderItems || order.reorderItems.length === 0}
                            >
                              Mua lại
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Địa chỉ đã lưu ── */}
            {activeTab === "addresses" && (
              <section className="profile-page__addresses">
                <h2 className="profile-page__section-title">Địa chỉ đã lưu</h2>

                {/* Invisible overlay closes open menu on outside click */}
                {openMenu && (
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 99 }}
                    onClick={() => setOpenMenu(null)}
                    aria-hidden="true"
                  />
                )}

                <div className="profile-page__address-list">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="profile-page__address-card">
                      <div className="profile-page__address-main">
                        <p className="profile-page__address-name">
                          {addr.name}
                          {addr.id === defaultAddressId && (
                            <span className="profile-page__address-default-badge">
                              Mặc định
                            </span>
                          )}
                        </p>
                        <p className="profile-page__address-detail">
                          {addr.phone}
                        </p>
                        <p className="profile-page__address-detail">
                          {addr.address}
                        </p>
                        <p className="profile-page__address-detail">
                          {addr.country}
                        </p>
                      </div>

                      <div className="profile-page__address-menu-wrap">
                        <button
                          type="button"
                          className="profile-page__address-dots"
                          onClick={() =>
                            setOpenMenu(openMenu === addr.id ? null : addr.id)
                          }
                          aria-label="Tùy chọn địa chỉ"
                        >
                          ⋮
                        </button>

                        {openMenu === addr.id && (
                          <div
                            className="profile-page__address-menu"
                            role="menu"
                          >
                            {addr.id !== defaultAddressId && (
                              <button
                                type="button"
                                className="profile-page__address-menu-item"
                                role="menuitem"
                                onClick={() => handleSetDefault(addr.id)}
                              >
                                Đặt làm mặc định
                              </button>
                            )}
                            <button
                              type="button"
                              className="profile-page__address-menu-item"
                              role="menuitem"
                              onClick={() => openEditAddress(addr)}
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              className="profile-page__address-menu-item profile-page__address-menu-item--delete"
                              role="menuitem"
                              onClick={() => handleDeleteAddress(addr.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="profile-page__add-address"
                  onClick={openAddAddress}
                >
                  + Thêm địa chỉ
                </button>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}
      {modalType && (
        <div
          className="profile-page__modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalType(null);
          }}
        >
          <div className="profile-page__modal">
            <button
              type="button"
              className="profile-page__modal-close"
              onClick={() => setModalType(null)}
              aria-label="Đóng"
            >
              X
            </button>

            <h2 id="profile-modal-title" className="profile-page__modal-title">
              {modalType === "name"
                ? "Họ và tên"
                : modalType === "phone"
                  ? "Số điện thoại"
                  : modalType === "birthday"
                    ? "Ngày sinh"
                    : "Giới tính"}
            </h2>

            {/* Name modal */}
            {modalType === "name" && (
              <input
                className="profile-page__modal-input"
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoFocus
                aria-label="Họ và tên"
              />
            )}

            {/* Phone modal — digits only, VN length (9–11 digits) */}
            {modalType === "phone" && (
              <>
                <input
                  className="profile-page__modal-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={draftPhone}
                  onChange={(e) => {
                    // Strip anything that isn't a digit and cap the length so the
                    // field can never hold letters or an unbounded string.
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setDraftPhone(digits);
                    if (phoneError) setPhoneError("");
                  }}
                  autoFocus
                  aria-label="Số điện thoại"
                  placeholder="Số điện thoại (chỉ nhập số)"
                />
                {phoneError && (
                  <p
                    style={{
                      color: "#c0392b",
                      fontSize: 13,
                      marginTop: 6,
                    }}
                  >
                    {phoneError}
                  </p>
                )}
              </>
            )}

            {/* Birthday modal — native date picker; icon opens the calendar */}
            {modalType === "birthday" && (
              <div className="profile-page__modal-date-wrap">
                <input
                  ref={birthdayRef}
                  className="profile-page__modal-input profile-page__modal-input--date"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={birthdayToISO(draftBirthday)}
                  onChange={(e) =>
                    setDraftBirthday(isoToBirthday(e.target.value))
                  }
                  autoFocus
                  aria-label="Ngày sinh"
                />
                <button
                  type="button"
                  className="profile-page__modal-calendar-btn"
                  onClick={() => birthdayRef.current?.showPicker?.()}
                  aria-label="Mở lịch"
                >
                  <svg
                    className="profile-page__modal-calendar-icon"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
            )}

            {/* Gender modal */}
            {modalType === "gender" && (
              <div
                className="profile-page__modal-radios"
                role="radiogroup"
                aria-label="Giới tính"
              >
                {(["Nam", "Nữ"] as const).map((g) => (
                  <label key={g} className="profile-page__modal-radio-label">
                    <span
                      className={`profile-page__modal-radio${draftGender === g ? " profile-page__modal-radio--checked" : ""}`}
                      role="radio"
                      aria-checked={draftGender === g}
                      tabIndex={0}
                      onClick={() => setDraftGender(g)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter")
                          setDraftGender(g);
                      }}
                    />
                    <span className="profile-page__modal-radio-text">{g}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="profile-page__modal-buttons">
              <button
                type="button"
                className="profile-page__modal-cancel"
                onClick={() => setModalType(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="profile-page__modal-save"
                onClick={saveModal}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ ADDRESS ADD / EDIT MODAL ══════════ */}
      {addressModalOpen && (
        <div
          className="profile-page__modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddressModalOpen(false);
          }}
        >
          <div className="profile-page__modal">
            <button
              type="button"
              className="profile-page__modal-close"
              onClick={() => setAddressModalOpen(false)}
              aria-label="Đóng"
            >
              X
            </button>

            <h2 id="address-modal-title" className="profile-page__modal-title">
              {editingAddressId ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ"}
            </h2>

            <input
              className="profile-page__modal-input"
              type="text"
              placeholder="Họ và tên người nhận"
              value={addrDraft.full_name}
              onChange={(e) =>
                setAddrDraft((d) => ({ ...d, full_name: e.target.value }))
              }
              aria-label="Họ và tên"
            />
            <input
              className="profile-page__modal-input"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="Số điện thoại (chỉ nhập số)"
              value={addrDraft.phone}
              onChange={(e) =>
                setAddrDraft((d) => ({
                  ...d,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              aria-label="Số điện thoại"
            />
            <input
              className="profile-page__modal-input"
              type="text"
              placeholder="Địa chỉ (số nhà, đường, phường, quận, tỉnh/thành)"
              value={addrDraft.address_line}
              onChange={(e) =>
                setAddrDraft((d) => ({ ...d, address_line: e.target.value }))
              }
              aria-label="Địa chỉ"
            />

            {addrError && (
              <p
                className="profile-page__modal-error"
                role="alert"
                style={{ color: "#dc2626", fontSize: 13, margin: "4px 0 0" }}
              >
                {addrError}
              </p>
            )}

            <div className="profile-page__modal-buttons">
              <button
                type="button"
                className="profile-page__modal-cancel"
                onClick={() => setAddressModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="profile-page__modal-save"
                onClick={saveAddress}
                disabled={addrSaving}
              >
                {addrSaving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order detail ("Chi tiết đơn hàng") ── */}
      {detailOrder && (
        <div
          className="order-detail__backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailOrder(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết đơn hàng"
        >
          <div className="order-detail">
            <button
              type="button"
              className="order-detail__close"
              onClick={() => setDetailOrder(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
            <div className="order-detail__grid">
              {/* Left: status banner + timeline + payment */}
              <div className="order-detail__left">
                <div className="order-detail__banner">
                  <span className="order-detail__banner-check" aria-hidden="true">✓</span>
                  <div>
                    <p className="order-detail__banner-title">{detailOrder.bannerLabel}</p>
                    <p className="order-detail__banner-sub">Order#{detailOrder.id}</p>
                  </div>
                </div>

                <div className="order-detail__timeline">
                  {(detailOrder.stages ?? []).map((s, idx) => (
                    <div
                      key={idx}
                      className={`order-detail__stage${s.reached ? " order-detail__stage--reached" : ""}`}
                    >
                      <span
                        className={`order-detail__stage-dot${s.reached ? " order-detail__stage-dot--reached" : ""}`}
                        aria-hidden="true"
                      />
                      <div className="order-detail__stage-body">
                        <p
                          className={`order-detail__stage-label${s.active ? " order-detail__stage-label--active" : ""}${!s.reached ? " order-detail__stage-label--future" : ""}`}
                        >
                          {s.label}
                        </p>
                        {s.at && <p className="order-detail__stage-at">{s.at}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="order-detail__payment">
                  <div className="order-detail__pay-row">
                    <span>{detailOrder.bannerLabel}</span>
                    <strong>{fmtPrice(detailOrder.total)}</strong>
                  </div>
                  <div className="order-detail__pay-row"><span>Payment method</span><strong>{detailOrder.paymentMethodLabel}</strong></div>
                  <div className="order-detail__pay-row"><span>Delivery method</span><strong>{detailOrder.deliveryMethodLabel}</strong></div>
                  {detailOrder.deliveryMethodLabel === "Nhận tại cửa hàng" && (
                    <>
                      {detailOrder.pickupTime && (
                        <div className="order-detail__pay-row">
                          <span>Thời gian nhận</span>
                          <strong>{detailOrder.pickupTime}</strong>
                        </div>
                      )}
                      <div className="order-detail__pay-row order-detail__pay-row--addr">
                        <span>SĐT liên hệ (nhận tại cửa hàng)</span>
                        <strong>{SHOP_CONTACT}</strong>
                      </div>
                    </>
                  )}
                  <div className="order-detail__pay-row order-detail__pay-row--addr">
                    <span>Delivery Address</span>
                    <strong>{detailOrder.address || "—"}</strong>
                  </div>
                </div>
              </div>

              {/* Right: Your Order */}
              <div className="order-detail__right">
                <h3 className="order-detail__right-title">Your Order</h3>
                <div className="order-detail__items">
                  {(detailOrder.reorderItems ?? []).map((it, idx) => (
                    <div key={idx} className="order-detail__item">
                      <div className="order-detail__item-img">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image} alt={it.name} />
                        ) : (
                          <span>Ảnh</span>
                        )}
                      </div>
                      <div className="order-detail__item-info">
                        <p className="order-detail__item-name">{it.name}</p>
                        <p className="order-detail__item-price">{fmtPrice(it.unitPrice)}</p>
                        <p className="order-detail__item-qty">x{it.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
