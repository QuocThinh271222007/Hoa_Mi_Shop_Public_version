"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { getCustomerAddresses } from "@/lib/profile/profile-data";
import {
  readCart,
  removeItem,
  updateQuantity,
  calcTotal,
  clearCart,
  CART_EVENT,
} from "@/lib/shop/cart-store";
import { formatPrice } from "@/lib/demo-products";
import {
  DEFAULT_SHIPPING_CONFIG,
  type ShippingConfig,
} from "@/lib/payments/shipping";
import {
  gaBeginCheckout,
  gaAddShippingInfo,
  gaAddPaymentInfo,
  gaOrderCreated,
  gaRemoveFromCart,
  toGaItem,
} from "@/lib/analytics/ga";
import type { CartItem } from "@/lib/types";

type AppliedCode = {
  code: string;
  discountAmount: number;
  shippingDiscountAmount: number;
  message: string;
};

type PickupStore = { id: string; name: string };
type LocationOpt = {
  id: string;
  name: string;
  shipping_fee: number;
  required_levels?: number;
  payment_methods?: string;
};

// ── Inline SVG Icons ──

function QrIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="8"
        height="8"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="13"
        y="1"
        width="8"
        height="8"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="1"
        y="13"
        width="8"
        height="8"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="3" y="3" width="4" height="4" rx="0.5" />
      <rect x="15" y="3" width="4" height="4" rx="0.5" />
      <rect x="3" y="15" width="4" height="4" rx="0.5" />
      <rect x="13" y="13" width="2" height="2" />
      <rect x="17" y="13" width="2" height="2" />
      <rect x="13" y="17" width="2" height="2" />
      <rect x="17" y="17" width="2" height="2" />
    </svg>
  );
}

function CouponIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* Coupon ticket body with side notches */}
      <path
        d="M2.5 8A1.5 1.5 0 0 1 4 6.5h16A1.5 1.5 0 0 1 21.5 8v2.2a1.8 1.8 0 0 0 0 3.6V16a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16v-2.2a1.8 1.8 0 0 0 0-3.6V8z"
        fill="currentColor"
      />
      {/* Perforation line */}
      <path
        d="M8 8.2v7.6"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeDasharray="1.4 2"
        opacity="0.9"
      />
      {/* Heart */}
      <path
        d="M14.6 15c-1.6-1.1-2.6-1.9-2.6-2.9 0-.8.6-1.3 1.3-1.3.5 0 .9.25 1.3.7.4-.45.8-.7 1.3-.7.7 0 1.3.5 1.3 1.3 0 1-1 1.8-2.6 2.9z"
        fill="#fff"
      />
    </svg>
  );
}

function CodIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9v6M18 9v6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function BigCouponIcon() {
  return (
    <svg
      className="checkout-page__modal-icon"
      width="104"
      height="72"
      viewBox="0 0 104 72"
      fill="none"
      aria-hidden="true"
    >
      {/* Coupon ticket body with side notches */}
      <path
        d="M14 16h76a6 6 0 0 1 6 6v6a8 8 0 0 0 0 16v6a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6v-6a8 8 0 0 0 0-16v-6a6 6 0 0 1 6-6z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Perforation line */}
      <line
        x1="42"
        y1="20"
        x2="42"
        y2="52"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      {/* Heart */}
      <path
        d="M68 44c-6-4-9.5-6.8-9.5-10.5C58.5 30.8 60.9 29 63.2 29c1.9 0 3.4 1 4.8 2.6 1.4-1.6 2.9-2.6 4.8-2.6 2.3 0 4.7 1.8 4.7 4.5C77.5 37.2 74 40 68 44z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Sparkles */}
      <path
        d="M24 29l1.3 3.4 3.4 1.3-3.4 1.3L24 38.4l-1.3-3.4-3.4-1.3 3.4-1.3z"
        fill="currentColor"
        opacity="0.7"
      />
      <circle cx="31" cy="46" r="1.8" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

type SlotOverride = {
  mode: "blocked" | "custom";
  custom_times?: string[] | null;
};

// ── Pickup-time helpers ──
// Configured slot times are stored VN-style ("8h30", "11h00", "18h00").
// The detailed picker uses native "HH:MM" values; we convert between the two and
// derive the [earliest, latest] window from a day's configured times.
// Extracts every clock time found in a configured slot label, in minutes.
// Tolerant of a single time ("8h30", "11h00") OR a range in one label
// ("11h00 - 18h00"), and of both "h" and ":" separators.
function extractVnMinutes(s: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,2})\s*[h:]\s*(\d{2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s ?? "")) !== null) {
    const hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    if (hh <= 23 && mm <= 59) out.push(hh * 60 + mm);
  }
  return out;
}
const isDateLabel = (s: string) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim());
function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}
function minutesToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
// Minutes → VN label used everywhere else in the app ("14h52").
function minutesToVn(m: number): string {
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

export default function CheckoutClient({
  shippingConfig,
  pickupStores = [],
  pickupTimesByStore = {},
  pickupOffset = { min: 2, max: 3 },
  dayOverrides = {},
  weekdayRules = {},
}: {
  shippingConfig?: ShippingConfig;
  pickupStores?: PickupStore[];
  pickupTimesByStore?: Record<string, string[]>;
  pickupOffset?: { min: number; max: number };
  dayOverrides?: Record<number, SlotOverride>;
  weekdayRules?: Record<number, SlotOverride>;
}) {
  const router = useRouter();
  const shipCfg = shippingConfig ?? DEFAULT_SHIPPING_CONFIG;

  // ── Auth ──
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // ── Cart ──
  const [items, setItems] = useState<CartItem[]>([]);

  // ── Form ──
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  // ── Location cascade (province → district → ward); data + per-level fees from admin ──
  const [province, setProvince] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [provinceFee, setProvinceFee] = useState(0);
  const [district, setDistrict] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [districtFee, setDistrictFee] = useState(0);
  const [ward, setWard] = useState("");
  const [wardId, setWardId] = useState("");
  const [wardFee, setWardFee] = useState(0);
  // How many cascade levels the selected province forces (1=TP, 2=+Quận, 3=+Phường).
  const [requiredLevels, setRequiredLevels] = useState(2);
  // Allowed payment methods for the selected province ('both' | 'qr' | 'cod').
  const [provincePayment, setProvincePayment] = useState("both");
  // Per-district override ('both' = inherit province; 'qr'/'cod' narrows it).
  const [districtPayment, setDistrictPayment] = useState("both");
  const [provinceOpts, setProvinceOpts] = useState<LocationOpt[]>([]);
  const [districtOpts, setDistrictOpts] = useState<LocationOpt[]>([]);
  const [wardOpts, setWardOpts] = useState<LocationOpt[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cod">(
    "bank_transfer",
  );

  // ── Pickup ──
  const [selectedStore, setSelectedStore] = useState<PickupStore | null>(null);
  const [tempStore, setTempStore] = useState<PickupStore | null>(null);
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  // Exact pickup clock time ("HH:MM") the customer refines within the day's window.
  const [detailTime, setDetailTime] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const timeRef = useRef<HTMLDivElement>(null);

  // ── Province dropdown ──
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownTab, setDropdownTab] = useState<
    "province" | "district" | "ward"
  >("province");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Discount ──
  const [couponInput, setCouponInput] = useState("");
  const [appliedCodes, setAppliedCodes] = useState<AppliedCode[]>([]);
  // Synchronously-updated set of normalized codes that are applied OR currently
  // being validated. Guards against the async race where two rapid apply calls
  // (double-click, or suggestion + Apply) both read a stale `appliedCodes` and
  // each append the same code, applying one discount twice.
  const reservedCodesRef = useRef<Set<string>>(new Set());
  const [discountError, setDiscountError] = useState("");
  const [discountSuccess, setDiscountSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { code: string; label: string }[]
  >([]);

  // ── Order ──
  const [orderStatus, setOrderStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [orderMessage, setOrderMessage] = useState("");

  // ── GA4 checkout-journey fire-once guards ──
  const gaBeginRef = useRef(false);
  const gaShipRef = useRef(false);
  const gaPayRef = useRef(false);
  const gaItems = useCallback(
    () => items.map((i) => toGaItem(i, i.quantity)),
    [items],
  );

  // ── Computed ──
  const subtotal = calcTotal(items);
  // Delivery fee = sum of the selected province + district + ward fees.
  const locationFee = provinceFee + districtFee + wardFee;
  const shippingFee =
    deliveryMode === "pickup"
      ? 0
      : shipCfg.freeThreshold > 0 && subtotal >= shipCfg.freeThreshold
        ? 0
        : locationFee;
  // Required levels are per-province (admin-configured). Levels above the minimum
  // stay optional (still add their fee when chosen).
  const addressComplete =
    !!provinceId &&
    (requiredLevels < 2 || !!districtId) &&
    (requiredLevels < 3 || !!wardId);

  // Allowed payment methods: per-province, optionally narrowed per-district.
  // Pickup allows both; before a province is picked, keep both visible.
  // A district set to 'qr'/'cod' overrides its province; 'both' inherits.
  const districtPaymentOverride =
    districtId && districtPayment !== "both" ? districtPayment : null;
  const allowedPay =
    deliveryMode === "pickup"
      ? "both"
      : (districtPaymentOverride ?? (provinceId ? provincePayment : "both"));
  const canQr = allowedPay === "both" || allowedPay === "qr";
  const canCod = allowedPay === "both" || allowedPay === "cod";
  const totalDiscountAmount = appliedCodes.reduce(
    (s, c) => s + c.discountAmount,
    0,
  );
  const totalShippingDiscount = appliedCodes.reduce(
    (s, c) => s + c.shippingDiscountAmount,
    0,
  );
  const shippingPayable = Math.max(0, shippingFee - totalShippingDiscount);
  const total = Math.max(0, subtotal - totalDiscountAmount + shippingPayable);

  // Load provinces once; districts when a province is picked; wards when a
  // district is picked. Fees come with each option (admin-configured).
  useEffect(() => {
    fetch("/api/locations?type=province")
      .then((r) => r.json())
      .then((d) => setProvinceOpts((d.data ?? []) as LocationOpt[]))
      .catch(() => setProvinceOpts([]));
  }, []);

  useEffect(() => {
    if (!provinceId) {
      setDistrictOpts([]);
      return;
    }
    fetch(`/api/locations?type=district&parent_id=${provinceId}`)
      .then((r) => r.json())
      .then((d) => setDistrictOpts((d.data ?? []) as LocationOpt[]))
      .catch(() => setDistrictOpts([]));
  }, [provinceId]);

  useEffect(() => {
    if (!districtId) {
      setWardOpts([]);
      return;
    }
    fetch(`/api/locations?type=ward&parent_id=${districtId}`)
      .then((r) => r.json())
      .then((d) => setWardOpts((d.data ?? []) as LocationOpt[]))
      .catch(() => setWardOpts([]));
  }, [districtId]);

  // Keep the chosen payment method valid when the allowed set changes (province/mode).
  useEffect(() => {
    if (paymentMethod === "cod" && !canCod) setPaymentMethod("bank_transfer");
    else if (paymentMethod === "bank_transfer" && !canQr)
      setPaymentMethod("cod");
  }, [canQr, canCod, paymentMethod]);

  // Pick-up time slots: store times × date window.
  // Priority: day-offset override > weekday rule > store default.
  // Blocked at either level → skip that day entirely.
  const timeSlots = useMemo(() => {
    if (!selectedStore) return [];
    const storeTimes = pickupTimesByStore[selectedStore.id] ?? [];
    const slots: string[] = [];
    const today = new Date();
    for (let d = pickupOffset.min; d <= pickupOffset.max; d++) {
      // Day-offset override takes priority.
      const dayOv = dayOverrides[d];
      if (dayOv?.mode === "blocked") continue;

      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const weekday = date.getDay(); // 0=Sun..6=Sat

      // Weekday rule applies only when no day-offset override exists.
      const wdRule = dayOv ? undefined : weekdayRules[weekday];
      if (wdRule?.mode === "blocked") continue;

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const displayDate = `${dd}/${mm}/${yyyy}`;

      const times =
        dayOv?.mode === "custom" && dayOv.custom_times?.length
          ? dayOv.custom_times
          : wdRule?.mode === "custom" && wdRule.custom_times?.length
            ? wdRule.custom_times
            : storeTimes;
      for (const t of times) slots.push(`${t} - ${displayDate}`);
    }
    return slots;
  }, [
    selectedStore,
    pickupTimesByStore,
    pickupOffset,
    dayOverrides,
    weekdayRules,
  ]);

  // The allowed [earliest, latest] pickup window per date (in minutes), derived
  // from that date's configured slot times. Used to constrain the detailed
  // hour:minute picker so a customer can only choose a time inside the window.
  const pickupWindows = useMemo(() => {
    const out: Record<string, { minM: number; maxM: number }> = {};
    if (!selectedStore) return out;
    const storeTimes = pickupTimesByStore[selectedStore.id] ?? [];
    const today = new Date();
    for (let d = pickupOffset.min; d <= pickupOffset.max; d++) {
      const dayOv = dayOverrides[d];
      if (dayOv?.mode === "blocked") continue;
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const weekday = date.getDay();
      const wdRule = dayOv ? undefined : weekdayRules[weekday];
      if (wdRule?.mode === "blocked") continue;
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const displayDate = `${dd}/${mm}/${yyyy}`;
      const times =
        dayOv?.mode === "custom" && dayOv.custom_times?.length
          ? dayOv.custom_times
          : wdRule?.mode === "custom" && wdRule.custom_times?.length
            ? wdRule.custom_times
            : storeTimes;
      const mins = times.flatMap(extractVnMinutes);
      if (mins.length === 0) continue;
      out[displayDate] = { minM: Math.min(...mins), maxM: Math.max(...mins) };
    }
    return out;
  }, [
    selectedStore,
    pickupTimesByStore,
    pickupOffset,
    dayOverrides,
    weekdayRules,
  ]);

  // The date portion of the selected slot ("11h00 - 01/07/2026" → "01/07/2026").
  const selectedPickupDate = useMemo(() => {
    if (!selectedTime) return "";
    // The date is always the last " - " segment ("11h00 - 18h00 - 03/07/2026").
    const parts = selectedTime.split(" - ").map((p) => p.trim());
    const last = parts[parts.length - 1] ?? "";
    return isDateLabel(last) ? last : "";
  }, [selectedTime]);
  const selectedWindow = selectedPickupDate
    ? pickupWindows[selectedPickupDate]
    : undefined;

  // Final pickup time sent to the server: prefer the exact clock time; fall back
  // to the coarse slot when no window/detail is available.
  const pickupTimeValue = useMemo(() => {
    if (!selectedTime) return "";
    if (detailTime && selectedPickupDate) {
      return `${minutesToVn(parseHHMM(detailTime) ?? 0)} - ${selectedPickupDate}`;
    }
    return selectedTime;
  }, [selectedTime, detailTime, selectedPickupDate]);

  // Prefill / clamp the detailed clock time whenever the chosen slot changes so it
  // always starts on a valid value inside the window.
  useEffect(() => {
    if (!selectedTime) {
      setDetailTime("");
      return;
    }
    const parts = selectedTime.split(" - ").map((p) => p.trim());
    const last = parts[parts.length - 1] ?? "";
    const w = isDateLabel(last) ? pickupWindows[last] : undefined;
    const coarse = extractVnMinutes(parts[0] ?? "")[0] ?? null;
    let m = coarse ?? w?.minM ?? null;
    if (m != null && w) m = Math.min(Math.max(m, w.minM), w.maxM);
    setDetailTime(m != null ? minutesToHHMM(m) : "");
  }, [selectedTime, pickupWindows]);

  // Clamp any manual edit of the detailed time back into the day's window.
  const handleDetailTimeChange = useCallback(
    (val: string) => {
      if (!val) {
        setDetailTime("");
        return;
      }
      const m = parseHHMM(val);
      if (m == null) {
        setDetailTime(val);
        return;
      }
      const w = selectedWindow;
      const clamped = w ? Math.min(Math.max(m, w.minM), w.maxM) : m;
      setDetailTime(minutesToHHMM(clamped));
    },
    [selectedWindow],
  );

  // ── Effects ──

  useEffect(() => {
    const db = createSupabaseBrowserClient();
    db.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setIsAuthLoading(false);
      if (!uid) return;
      // Prefill delivery form from the saved default address (empty fields only).
      try {
        const addrs = await getCustomerAddresses(uid);
        const def = addrs.find((a) => a.is_default) ?? addrs[0];
        if (def) {
          if (def.full_name) setName((v) => v || def.full_name!);
          if (def.phone) setPhone((v) => v || def.phone!);
          if (def.address_line) setAddress((v) => v || def.address_line!);
          // Province/district/ward must be re-selected from the cascade so the
          // fee (per-level) resolves; we don't prefill just the province name.
        }
      } catch {
        /* ignore prefill errors */
      }
    });
  }, []);

  useEffect(() => {
    setItems(readCart());
    const onUpdate = () => setItems(readCart());
    window.addEventListener(CART_EVENT, onUpdate);
    return () => window.removeEventListener(CART_EVENT, onUpdate);
  }, []);

  // GA4 begin_checkout — once, as soon as the cart is known to be non-empty.
  useEffect(() => {
    if (gaBeginRef.current || items.length === 0) return;
    gaBeginRef.current = true;
    gaBeginCheckout(gaItems(), subtotal);
  }, [items, subtotal, gaItems]);

  // GA4 add_shipping_info — once, when the shipping step is completed (a valid
  // delivery address, or a chosen pickup store + time).
  useEffect(() => {
    if (gaShipRef.current || items.length === 0) return;
    const ready =
      deliveryMode === "pickup"
        ? !!selectedStore && (timeSlots.length === 0 || !!selectedTime)
        : addressComplete && !!address.trim();
    if (!ready) return;
    gaShipRef.current = true;
    gaAddShippingInfo(gaItems(), total, deliveryMode);
  }, [
    deliveryMode,
    selectedStore,
    selectedTime,
    timeSlots,
    addressComplete,
    address,
    items,
    total,
    gaItems,
  ]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!modalOpen && !storeModalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setStoreModalOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modalOpen, storeModalOpen]);

  // Reset selected store when switching back to delivery
  useEffect(() => {
    if (deliveryMode === "delivery") {
      setSelectedStore(null);
      setTempStore(null);
      setSelectedTime("");
    }
  }, [deliveryMode]);

  // Reset the chosen time whenever the store changes (its slots differ).
  useEffect(() => {
    setSelectedTime("");
  }, [selectedStore]);

  // Fetch eligible discount suggestions whenever cart value or shipping fee changes.
  useEffect(() => {
    if (subtotal <= 0) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(
      `/api/discounts/suggestions?subtotal=${subtotal}&shippingFee=${shippingFee}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSuggestions(d.suggestions ?? []);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => ctrl.abort();
  }, [subtotal, shippingFee]);

  // Close the pickup time dropdown when clicking outside
  useEffect(() => {
    if (!timeOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) {
        setTimeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [timeOpen]);

  // ── Handlers ──

  const applyCode = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = rawCode.trim().toUpperCase();
      if (!code) {
        setDiscountError("Vui lòng nhập mã giảm giá.");
        return false;
      }
      // Only one discount code per order is supported (the server stores a single
      // discount_code_id). Block a second distinct code so the client total always
      // matches what the server will compute.
      if (
        appliedCodes.length >= 1 &&
        !appliedCodes.some((c) => c.code.toUpperCase() === code)
      ) {
        setDiscountError("Chỉ áp dụng được 1 mã giảm giá cho mỗi đơn hàng.");
        return false;
      }
      // Atomic duplicate guard: the ref is updated synchronously, so a second
      // apply for the same code is rejected before it can start a second fetch.
      if (
        reservedCodesRef.current.has(code) ||
        appliedCodes.some((c) => c.code.toUpperCase() === code)
      ) {
        setDiscountError(`Mã "${code}" đã được áp dụng.`);
        return false;
      }
      reservedCodesRef.current.add(code);
      setDiscountError("");
      setDiscountSuccess("");
      try {
        const res = await fetch("/api/discounts/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, subtotal, shippingFee }),
        });
        const data = await res.json();
        if (data.ok) {
          const storedCode = data.code ?? code;
          // Re-key the reservation to the canonical (DB) code casing.
          reservedCodesRef.current.delete(code);
          reservedCodesRef.current.add(storedCode.toUpperCase());
          setAppliedCodes((prev) =>
            // Final guard inside the functional update against the latest state.
            prev.some((c) => c.code.toUpperCase() === storedCode.toUpperCase())
              ? prev
              : [
                  ...prev,
                  {
                    code: storedCode,
                    discountAmount: data.discountAmount ?? 0,
                    shippingDiscountAmount: data.shippingDiscountAmount ?? 0,
                    message: data.message ?? "",
                  },
                ],
          );
          setCouponInput("");
          setDiscountSuccess(data.message || `Đã áp dụng mã "${storedCode}".`);
          return true;
        } else {
          reservedCodesRef.current.delete(code);
          setDiscountError(
            data.message ?? `Mã giảm giá "${code}" không hợp lệ.`,
          );
          return false;
        }
      } catch {
        reservedCodesRef.current.delete(code);
        setDiscountError("Không thể kiểm tra mã giảm giá. Vui lòng thử lại.");
        return false;
      }
    },
    [subtotal, shippingFee, appliedCodes],
  );

  const handleApplyCoupon = useCallback(async () => {
    await applyCode(couponInput);
  }, [couponInput, applyCode]);

  const handleRemoveCode = useCallback((code: string) => {
    reservedCodesRef.current.delete(code.toUpperCase());
    setAppliedCodes((prev) => prev.filter((c) => c.code !== code));
    setDiscountSuccess("");
  }, []);

  // Select a payment method and fire GA4 add_payment_info once (first choice).
  const selectPayment = useCallback(
    (method: "bank_transfer" | "cod") => {
      setPaymentMethod(method);
      if (!gaPayRef.current) {
        gaPayRef.current = true;
        gaAddPaymentInfo(gaItems(), total, method);
      }
    },
    [gaItems, total],
  );

  const handlePlaceOrder = useCallback(async () => {
    if (!userId) {
      setOrderMessage(
        "Vui lòng đăng nhập hoặc tạo tài khoản trước khi xác nhận đơn hàng.",
      );
      setOrderStatus("error");
      return;
    }
    if (items.length === 0) {
      setOrderMessage("Giỏ hàng của bạn đang trống.");
      setOrderStatus("error");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setOrderMessage("Vui lòng điền đầy đủ họ tên và số điện thoại.");
      setOrderStatus("error");
      return;
    }
    if (deliveryMode === "pickup" && !selectedStore) {
      setOrderMessage("Vui lòng chọn điểm lấy hàng.");
      setOrderStatus("error");
      return;
    }
    if (deliveryMode === "pickup" && timeSlots.length > 0 && !selectedTime) {
      setOrderMessage("Vui lòng chọn thời gian lấy hàng.");
      setOrderStatus("error");
      return;
    }
    if (deliveryMode === "delivery" && !address.trim()) {
      setOrderMessage("Vui lòng nhập địa chỉ nhận hàng.");
      setOrderStatus("error");
      return;
    }
    if (deliveryMode === "delivery" && !addressComplete) {
      const need =
        requiredLevels >= 3
          ? "Tỉnh/TP, Quận/Huyện và Phường/Xã"
          : requiredLevels >= 2
            ? "Tỉnh/TP và Quận/Huyện"
            : "Tỉnh/TP";
      setOrderMessage(`Vui lòng chọn ${need}.`);
      setOrderStatus("error");
      return;
    }

    setOrderStatus("loading");
    setOrderMessage("");

    // GA4 add_payment_info fallback — if the customer never explicitly clicked a
    // payment button (used the default), still record the step before placing.
    if (!gaPayRef.current) {
      gaPayRef.current = true;
      gaAddPaymentInfo(gaItems(), total, paymentMethod);
    }

    // Shared form body sent to both /api/checkout (COD/auto) and /api/checkout/prepare (QR).
    const formBody = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      address:
        deliveryMode === "pickup"
          ? selectedStore?.name
          : address.trim() || undefined,
      province: deliveryMode === "pickup" ? undefined : province || undefined,
      district: deliveryMode === "pickup" ? undefined : district || undefined,
      ward: deliveryMode === "pickup" ? undefined : ward || undefined,
      provinceId:
        deliveryMode === "pickup" ? undefined : provinceId || undefined,
      districtId:
        deliveryMode === "pickup" ? undefined : districtId || undefined,
      wardId: deliveryMode === "pickup" ? undefined : wardId || undefined,
      orderNote: orderNote.trim() || undefined,
      deliveryMode,
      deliveryTime:
        deliveryMode === "pickup" ? pickupTimeValue || undefined : undefined,
      paymentMethod,
      discountCodes: appliedCodes.map((c) => c.code),
      cart: items,
    };

    try {
      // ── QR / bank-transfer: prepare creates the order (awaiting_payment), confirm reconciles on customer click ──
      // If total is 0 (fully discounted), skip QR entirely and go straight to /api/checkout
      // which handles zero-amount auto-confirmation without needing a bank transfer.
      if (paymentMethod === "bank_transfer" && total > 0) {
        const res = await fetch("/api/checkout/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formBody),
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          setOrderMessage(
            data.error ?? "Không thể chuẩn bị đơn hàng. Vui lòng thử lại.",
          );
          setOrderStatus("error");
          return;
        }

        // Persist form data + QR display data in localStorage. The pending page
        // will re-send the paymentCode (+ codeSignature) to /api/checkout/confirm
        // when customer clicks "Tôi đã chuyển khoản". The order was already created
        // by /api/checkout/prepare above (status: awaiting_payment).
        try {
          localStorage.setItem(
            "cuc_qr_pending_v1",
            JSON.stringify({
              createdAt: Date.now(), // used to expire stale QR sessions
              formData: {
                ...formBody,
                discountCodes: appliedCodes.map((c) => c.code),
              },
              display: {
                paymentCode: data.paymentCode,
                codeSignature: data.codeSignature ?? null,
                amount: data.amount,
                subtotal: data.subtotal,
                shippingFee: data.shippingFee,
                shippingDiscount: data.shippingDiscount,
                productDiscount: data.productDiscount,
                bankName: data.bankName,
                bankAccountNumber: data.bankAccountNumber,
                bankAccountName: data.bankAccountName,
                qrImageUrl: data.qrImageUrl,
                cartItems: items.map((i) => ({
                  name: i.name,
                  price: i.price,
                  quantity: i.quantity,
                  image: i.image,
                })),
              },
            }),
          );
        } catch {
          // localStorage unavailable — pending page shows minimal fallback
        }

        // GA4 order_created — the order row now exists (awaiting_payment). The
        // real `purchase` is sent server-side only after payment is confirmed.
        gaOrderCreated(data.orderId, gaItems(), data.amount ?? total);

        // Cart is NOT cleared — kept until payment is confirmed on success page.
        setOrderStatus("success");
        router.push("/checkout/pending?mode=qr");
        return;
      }

      // ── COD / zero-amount: create order immediately via /api/checkout ──
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formBody),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setOrderMessage(data.error ?? "Không thể đặt hàng. Vui lòng thử lại.");
        setOrderStatus("error");
        return;
      }

      // Zero-amount (auto-confirmed) and COD go straight to success.
      if (data.autoCompleted || data.cod) {
        // GA4 order_created (purchase is also sent server-side for these paths).
        gaOrderCreated(data.orderId, gaItems(), total);
        clearCart();
        router.push(
          data.redirectTo ?? `/checkout/success?orderId=${data.orderId}`,
        );
        return;
      }

      // Fallback: order created but neither auto-completed nor COD (shouldn't happen).
      setOrderMessage(
        "Đơn hàng đã được tạo nhưng trạng thái không xác định. Vui lòng kiểm tra lịch sử đơn hàng.",
      );
      setOrderStatus("error");
    } catch {
      setOrderMessage("Lỗi kết nối. Vui lòng thử lại.");
      setOrderStatus("error");
    }
  }, [
    userId,
    items,
    name,
    phone,
    email,
    address,
    province,
    district,
    ward,
    provinceId,
    districtId,
    wardId,
    addressComplete,
    requiredLevels,
    orderNote,
    deliveryMode,
    selectedStore,
    selectedTime,
    pickupTimeValue,
    timeSlots,
    paymentMethod,
    appliedCodes,
    router,
    total,
    gaItems,
  ]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) setModalOpen(false);
    },
    [],
  );

  const handleStoreBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) setStoreModalOpen(false);
    },
    [],
  );

  const handleConfirmStore = useCallback(() => {
    if (tempStore) setSelectedStore(tempStore);
    setStoreModalOpen(false);
  }, [tempStore]);

  const selectProvince = useCallback((o: LocationOpt) => {
    setProvince(o.name);
    setProvinceId(o.id);
    setProvinceFee(o.shipping_fee ?? 0);
    setRequiredLevels(Math.min(3, Math.max(1, o.required_levels ?? 2)));
    setProvincePayment(
      ["both", "qr", "cod"].includes(o.payment_methods ?? "")
        ? (o.payment_methods as string)
        : "both",
    );
    setDistrict("");
    setDistrictId("");
    setDistrictFee(0);
    setDistrictPayment("both");
    setWard("");
    setWardId("");
    setWardFee(0);
    // Only force the district step when this province requires ≥ 2 levels.
    if ((o.required_levels ?? 2) >= 2) setDropdownTab("district");
    else setDropdownOpen(false);
  }, []);
  const selectDistrict = useCallback((o: LocationOpt) => {
    setDistrict(o.name);
    setDistrictId(o.id);
    setDistrictFee(o.shipping_fee ?? 0);
    setDistrictPayment(
      ["both", "qr", "cod"].includes(o.payment_methods ?? "")
        ? (o.payment_methods as string)
        : "both",
    );
    setWard("");
    setWardId("");
    setWardFee(0);
    setDropdownTab("ward");
  }, []);
  const selectWard = useCallback((o: LocationOpt) => {
    setWard(o.name);
    setWardId(o.id);
    setWardFee(o.shipping_fee ?? 0);
    setDropdownOpen(false);
  }, []);

  // ── Render ──

  return (
    <main className="checkout-page">
      <div className="checkout-page__inner">
        {/* Auth CTA */}
        {!isAuthLoading && !userId && (
          <div className="checkout-page__auth-notice">
            <p className="checkout-page__auth-notice-text">
              Bạn cần đăng nhập hoặc tạo tài khoản để xác nhận đơn hàng.
            </p>
            <Link
              href="/login?redirect=/checkout"
              className="checkout-page__signin"
            >
              Đăng nhập / Đăng ký
            </Link>
          </div>
        )}

        {/* Two-column layout */}
        <div className="checkout-page__layout">
          {/* ════════════ LEFT COLUMN ════════════ */}
          <div className="checkout-page__left">
            {/* ── Delivery Information ── */}
            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">
                Delivery Information
              </h2>

              <div className="checkout-page__tabs">
                <button
                  type="button"
                  className={`checkout-page__tab${deliveryMode === "delivery" ? " checkout-page__tab--active" : ""}`}
                  onClick={() => setDeliveryMode("delivery")}
                >
                  🚚 Delivery
                </button>
                <button
                  type="button"
                  className={`checkout-page__tab${deliveryMode === "pickup" ? " checkout-page__tab--active" : ""}`}
                  onClick={() => setDeliveryMode("pickup")}
                >
                  🏪 Pick up
                </button>
              </div>

              <div className="checkout-page__fields">
                <input
                  className="checkout-page__input"
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />

                <div className="checkout-page__phone-wrap">
                  <input
                    className="checkout-page__phone-input"
                    type="tel"
                    placeholder="Enter phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                  <span
                    className="checkout-page__phone-flag"
                    aria-hidden="true"
                  >
                    🇻🇳
                  </span>
                </div>

                {deliveryMode === "pickup" ? (
                  <>
                    <button
                      type="button"
                      className="checkout-page__store-btn"
                      onClick={() => {
                        setTempStore(selectedStore);
                        setStoreModalOpen(true);
                      }}
                    >
                      {selectedStore
                        ? selectedStore.name
                        : "Chọn điểm lấy hàng"}
                    </button>

                    {/* Time selector — shown after a store is chosen */}
                    {selectedStore && (
                      <div className="checkout-page__time-wrap" ref={timeRef}>
                        <button
                          type="button"
                          className="checkout-page__time-button"
                          onClick={() => setTimeOpen((v) => !v)}
                          aria-expanded={timeOpen}
                          aria-haspopup="listbox"
                        >
                          <span
                            className={
                              selectedTime
                                ? ""
                                : "checkout-page__time-placeholder"
                            }
                          >
                            {selectedTime || "Delivery time"}
                          </span>
                          <span
                            className={`checkout-page__time-caret${timeOpen ? " checkout-page__time-caret--open" : ""}`}
                            aria-hidden="true"
                          >
                            ▶
                          </span>
                        </button>
                        <p
                          style={{
                            fontSize: 14,
                            color: "#666",
                            marginBottom: 16,
                            lineHeight: 1.6,
                          }}
                        >
                          Chọn khung giờ, sau đó chọn giờ lấy hàng chi tiết (giờ:phút) bên dưới.
                        </p>
                        {timeOpen && (
                          <div
                            className="checkout-page__time-list"
                            role="listbox"
                          >
                            {timeSlots.length === 0 ? (
                              <p className="checkout-page__time-empty">
                                Chưa có khung giờ. Vui lòng liên hệ shop.
                              </p>
                            ) : (
                              timeSlots.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  role="option"
                                  aria-selected={selectedTime === t}
                                  className={`checkout-page__time-option${selectedTime === t ? " checkout-page__time-option--active" : ""}`}
                                  onClick={() => {
                                    setSelectedTime(t);
                                    setTimeOpen(false);
                                  }}
                                >
                                  {t}
                                </button>
                              ))
                            )}
                          </div>
                        )}

                        {/* Detailed hour:minute picker — appears once a slot is
                            chosen; constrained to that date's configured
                            [earliest, latest] window when one can be derived. */}
                        {selectedTime && (
                          <div style={{ marginTop: 14, marginBottom: 16 }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: 14,
                                fontWeight: 600,
                                marginBottom: 6,
                              }}
                            >
                              Giờ lấy hàng chi tiết
                            </label>
                            <input
                              type="time"
                              value={detailTime}
                              min={
                                selectedWindow
                                  ? minutesToHHMM(selectedWindow.minM)
                                  : undefined
                              }
                              max={
                                selectedWindow
                                  ? minutesToHHMM(selectedWindow.maxM)
                                  : undefined
                              }
                              step={60}
                              onChange={(e) =>
                                handleDetailTimeChange(e.target.value)
                              }
                              className="checkout-page__detail-time"
                              style={{
                                padding: "10px 12px",
                                borderRadius: 8,
                                border: "1px solid #ddd",
                                fontSize: 15,
                                width: "100%",
                                maxWidth: 200,
                              }}
                            />
                            {selectedWindow && (
                              <small
                                style={{
                                  display: "block",
                                  marginTop: 6,
                                  color: "#666",
                                  fontSize: 13,
                                }}
                              >
                                Chỉ nhận trong khung{" "}
                                {minutesToVn(selectedWindow.minM)}–
                                {minutesToVn(selectedWindow.maxM)} ngày{" "}
                                {selectedPickupDate}
                              </small>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      className="checkout-page__input"
                      type="email"
                      placeholder="Enter email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />

                    <div className="checkout-page__labeled-field">
                      <span className="checkout-page__field-label">
                        Countries
                      </span>
                      <span className="checkout-page__field-value">
                        Vietnam
                      </span>
                    </div>

                    <input
                      className="checkout-page__input"
                      type="text"
                      placeholder="Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      autoComplete="street-address"
                    />

                    <div
                      className="checkout-page__province-wrap"
                      ref={dropdownRef}
                    >
                      <button
                        type="button"
                        className="checkout-page__province-button"
                        onClick={() => setDropdownOpen((v) => !v)}
                        aria-expanded={dropdownOpen}
                        aria-haspopup="listbox"
                      >
                        <span className="checkout-page__field-label">
                          Province/City, District/County, Ward/Commune
                        </span>
                        <span className="checkout-page__field-value">
                          {[province, district, ward]
                            .filter(Boolean)
                            .join(", ") || "Chọn khu vực"}
                        </span>
                      </button>

                      {dropdownOpen && (
                        <div
                          className="checkout-page__address-dropdown"
                          role="listbox"
                        >
                          <div className="checkout-page__address-tabs">
                            {(
                              [
                                { id: "province", label: "Province/City" },
                                { id: "district", label: "District/County" },
                                { id: "ward", label: "Ward/Commune" },
                              ] as const
                            ).map(({ id, label }) => (
                              <button
                                key={id}
                                type="button"
                                className={`checkout-page__address-tab${dropdownTab === id ? " checkout-page__address-tab--active" : ""}`}
                                onClick={() => setDropdownTab(id)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div className="checkout-page__address-list">
                            {dropdownTab === "province" ? (
                              provinceOpts.length === 0 ? (
                                <p className="checkout-page__address-empty">
                                  Chưa có dữ liệu tỉnh/thành.
                                </p>
                              ) : (
                                provinceOpts.map((o) => (
                                  <button
                                    key={o.id}
                                    type="button"
                                    role="option"
                                    aria-selected={provinceId === o.id}
                                    className={`checkout-page__address-option${provinceId === o.id ? " checkout-page__address-option--active" : ""}`}
                                    onClick={() => selectProvince(o)}
                                  >
                                    {o.name}
                                    {o.shipping_fee
                                      ? ` (+${o.shipping_fee.toLocaleString("vi-VN")}đ)`
                                      : ""}
                                  </button>
                                ))
                              )
                            ) : dropdownTab === "district" ? (
                              !provinceId ? (
                                <p className="checkout-page__address-empty">
                                  Chọn tỉnh/thành phố trước.
                                </p>
                              ) : districtOpts.length === 0 ? (
                                <p className="checkout-page__address-empty">
                                  Chưa có quận/huyện cho khu vực này.
                                </p>
                              ) : (
                                districtOpts.map((o) => (
                                  <button
                                    key={o.id}
                                    type="button"
                                    role="option"
                                    aria-selected={districtId === o.id}
                                    className={`checkout-page__address-option${districtId === o.id ? " checkout-page__address-option--active" : ""}`}
                                    onClick={() => selectDistrict(o)}
                                  >
                                    {o.name}
                                    {o.shipping_fee
                                      ? ` (+${o.shipping_fee.toLocaleString("vi-VN")}đ)`
                                      : ""}
                                  </button>
                                ))
                              )
                            ) : !districtId ? (
                              <p className="checkout-page__address-empty">
                                Chọn quận/huyện trước.
                              </p>
                            ) : wardOpts.length === 0 ? (
                              <p className="checkout-page__address-empty">
                                Chưa có phường/xã cho khu vực này.
                              </p>
                            ) : (
                              wardOpts.map((o) => (
                                <button
                                  key={o.id}
                                  type="button"
                                  role="option"
                                  aria-selected={wardId === o.id}
                                  className={`checkout-page__address-option${wardId === o.id ? " checkout-page__address-option--active" : ""}`}
                                  onClick={() => selectWard(o)}
                                >
                                  {o.name}
                                  {o.shipping_fee
                                    ? ` (+${o.shipping_fee.toLocaleString("vi-VN")}đ)`
                                    : ""}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Delivery Method (only for delivery mode) ── */}
            {deliveryMode === "delivery" && (
              <div className="checkout-page__panel">
                <h2 className="checkout-page__panel-title">Delivery Method</h2>
                {addressComplete ? (
                  <div className="checkout-page__delivery-method">
                    <div className="checkout-page__delivery-method-left">
                      <span
                        className="checkout-page__delivery-radio"
                        aria-hidden="true"
                      />
                      <span>Giao hàng tận nơi</span>
                    </div>
                    <span className="checkout-page__delivery-fee">
                      {formatPrice(shippingFee)}
                    </span>
                  </div>
                ) : (
                  <div className="checkout-page__delivery-empty">
                    Chọn Tỉnh/TP và Quận/Huyện để xem phí giao hàng (Phường/Xã
                    tùy chọn)
                  </div>
                )}
              </div>
            )}

            {/* ── Paying Method ── */}
            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Paying method</h2>
              <div className="checkout-page__payment-options">
                {canQr && (
                  <button
                    type="button"
                    className={`checkout-page__payment-button${paymentMethod === "bank_transfer" ? " checkout-page__payment-button--active" : ""}`}
                    onClick={() => selectPayment("bank_transfer")}
                    aria-pressed={paymentMethod === "bank_transfer"}
                  >
                    <QrIcon />
                    Chuyển khoản qua QR
                  </button>
                )}
                {canCod && (
                  <button
                    type="button"
                    className={`checkout-page__payment-button${paymentMethod === "cod" ? " checkout-page__payment-button--active" : ""}`}
                    onClick={() => selectPayment("cod")}
                    aria-pressed={paymentMethod === "cod"}
                  >
                    <CodIcon />
                    COD - Trả tiền khi nhận hàng
                  </button>
                )}
              </div>
              {deliveryMode === "delivery" && provinceId && !canCod && (
                <p
                  className="checkout-page__payment-hint"
                  style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}
                >
                  Khu vực này chỉ hỗ trợ thanh toán chuyển khoản qua QR.
                </p>
              )}
              {deliveryMode === "delivery" && provinceId && !canQr && (
                <p
                  className="checkout-page__payment-hint"
                  style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}
                >
                  Khu vực này chỉ hỗ trợ thanh toán COD.
                </p>
              )}
            </div>

            {/* ── Order Note ── */}
            <div className="checkout-page__panel">
              <textarea
                className="checkout-page__note"
                placeholder="Order Note"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                rows={3}
                aria-label="Order note"
              />
            </div>
          </div>

          {/* ════════════ RIGHT COLUMN ════════════ */}
          <div className="checkout-page__right">
            {/* ── Your Cart ── */}
            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Your Cart</h2>

              {items.length === 0 ? (
                <div className="checkout-page__cart-empty">
                  <p className="checkout-page__cart-empty-text">
                    Giỏ hàng của bạn đang trống.
                  </p>
                  <Link
                    className="checkout-page__continue-link"
                    href="/collection"
                  >
                    ◀ Tiếp tục mua hàng
                  </Link>
                </div>
              ) : (
                <div className="checkout-page__cart-list">
                  {items.map((item, idx) => (
                    <div key={item.id}>
                      <div className="checkout-page__cart-item">
                        <div className="checkout-page__item-image">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="72px"
                            style={{ objectFit: "cover" }}
                          />
                        </div>
                        <div className="checkout-page__item-info">
                          <p className="checkout-page__item-name">
                            {item.name}
                          </p>
                          <p className="checkout-page__item-price">
                            {formatPrice(item.price)}
                          </p>
                          <div className="checkout-page__quantity">
                            <button
                              type="button"
                              className="checkout-page__quantity-button"
                              onClick={() =>
                                setItems(
                                  updateQuantity(item.id, item.quantity + 1),
                                )
                              }
                              disabled={
                                typeof item.stock === "number" &&
                                item.quantity >= item.stock
                              }
                              aria-label="Tăng số lượng"
                            >
                              +
                            </button>
                            <span
                              className="checkout-page__quantity-value"
                              aria-live="polite"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              className="checkout-page__quantity-button"
                              onClick={() =>
                                setItems(
                                  updateQuantity(item.id, item.quantity - 1),
                                )
                              }
                              aria-label="Giảm số lượng"
                            >
                              −
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="checkout-page__remove"
                          onClick={() => {
                            gaRemoveFromCart(item, item.quantity);
                            setItems(removeItem(item.id));
                          }}
                          aria-label={`Xóa ${item.name}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      {idx < items.length - 1 && (
                        <hr className="checkout-page__item-divider" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Discount ── */}
            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Discount</h2>

              <button
                type="button"
                className="checkout-page__discount-button"
                onClick={() => setModalOpen(true)}
              >
                <CouponIcon />
                Chọn mã giảm giá
              </button>

              <div className="checkout-page__discount-row">
                <input
                  className="checkout-page__discount-input"
                  type="text"
                  placeholder="Nhập mã giảm giá"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setDiscountError("");
                    setDiscountSuccess("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleApplyCoupon();
                  }}
                  aria-label="Coupon code"
                />
                <button
                  type="button"
                  className="checkout-page__apply-button"
                  onClick={handleApplyCoupon}
                >
                  Apply
                </button>
              </div>

              {discountError && (
                <p className="checkout-page__discount-error" role="alert">
                  {discountError}
                </p>
              )}
              {!discountError && discountSuccess && (
                <p className="checkout-page__discount-success" role="status">
                  {discountSuccess}
                </p>
              )}

              {/* Applied codes shown inside coupon slots; empty slots fill each row of 3 */}
              <div className="checkout-page__coupon-shelf">
                {appliedCodes.map((c) => (
                  <div
                    key={c.code}
                    className="checkout-page__coupon-slot"
                    title={c.code}
                  >
                    <CouponIcon />
                    <span className="checkout-page__coupon-slot-code">
                      {c.code}
                    </span>
                    <button
                      type="button"
                      className="checkout-page__coupon-slot-remove"
                      onClick={() => handleRemoveCode(c.code)}
                      aria-label={`Xóa mã ${c.code}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {Array.from({
                  length:
                    Math.max(3, Math.ceil(appliedCodes.length / 3) * 3) -
                    appliedCodes.length,
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="checkout-page__coupon-shape"
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>

            {/* ── Order Summary ── */}
            <div className="checkout-page__panel">
              <h2 className="checkout-page__panel-title">Order Summary</h2>
              <div className="checkout-page__summary-rows">
                <div className="checkout-page__summary-row">
                  <span>Subtotal</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                {totalDiscountAmount > 0 && (
                  <div className="checkout-page__summary-row checkout-page__summary-row--discount">
                    <span>Discount</span>
                    <span className="checkout-page__summary-val">
                      −{formatPrice(totalDiscountAmount)}
                    </span>
                  </div>
                )}
                <div className="checkout-page__summary-row">
                  <span>Shipping fee</span>
                  <span className="checkout-page__summary-val">
                    {formatPrice(shippingFee)}
                  </span>
                </div>
                {totalShippingDiscount > 0 && (
                  <div className="checkout-page__summary-row checkout-page__summary-row--discount">
                    <span>Miễn phí vận chuyển</span>
                    <span className="checkout-page__summary-val">
                      −
                      {formatPrice(
                        Math.min(totalShippingDiscount, shippingFee),
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div className="checkout-page__summary-total">
                <span>Total amount</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* ── Place Order ── */}
            {orderStatus !== "success" && (
              <button
                type="button"
                className="checkout-page__place-order"
                onClick={handlePlaceOrder}
                disabled={orderStatus === "loading" || isAuthLoading || !userId}
                title={
                  !userId ? "Vui lòng đăng nhập trước khi đặt đơn" : undefined
                }
              >
                {orderStatus === "loading" ? "Đang xử lý…" : "Đặt đơn!"}
              </button>
            )}

            {orderStatus === "error" && (
              <div
                className="checkout-page__message checkout-page__message--error"
                role="alert"
              >
                {orderMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Discount Modal ── */}
      {modalOpen && (
        <div
          className="checkout-page__modal-backdrop"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discount-modal-title"
        >
          <div className="checkout-page__discount-modal">
            <button
              type="button"
              className="checkout-page__modal-close"
              onClick={() => setModalOpen(false)}
              aria-label="Đóng"
            >
              ✕
            </button>
            <h2
              id="discount-modal-title"
              className="checkout-page__modal-title"
            >
              Chọn mã giảm giá
            </h2>
            <BigCouponIcon />
            {suggestions.filter(
              (s) => !appliedCodes.some((a) => a.code === s.code),
            ).length > 0 ? (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {suggestions
                  .filter((s) => !appliedCodes.some((a) => a.code === s.code))
                  .map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={async () => {
                        const ok = await applyCode(s.code);
                        if (ok) setModalOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1.5px dashed #f59e0b",
                        background: "#fffbeb",
                        color: "#92400e",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span>{s.code}</span>
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 400,
                          color: "#b45309",
                          maxWidth: 160,
                          textAlign: "right",
                        }}
                      >
                        {s.label}
                      </span>
                    </button>
                  ))}
              </div>
            ) : (
              <p className="checkout-page__modal-text">
                Không có mã giảm giá phù hợp
              </p>
            )}
            <button
              type="button"
              className="checkout-page__modal-button"
              onClick={() => setModalOpen(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ── Store Selection Modal ── */}
      {storeModalOpen && (
        <div
          className="checkout-page__modal-backdrop"
          onClick={handleStoreBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="store-modal-title"
        >
          <div className="checkout-page__store-modal">
            <div className="checkout-page__store-modal-header">
              <button
                type="button"
                className="checkout-page__modal-close"
                style={{ position: "static" }}
                onClick={() => setStoreModalOpen(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
              <h2
                id="store-modal-title"
                className="checkout-page__store-modal-title"
              >
                Select Store
              </h2>
              <div style={{ width: 36 }} />
            </div>

            <div className="checkout-page__store-list">
              {pickupStores.length === 0 ? (
                <p
                  style={{
                    fontSize: 14,
                    color: "#6b7280",
                    textAlign: "center",
                    padding: "12px 0",
                  }}
                >
                  Không có điểm lấy hàng nào.
                </p>
              ) : (
                pickupStores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    className={`checkout-page__store-option${tempStore?.id === store.id ? " checkout-page__store-option--active" : ""}`}
                    onClick={() => setTempStore(store)}
                  >
                    {store.name}
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              className="checkout-page__place-order"
              style={{
                fontSize: "clamp(16px, 1.6vw, 20px)",
                padding: "14px 0",
              }}
              onClick={handleConfirmStore}
              disabled={!tempStore}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
