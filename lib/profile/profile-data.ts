// PUBLIC client profile functions - use browser Supabase client with RLS.
// Never import admin-client here.

export interface CustomerProfile {
  id: string;
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  gender: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  address_line: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  productId: string | null;
  slug: string | null;
  image: string | null;
}

export interface UserOrder {
  id: string;
  payment_code: string | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  total_amount: number | null;
  subtotal: number;
  shipping_address: string | null;
  pickup_time: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  returned_at: string | null;
  refunded_at: string | null;
  cancel_requested_at: string | null;
  items: UserOrderItem[];
}

/** Fetch customer profile by user UUID (browser RLS client). */
export async function getCustomerProfile(
  userId: string
): Promise<CustomerProfile | null> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  const { data, error } = await db
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data as CustomerProfile | null;
}

/** Upsert customer profile fields. */
export async function upsertCustomerProfile(
  userId: string,
  fields: Partial<{
    full_name: string;
    phone: string;
    email: string;
    birthday: string;
    gender: string;
  }>
): Promise<void> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  const { error } = await db.from('customer_profiles').upsert(
    { user_id: userId, ...fields, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
}

/** Fetch all addresses for a user. */
export async function getCustomerAddresses(
  userId: string
): Promise<CustomerAddress[]> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  const { data, error } = await db
    .from('customer_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as CustomerAddress[];
}

/** Insert a new address for a user. */
export async function addCustomerAddress(
  userId: string,
  fields: {
    full_name?: string;
    phone?: string;
    country?: string;
    province?: string;
    district?: string;
    ward?: string;
    address_line?: string;
    is_default?: boolean;
  }
): Promise<void> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  const { error } = await db.from('customer_addresses').insert({
    user_id: userId,
    ...fields,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Update an existing address - verifies ownership via RLS. */
export async function updateCustomerAddress(
  id: string,
  fields: {
    full_name?: string;
    phone?: string;
    country?: string;
    province?: string | null;
    district?: string | null;
    ward?: string | null;
    address_line?: string;
    is_default?: boolean;
  }
): Promise<void> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  const { error } = await db
    .from('customer_addresses')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Mark one address as default (clears the flag on the user's other addresses). */
export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  await db.from('customer_addresses').update({ is_default: false }).eq('user_id', userId);
  const { error } = await db.from('customer_addresses').update({ is_default: true }).eq('id', addressId);
  if (error) throw new Error(error.message);
}

/** Delete an address - verifies ownership via RLS. */
export async function deleteCustomerAddress(id: string): Promise<void> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  const { error } = await db.from('customer_addresses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Fetch orders for a user (via RLS - user can only see their own). */
type RawOrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  product_id: string | null;
  products: { slug: string | null; image_url: string | null } | { slug: string | null; image_url: string | null }[] | null;
};

export async function getUserOrders(userId: string): Promise<UserOrder[]> {
  const { createSupabaseBrowserClient } = await import('../supabase/browser-client');
  const db = createSupabaseBrowserClient();
  const { data, error } = await db
    .from('orders')
    .select(
      'id, payment_code, status, payment_status, payment_method, total_amount, subtotal, shipping_address, pickup_time, created_at, paid_at, shipped_at, delivered_at, cancelled_at, returned_at, refunded_at, cancel_requested_at, ' +
      'order_items ( product_name, quantity, unit_price, product_id, products ( slug, image_url ) )'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return ((data ?? []) as unknown as (UserOrder & { order_items: RawOrderItem[] | null })[]).map((o) => {
    const items: UserOrderItem[] = (o.order_items ?? []).map((it) => {
      const prod = Array.isArray(it.products) ? it.products[0] : it.products;
      return {
        name:      it.product_name,
        quantity:  it.quantity,
        unitPrice: it.unit_price,
        productId: it.product_id,
        slug:      prod?.slug ?? null,
        image:     prod?.image_url ?? null,
      };
    });
    return { ...o, items };
  });
}
