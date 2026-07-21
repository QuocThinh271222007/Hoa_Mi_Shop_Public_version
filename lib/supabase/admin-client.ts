import 'server-only';
import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY. Never import this file in client components.
// Uses SUPABASE_SERVICE_ROLE_KEY which bypasses Row Level Security.

// Supabase v2 requires Relationships field on every table type.
// Without it, Insert/Update types resolve to `never` in the client generics.
type NoRelationships = { Relationships: [] };

export type AdminDatabase = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          price: number;
          image_url: string | null;
          description: string | null;
          category: string | null;
          is_bestseller: boolean | null;
          is_new: boolean | null;
          stock: number | null;
          created_at: string;
          is_active: boolean | null;
          sku: string | null;
          low_stock_threshold: number | null;
          sort_order: number | null;
          updated_at: string | null;
          image_path: string | null;
          image_alt: string | null;
        };
        Insert: {
          id?: string; slug: string; name: string; price: number;
          image_url?: string | null; description?: string | null; category?: string | null;
          is_bestseller?: boolean | null; is_new?: boolean | null; stock?: number | null;
          is_active?: boolean | null; sku?: string | null; low_stock_threshold?: number | null;
          sort_order?: number | null; created_at?: string; updated_at?: string | null;
          image_path?: string | null; image_alt?: string | null;
        };
        Update: Partial<{
          slug: string; name: string; price: number; image_url: string | null;
          description: string | null; category: string | null; is_bestseller: boolean | null;
          is_new: boolean | null; stock: number | null; is_active: boolean | null;
          sku: string | null; low_stock_threshold: number | null; sort_order: number | null;
          updated_at: string | null; image_path: string | null; image_alt: string | null;
        }>;
      } & NoRelationships;
      orders: {
        Row: {
          id: string; user_id: string | null; customer_name: string;
          customer_phone: string; customer_email: string | null; shipping_address: string;
          subtotal: number; status: string; created_at: string;
          order_note: string | null; shipping_fee: number | null; discount_amount: number | null;
          shipping_discount_amount: number | null; discount_type: string | null;
          total_amount: number | null; discount_code: string | null;
          discount_code_id: string | null; discount_usage_counted_at: string | null;
          payment_method: string | null; payment_status: string | null;
          payment_code: string | null; paid_at: string | null;
          bank_transaction_id: string | null; admin_note: string | null;
          confirmed_at: string | null; packed_at: string | null; shipped_at: string | null;
          delivered_at: string | null; cancelled_at: string | null;
          returned_at: string | null; refunded_at: string | null;
          estimated_delivery_min_at: string | null; estimated_delivery_max_at: string | null;
          cancel_requested_at: string | null; cancel_reason: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string; user_id?: string | null; customer_name: string;
          customer_phone: string; customer_email?: string | null; shipping_address: string;
          subtotal: number; status?: string; created_at?: string;
          order_note?: string | null; shipping_fee?: number | null; discount_amount?: number | null;
          shipping_discount_amount?: number | null; discount_type?: string | null;
          total_amount?: number | null; discount_code?: string | null;
          discount_code_id?: string | null; discount_usage_counted_at?: string | null;
          payment_method?: string | null; payment_status?: string | null;
          payment_code?: string | null; paid_at?: string | null;
          bank_transaction_id?: string | null; admin_note?: string | null;
          confirmed_at?: string | null; packed_at?: string | null; shipped_at?: string | null;
          delivered_at?: string | null; cancelled_at?: string | null;
          estimated_delivery_min_at?: string | null; estimated_delivery_max_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<{
          user_id: string | null; customer_name: string; customer_phone: string;
          customer_email: string | null; shipping_address: string; subtotal: number;
          status: string; order_note: string | null; shipping_fee: number | null;
          discount_amount: number | null; shipping_discount_amount: number | null;
          discount_type: string | null; total_amount: number | null;
          discount_code: string | null;
          discount_code_id: string | null; discount_usage_counted_at: string | null;
          payment_method: string | null;
          payment_status: string | null; payment_code: string | null;
          paid_at: string | null; bank_transaction_id: string | null;
          admin_note: string | null;
          confirmed_at: string | null; packed_at: string | null; shipped_at: string | null;
          delivered_at: string | null; cancelled_at: string | null;
          returned_at: string | null; refunded_at: string | null;
          estimated_delivery_min_at: string | null; estimated_delivery_max_at: string | null;
          cancel_requested_at: string | null; cancel_reason: string | null;
          updated_at: string | null;
        }>;
      } & NoRelationships;
      order_items: {
        Row: {
          id: string; order_id: string; product_id: string | null;
          product_name: string; unit_price: number; quantity: number; created_at: string;
        };
        Insert: {
          id?: string; order_id: string; product_id?: string | null;
          product_name: string; unit_price: number; quantity: number; created_at?: string;
        };
        Update: Partial<{ product_name: string; unit_price: number; quantity: number }>;
      } & NoRelationships;
      support_messages: {
        Row: {
          id: string; name: string; email: string | null; message: string;
          status: string | null; created_at: string;
          admin_note: string | null; resolved_at: string | null; archived_at: string | null;
        };
        Insert: {
          id?: string; name: string; email?: string | null; message: string;
          status?: string | null; created_at?: string;
          admin_note?: string | null; resolved_at?: string | null; archived_at?: string | null;
        };
        Update: Partial<{
          name: string; email: string | null; message: string; status: string | null;
          admin_note: string | null; resolved_at: string | null; archived_at: string | null;
        }>;
      } & NoRelationships;
      wishlist_items: {
        Row: { id: string; user_id: string; product_id: string; created_at: string };
        Insert: { id?: string; user_id: string; product_id: string; created_at?: string };
        Update: Partial<{ product_id: string }>;
      } & NoRelationships;
      cart_items: {
        Row: { id: string; user_id: string; product_id: string; quantity: number; created_at: string };
        Insert: { id?: string; user_id: string; product_id: string; quantity: number; created_at?: string };
        Update: Partial<{ quantity: number }>;
      } & NoRelationships;
      admin_users: {
        Row: { id: string; user_id: string; email: string; role: string; created_at: string };
        Insert: { id?: string; user_id: string; email: string; role?: string; created_at?: string };
        Update: Partial<{ email: string; role: string }>;
      } & NoRelationships;
      discount_codes: {
        Row: {
          id: string; code: string; type: string; value: number;
          min_order_amount: number; max_uses: number | null; use_count: number;
          is_active: boolean; expires_at: string | null; description: string | null;
          applies_to: string | null;
          created_at: string; updated_at: string | null;
        };
        Insert: {
          id?: string; code: string; type: string; value: number;
          min_order_amount?: number; max_uses?: number | null; use_count?: number;
          is_active?: boolean; expires_at?: string | null; description?: string | null;
          applies_to?: string | null;
          created_at?: string; updated_at?: string | null;
        };
        Update: Partial<{
          code: string; type: string; value: number; min_order_amount: number;
          max_uses: number | null; use_count: number; is_active: boolean;
          expires_at: string | null; description: string | null; applies_to: string | null;
          updated_at: string | null;
        }>;
      } & NoRelationships;
      location_options: {
        Row: {
          id: string; type: string; name: string; parent_id: string | null;
          sort_order: number; is_active: boolean; shipping_fee: number; created_at: string;
        };
        Insert: {
          id?: string; type: string; name: string; parent_id?: string | null;
          sort_order?: number; is_active?: boolean; shipping_fee?: number; created_at?: string;
        };
        Update: Partial<{
          type: string; name: string; parent_id: string | null;
          sort_order: number; is_active: boolean; shipping_fee: number;
        }>;
      } & NoRelationships;
      site_settings: {
        Row: {
          id: string; key: string; value: string | null; type: string;
          label: string | null; group_name: string; updated_at: string;
        };
        Insert: {
          id?: string; key: string; value?: string | null; type?: string;
          label?: string | null; group_name?: string; updated_at?: string;
        };
        Update: Partial<{
          value: string | null; type: string; label: string | null;
          group_name: string; updated_at: string;
        }>;
      } & NoRelationships;
      inventory_movements: {
        Row: {
          id: string; product_id: string; delta: number; stock_after: number;
          reason: string; order_id: string | null; admin_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string; product_id: string; delta: number; stock_after: number;
          reason: string; order_id?: string | null; admin_note?: string | null;
          created_at?: string;
        };
        Update: Partial<{ reason: string; admin_note: string | null }>;
      } & NoRelationships;
      payment_requests: {
        Row: {
          id: string; order_id: string; amount: number; currency: string;
          method: string; status: string; payment_code: string;
          bank_account_name: string | null; bank_account_number: string | null;
          bank_name: string | null; bank_branch: string | null; qr_payload: string | null;
          provider: string | null; provider_reference: string | null;
          provider_status: string | null;
          expires_at: string | null; paid_at: string | null;
          matched_transaction_id: string | null; admin_note: string | null;
          payment_mode: string;
          quota_month: string | null;
          quota_counted: boolean;
          auto_confirm_eligible: boolean;
          manual_required_reason: string | null;
          cancelled_at: string | null; expired_at: string | null;
          customer_reported_transfer_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; order_id: string; amount: number; currency?: string;
          method?: string; status?: string; payment_code: string;
          bank_account_name?: string | null; bank_account_number?: string | null;
          bank_name?: string | null; bank_branch?: string | null; qr_payload?: string | null;
          provider?: string | null; provider_reference?: string | null;
          provider_status?: string | null;
          expires_at?: string | null; paid_at?: string | null;
          matched_transaction_id?: string | null; admin_note?: string | null;
          payment_mode?: string;
          quota_month?: string | null;
          quota_counted?: boolean;
          auto_confirm_eligible?: boolean;
          manual_required_reason?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: Partial<{
          status: string; paid_at: string | null; matched_transaction_id: string | null;
          admin_note: string | null; updated_at: string;
          payment_mode: string; provider_status: string | null;
          quota_month: string | null; quota_counted: boolean;
          auto_confirm_eligible: boolean; manual_required_reason: string | null;
          cancelled_at: string | null; expired_at: string | null;
          customer_reported_transfer_at: string | null;
        }>;
      } & NoRelationships;
      payment_provider_usage: {
        Row: {
          id: string; provider: string; quota_month: string;
          auto_quota_limit: number; auto_success_count: number;
          manual_fallback_count: number; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; provider: string; quota_month: string;
          auto_quota_limit?: number; auto_success_count?: number;
          manual_fallback_count?: number; created_at?: string; updated_at?: string;
        };
        Update: Partial<{
          auto_quota_limit: number; auto_success_count: number;
          manual_fallback_count: number; updated_at: string;
        }>;
      } & NoRelationships;
      bank_transactions: {
        Row: {
          id: string; provider: string | null; provider_transaction_id: string | null;
          transaction_time: string | null; amount: number; currency: string;
          description: string | null; bank_account_number: string | null;
          counterparty_name: string | null; counterparty_account: string | null;
          status: string; matched_order_id: string | null;
          matched_payment_request_id: string | null; match_failure_reason: string | null;
          matched_at: string | null;
          raw_payload: Record<string, unknown> | null; created_at: string;
        };
        Insert: {
          id?: string; provider?: string | null; provider_transaction_id?: string | null;
          transaction_time?: string | null; amount: number; currency?: string;
          description?: string | null; bank_account_number?: string | null;
          counterparty_name?: string | null; counterparty_account?: string | null;
          status?: string; matched_order_id?: string | null;
          matched_payment_request_id?: string | null; match_failure_reason?: string | null;
          matched_at?: string | null;
          raw_payload?: Record<string, unknown> | null; created_at?: string;
        };
        Update: Partial<{
          status: string; matched_order_id: string | null;
          matched_payment_request_id: string | null; match_failure_reason: string | null;
          matched_at: string | null;
        }>;
      } & NoRelationships;
      payment_webhook_events: {
        Row: {
          id: string; provider: string | null; event_id: string | null;
          event_type: string | null; signature_valid: boolean | null;
          raw_payload: Record<string, unknown> | null; processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string; provider?: string | null; event_id?: string | null;
          event_type?: string | null; signature_valid?: boolean | null;
          raw_payload?: Record<string, unknown> | null; processed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{ processed_at: string | null; signature_valid: boolean | null }>;
      } & NoRelationships;
      web_analytics_events: {
        Row: {
          id: string; path: string; referrer: string | null; title: string | null;
          user_agent: string | null; device_type: string | null; browser: string | null;
          os: string | null; ip_hash: string | null; session_id: string | null;
          visitor_id: string | null; utm_source: string | null; utm_medium: string | null;
          utm_campaign: string | null; created_at: string;
          event_type: string; event_name: string | null; product_id: string | null;
          order_id: string | null; metadata: Record<string, unknown> | null;
        };
        Insert: {
          id?: string; path: string; referrer?: string | null; title?: string | null;
          user_agent?: string | null; device_type?: string | null; browser?: string | null;
          os?: string | null; ip_hash?: string | null; session_id?: string | null;
          visitor_id?: string | null; utm_source?: string | null; utm_medium?: string | null;
          utm_campaign?: string | null; created_at?: string;
          event_type?: string; event_name?: string | null; product_id?: string | null;
          order_id?: string | null; metadata?: Record<string, unknown> | null;
        };
        Update: Partial<{ path: string; event_type: string; event_name: string | null; product_id: string | null; order_id: string | null; metadata: Record<string, unknown> | null }>;
      } & NoRelationships;
      blog_posts: {
        Row: {
          id: string; slug: string; title: string; excerpt: string | null;
          content: string | null; image_url: string | null; read_time: string | null;
          views: number; likes: number; comments_count: number;
          is_published: boolean; sort_order: number; published_at: string | null;
          created_at: string; updated_at: string;
          image_path: string | null; image_alt: string | null;
        };
        Insert: {
          id?: string; slug: string; title: string; excerpt?: string | null;
          content?: string | null; image_url?: string | null; read_time?: string | null;
          views?: number; likes?: number; comments_count?: number;
          is_published?: boolean; sort_order?: number; published_at?: string | null;
          created_at?: string; updated_at?: string;
          image_path?: string | null; image_alt?: string | null;
        };
        Update: Partial<{
          slug: string; title: string; excerpt: string | null; content: string | null;
          image_url: string | null; read_time: string | null; views: number; likes: number;
          comments_count: number; is_published: boolean; sort_order: number;
          published_at: string | null; updated_at: string;
          image_path: string | null; image_alt: string | null;
        }>;
      } & NoRelationships;
      feedback_items: {
        Row: {
          id: string; customer_name: string; message: string; image_url: string | null;
          rating: number | null; is_featured: boolean; is_published: boolean;
          sort_order: number; created_at: string; updated_at: string;
          image_path: string | null; image_alt: string | null;
        };
        Insert: {
          id?: string; customer_name: string; message: string; image_url?: string | null;
          rating?: number | null; is_featured?: boolean; is_published?: boolean;
          sort_order?: number; created_at?: string; updated_at?: string;
          image_path?: string | null; image_alt?: string | null;
        };
        Update: Partial<{
          customer_name: string; message: string; image_url: string | null;
          rating: number | null; is_featured: boolean; is_published: boolean;
          sort_order: number; updated_at: string;
          image_path: string | null; image_alt: string | null;
        }>;
      } & NoRelationships;
      customer_profiles: {
        Row: {
          id: string; user_id: string | null; full_name: string | null;
          phone: string | null; email: string | null; birthday: string | null;
          gender: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id?: string | null; full_name?: string | null;
          phone?: string | null; email?: string | null; birthday?: string | null;
          gender?: string | null; created_at?: string; updated_at?: string;
        };
        Update: Partial<{
          full_name: string | null; phone: string | null; email: string | null;
          birthday: string | null; gender: string | null; updated_at: string;
        }>;
      } & NoRelationships;
      customer_addresses: {
        Row: {
          id: string; user_id: string | null; full_name: string | null;
          phone: string | null; country: string | null; province: string | null;
          district: string | null; ward: string | null; address_line: string | null;
          is_default: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id?: string | null; full_name?: string | null;
          phone?: string | null; country?: string | null; province?: string | null;
          district?: string | null; ward?: string | null; address_line?: string | null;
          is_default?: boolean; created_at?: string; updated_at?: string;
        };
        Update: Partial<{
          full_name: string | null; phone: string | null; country: string | null;
          province: string | null; district: string | null; ward: string | null;
          address_line: string | null; is_default: boolean; updated_at: string;
        }>;
      } & NoRelationships;
      collections: {
        Row: {
          id: string; slug: string; name: string; description: string | null;
          image_url: string | null; image_path: string | null; image_alt: string | null;
          hero_image_url: string | null; hero_image_path: string | null;
          is_active: boolean; sort_order: number;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; slug: string; name: string; description?: string | null;
          image_url?: string | null; image_path?: string | null; image_alt?: string | null;
          hero_image_url?: string | null; hero_image_path?: string | null;
          is_active?: boolean; sort_order?: number;
          created_at?: string; updated_at?: string;
        };
        Update: Partial<{
          slug: string; name: string; description: string | null;
          image_url: string | null; image_path: string | null; image_alt: string | null;
          hero_image_url: string | null; hero_image_path: string | null;
          is_active: boolean; sort_order: number; updated_at: string;
        }>;
      } & NoRelationships;
      collection_products: {
        Row: {
          id: string; collection_id: string; product_id: string;
          sort_order: number; created_at: string;
        };
        Insert: {
          id?: string; collection_id: string; product_id: string;
          sort_order?: number; created_at?: string;
        };
        Update: Partial<{ sort_order: number }>;
      } & NoRelationships;
      comments: {
        Row: {
          id: string; target_type: string; target_id: string | null; target_slug: string | null;
          user_id: string | null; author_name: string | null; author_email: string | null;
          content: string; status: string; admin_note: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; target_type: string; target_id?: string | null; target_slug?: string | null;
          user_id?: string | null; author_name?: string | null; author_email?: string | null;
          content: string; status?: string; admin_note?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: Partial<{
          target_type: string; target_id: string | null; target_slug: string | null;
          author_name: string | null; author_email: string | null; content: string;
          status: string; admin_note: string | null; updated_at: string;
        }>;
      } & NoRelationships;
      password_reset_tokens: {
        Row: {
          id: string; user_id: string; email: string; token_hash: string;
          expires_at: string; used_at: string | null; created_at: string;
        };
        Insert: {
          id?: string; user_id: string; email: string; token_hash: string;
          expires_at: string; used_at?: string | null; created_at?: string;
        };
        Update: Partial<{ used_at: string | null }>;
      } & NoRelationships;
      media_assets: {
        Row: {
          id: string; bucket: string; path: string; public_url: string | null;
          alt: string | null; mime: string | null; size: number | null;
          width: number | null; height: number | null; created_at: string;
        };
        Insert: {
          id?: string; bucket: string; path: string; public_url?: string | null;
          alt?: string | null; mime?: string | null; size?: number | null;
          width?: number | null; height?: number | null; created_at?: string;
        };
        Update: Partial<{
          public_url: string | null; alt: string | null; mime: string | null;
          size: number | null; width: number | null; height: number | null;
        }>;
      } & NoRelationships;
    };
    // Supabase v2 GenericSchema also requires Views and Functions keys.
    Views: Record<string, never>;
    Functions: {
      count_discount_usage_for_paid_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
    };
  };
};

export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<AdminDatabase>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
