import Script from "next/script";

// Google Analytics 4 (gtag.js). Renders nothing unless
// NEXT_PUBLIC_GA_MEASUREMENT_ID (e.g. "G-XXXXXXXXXX") is set, so local/dev builds
// stay clean. Loaded with afterInteractive so it never blocks first paint.
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
