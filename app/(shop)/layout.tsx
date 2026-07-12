import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-frame">
      <AnalyticsTracker />
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
