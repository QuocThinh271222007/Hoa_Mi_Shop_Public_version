import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client';

export async function getWishlistIds(userId: string): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from('wishlist_items')
    .select('product_id')
    .eq('user_id', userId);
  return (data ?? []).map((r) => r.product_id as string);
}

export async function isWishlisted(userId: string, productId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();
  return !!data;
}

export async function addWishlistItem(userId: string, productId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  await supabase
    .from('wishlist_items')
    .insert({ user_id: userId, product_id: productId });
}

export async function removeWishlistItem(userId: string, productId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  await supabase
    .from('wishlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
}

export async function toggleWishlist(
  userId: string,
  productId: string,
): Promise<boolean> {
  const wishlisted = await isWishlisted(userId, productId);
  if (wishlisted) {
    await removeWishlistItem(userId, productId);
    return false;
  }
  await addWishlistItem(userId, productId);
  return true;
}
