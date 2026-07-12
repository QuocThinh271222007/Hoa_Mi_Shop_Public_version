import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin-client';

// POST /api/analytics/page-view
// Receives anonymous page view events from AnalyticsTracker client component.
// Never stores raw IP. IP is hashed with ANALYTICS_SALT (server-only env var).
// Blocked paths: /admin/*, /api/*

const BLOCKED_PREFIXES = ['/admin', '/api'];
const ANALYTICS_SALT   = process.env.ANALYTICS_SALT ?? '';

function hashIp(ip: string): string {
  if (!ANALYTICS_SALT) return 'no-salt';
  return createHash('sha256').update(ip + ANALYTICS_SALT).digest('hex');
}

function getDeviceType(ua: string): string {
  if (!ua) return 'unknown';
  if (/iPad|tablet/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getBrowser(ua: string): string {
  if (/Edg\//i.test(ua))     return 'Edge';
  if (/OPR|Opera/i.test(ua)) return 'Opera';
  if (/Chrome/i.test(ua))    return 'Chrome';
  if (/Firefox/i.test(ua))   return 'Firefox';
  if (/Safari/i.test(ua))    return 'Safari';
  return 'Other';
}

function getOs(ua: string): string {
  if (/Windows/i.test(ua))        return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua))        return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Linux/i.test(ua))          return 'Linux';
  return 'Other';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      path?: string;
      referrer?: string;
      title?: string;
      visitorId?: string;
      sessionId?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    };

    const path = body.path ?? '';

    // Block admin and API paths server-side
    if (!path || BLOCKED_PREFIXES.some((p) => path.startsWith(p))) {
      return NextResponse.json({ ok: true });
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const ip        = forwarded ? forwarded.split(',')[0].trim()
                    : req.headers.get('x-real-ip') ?? 'unknown';
    const ua        = req.headers.get('user-agent') ?? '';

    const db = createAdminSupabaseClient();
    await db.from('web_analytics_events').insert({
      path,
      referrer:     body.referrer || null,
      title:        body.title    || null,
      user_agent:   ua            || null,
      device_type:  getDeviceType(ua),
      browser:      getBrowser(ua),
      os:           getOs(ua),
      ip_hash:      hashIp(ip),
      session_id:   body.sessionId   || null,
      visitor_id:   body.visitorId   || null,
      utm_source:   body.utmSource   || null,
      utm_medium:   body.utmMedium   || null,
      utm_campaign: body.utmCampaign || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Fail silently — analytics must never break public pages
    return NextResponse.json({ ok: false });
  }
}
