'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SubscriptionConfirmation() {
  const params = useSearchParams();
  const email = params.get('email') || '';

  return (
    <div className="card">
      <h2>🎉 You&apos;re all set!</h2>
      <p>
        Your Kids Club+ membership{email ? ` for ${email}` : ''} is being set up. It takes just a
        minute for your benefits to appear.
      </p>
      <p>
        Tap below to go back to Pass It Up — your membership unlocks automatically and you&apos;ll
        be able to earn Swap Points on sales and pay the flat $1.49 fee.
      </p>
      {/* Deep-link back into the app (opens the My Subscription screen). */}
      <a
        className="btn"
        href="p2pkidsmarketplace://my-subscription"
        style={{ display: 'block', marginTop: 20, textDecoration: 'none' }}
      >
        Return to Pass It Up
      </a>
      <p className="note">
        Button not opening the app? Open Pass It Up from your home screen, or sign in with the same
        email address you used here and your membership will be linked automatically.
      </p>
    </div>
  );
}

export default function AccountSubscriptionPage() {
  return (
    <main className="container">
      <h1>Kids Club+ Membership</h1>
      <Suspense fallback={<div className="card">Loading…</div>}>
        <SubscriptionConfirmation />
      </Suspense>
    </main>
  );
}
