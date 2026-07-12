import { Suspense } from 'react';
import PaymentPendingClient from './PaymentPendingClient';
import '../checkout.css';

export default function PaymentPendingPage() {
  return (
    <Suspense>
      <PaymentPendingClient />
    </Suspense>
  );
}
