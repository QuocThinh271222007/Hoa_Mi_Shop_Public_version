import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

const BLOCKED_PREFIXES = ['/admin', '/api'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      event_type?: string;
      event_name?: string;
      path?: string;
      product_id?: string;
      order_id?: string;
      visitorId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    };

    const path = body.path ?? '';
    if (!path || BLOCKED_PREFIXES.some(p => path.startsWith(p))) {
      return NextResponse.json({ ok: true });
    }
    if (!body.event_type || body.event_type === 'page_view') {
      return NextResponse.json({ ok: true }); // page_view goes through /api/analytics/page-view
    }

    const db = createAdminSupabaseClient();
    await db.from('web_analytics_events').insert({
      path,
      event_type: body.event_type,
      event_name: body.event_name || null,
      product_id: body.product_id || null,
      order_id: (body.order_id || null) as string | null,
      session_id: body.sessionId || null,
      visitor_id: body.visitorId || null,
      metadata: body.metadata || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
