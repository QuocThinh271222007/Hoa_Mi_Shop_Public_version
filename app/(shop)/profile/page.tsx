import { Suspense } from 'react';
import ProfileClient from './ProfileClient';
import './profile.css';

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileClient />
    </Suspense>
  );
}
