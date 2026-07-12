// Shared admin-facing types (server-only).

export type AdminProduct = {
  id: string; slug: string; name: string; category: string | null; price: number;
  stock: number | null; is_bestseller: boolean | null; is_new: boolean | null;
  is_active: boolean | null; image_url: string | null; description: string | null;
  sku: string | null; low_stock_threshold: number | null;
  image_path: string | null; image_alt: string | null;
  created_at: string; updated_at: string | null;
};

export type AdminOrder = {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address: string;
  pickup_time: string | null;
  subtotal: number;
  shipping_fee: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  discount_code: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_code: string | null;
  paid_at: string | null;
  bank_transaction_id: string | null;
  status: string;
  order_note: string | null;
  admin_note: string | null;
  confirmed_at: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_requested_at: string | null;
  cancel_reason: string | null;
  estimated_delivery_min_at: string | null;
  estimated_delivery_max_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AdminOrderItem = {
  id: string; order_id: string; product_id: string | null;
  product_name: string; unit_price: number; quantity: number;
};

export type AdminSupportMessage = {
  id: string; name: string; email: string | null; message: string;
  status: string | null; admin_note: string | null;
  resolved_at: string | null; archived_at: string | null; created_at: string;
};

export type AdminDiscountCode = {
  id: string; code: string; type: string; value: number;
  min_order_amount: number; max_uses: number | null; use_count: number;
  is_active: boolean; is_reusable: boolean; expires_at: string | null; description: string | null;
  created_at: string;
};

export type AdminLocationOption = {
  id: string; type: string; name: string; parent_id: string | null;
  sort_order: number; is_active: boolean; shipping_fee: number;
  required_levels: number; payment_methods: string;
};

export type AdminSiteSetting = {
  id: string; key: string; value: string | null; type: string;
  label: string | null; group_name: string;
};

export type AdminInventoryMovement = {
  id: string; product_id: string; delta: number; stock_after: number;
  reason: string; admin_note: string | null; created_at: string;
};

export type AdminPaymentRequest = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  payment_code: string;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  qr_payload: string | null;
  provider: string | null;
  provider_status: string | null;
  expires_at: string | null;
  paid_at: string | null;
  matched_transaction_id: string | null;
  admin_note: string | null;
  payment_mode: string;
  quota_month: string | null;
  quota_counted: boolean;
  auto_confirm_eligible: boolean;
  manual_required_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminPaymentProviderUsage = {
  id: string;
  provider: string;
  quota_month: string;
  auto_quota_limit: number;
  auto_success_count: number;
  manual_fallback_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminBankTransaction = {
  id: string;
  provider: string | null;
  provider_transaction_id: string | null;
  transaction_time: string | null;
  amount: number;
  currency: string;
  description: string | null;
  bank_account_number: string | null;
  counterparty_name: string | null;
  status: string;
  matched_order_id: string | null;
  matched_payment_request_id: string | null;
  match_failure_reason: string | null;
  created_at: string;
};

export type AdminBlogPost = {
  id: string; slug: string; title: string; excerpt: string | null;
  content: string | null; image_url: string | null; read_time: string | null;
  views: number; likes: number; comments_count: number;
  is_published: boolean; sort_order: number; published_at: string | null;
  image_path: string | null; image_alt: string | null;
  show_detail_image?: boolean;
  created_at: string; updated_at: string;
};

export type AdminFeedbackItem = {
  id: string; customer_name: string; message: string; image_url: string | null;
  rating: number | null; is_featured: boolean; is_published: boolean;
  sort_order: number; image_path: string | null; image_alt: string | null;
  description: string | null; detail_title: string | null; detail_title_font_size: number | null;
  reviewer_font_size: number | null;
  created_at: string; updated_at: string;
};

export type AdminCustomer = {
  id: string; user_id: string | null; full_name: string | null;
  phone: string | null; email: string | null; birthday: string | null;
  gender: string | null; created_at: string;
};

export type AdminAnalyticsEvent = {
  id: string; path: string; event_type: string; event_name: string | null;
  product_id: string | null; device_type: string | null;
  session_id: string | null; created_at: string;
};

export type AdminComment = {
  id: string;
  target_type: string;
  target_id: string | null;
  target_slug: string | null;
  user_id: string | null;
  author_name: string | null;
  author_email: string | null;
  content: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};
