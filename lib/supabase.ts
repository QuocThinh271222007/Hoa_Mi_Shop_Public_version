import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Database = {
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
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']>;
        Update: Partial<Database['public']['Tables']['products']['Row']>;
      };
      wishlist_items: {
        Row: { id: string; user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string };
        Update: Partial<{ user_id: string; product_id: string }>;
      };
      cart_items: {
        Row: { id: string; user_id: string; product_id: string; quantity: number; created_at: string };
        Insert: { user_id: string; product_id: string; quantity?: number };
        Update: Partial<{ quantity: number }>;
      };
    };
  };
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient<Database> | null =
  url && anonKey ? createClient<Database>(url, anonKey) : null;
