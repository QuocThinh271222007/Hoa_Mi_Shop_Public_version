import { Suspense } from 'react';
import CheckoutSuccessClient from './CheckoutSuccessClient';
import '../checkout.css';

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccessClient />
    </Suspense>
  );
}
