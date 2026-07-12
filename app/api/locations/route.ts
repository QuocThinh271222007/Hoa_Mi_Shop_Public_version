import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// Public read-only endpoint for province/district/ward cascade.
// Used by checkout and profile address forms.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const parentId = searchParams.get('parent_id');

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    const db = createAdminSupabaseClient();
    let query = db
      .from('location_options')
      .select('id, name, parent_id, sort_order, shipping_fee, required_levels, payment_methods')
      .eq('type', type)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else if (type !== 'province') {
      // district and ward require a parent_id
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await query.limit(500);
    if (error) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
