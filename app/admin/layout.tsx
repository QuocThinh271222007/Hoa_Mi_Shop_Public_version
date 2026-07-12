import type { Metadata } from 'next';
import './admin.css';

// Belt-and-braces with the X-Robots-Tag header + robots.ts: never let the admin
// panel be indexed or its links followed.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
