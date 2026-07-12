/** @type {import('next').NextConfig} */

import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Absolute path of this project directory. Used as the file-tracing root so Next
// doesn't walk up to C:\Users\Thinh (where a stray package-lock.json lives) and
// then fail to locate traced files (.nft.json ENOENT) on Windows builds.
const projectRoot = dirname(fileURLToPath(import.meta.url));

function getSupabaseImageHostnames() {
  const hosts = new Set();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname);
    } catch {
      // ignore invalid URL; env validation handles it elsewhere
    }
  }

  // Fallback: current Supabase project hostname seen in runtime error.
  hosts.add("eppnwkssijzexnuqqscx.supabase.co");

  return Array.from(hosts);
}

// Security headers applied to every response. Kept intentionally conservative —
// no Content-Security-Policy here (a wrong CSP silently breaks the site); that can
// be added later in report-only mode once tested.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Only honored over HTTPS; forces future requests onto HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

// Admin + API must never be indexed and must not be framed at all.
const PRIVATE_HEADERS = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig = {
  outputFileTracingRoot: projectRoot,
  // Hide the framework signature and don't ship source maps that would expose the
  // project's folder/source structure to anyone who opens devtools.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: false,
    remotePatterns: getSupabaseImageHostnames().map((hostname) => ({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/public/**",
    })),
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/admin/:path*", headers: PRIVATE_HEADERS },
      { source: "/api/:path*", headers: PRIVATE_HEADERS },
    ];
  },
};

export default nextConfig;
