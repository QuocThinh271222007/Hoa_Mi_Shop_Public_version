import Link from 'next/link';
import Image from 'next/image';
import './auth.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-card__logo" aria-label="Cúc Họa Mi">
          <Image src="/assets/brand/logo.png" alt="Cúc Họa Mi" width={72} height={72} priority />
        </Link>
        {children}
      </div>
    </main>
  );
}
