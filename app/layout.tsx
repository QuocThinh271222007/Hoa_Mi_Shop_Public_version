import type { Metadata } from "next";
import "./globals.css";
import { LayoutGridOverlay } from "@/components/debug/LayoutGridOverlay";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

export const metadata: Metadata = {
  title: "Họa Mi",
  description: "Vai xinh, vibe tự tin",
  icons: {
    icon: "/assets/brand/logo.png",
    shortcut: "/assets/brand/logo.png",
    apple: "/assets/brand/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        {children}
        <LayoutGridOverlay />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
