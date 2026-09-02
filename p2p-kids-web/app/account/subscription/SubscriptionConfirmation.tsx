"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicSubscriptionConfig } from "@/lib/publicConfig";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function SubscriptionConfirmationInner({
  config,
}: {
  config: PublicSubscriptionConfig | null;
}) {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const flatFee = formatCents(config?.complete ? config.flatFeeCents : 149);

  return (
    <div className="card">
      <h2>🎉 You&apos;re all set!</h2>
      <p>
        Your Kids Club+ membership{email ? ` for ${email}` : ""} is being set
        up. It takes just a minute for your benefits to appear.
      </p>
      <p>
        Tap below to go back to Pass It Up — your membership unlocks
        automatically and you&apos;ll be able to earn Swap Points on sales and
        pay the flat {flatFee} fee.
      </p>
      {/* Deep-link back into the app (opens the My Subscription screen). */}
      <a
        className="btn"
        href="p2pkidsmarketplace://my-subscription"
        style={{ display: "block", marginTop: 20, textDecoration: "none" }}
      >
        Return to Pass It Up
      </a>
      {/* Plain web fallback (QA Task 20 Step 4 #3): for browsers where the
          p2pkidsmarketplace:// custom scheme isn't registered (e.g. desktop). */}
      <a
        className="btn btn-secondary"
        href="/"
        style={{ display: "block", marginTop: 12, textDecoration: "none" }}
      >
        Continue on the web
      </a>
      <p className="note">
        Button not opening the app? Open Pass It Up from your home screen, or
        sign in with the same email address you used here and your membership
        will be linked automatically.
      </p>
    </div>
  );
}

export default function SubscriptionConfirmation({
  config,
}: {
  config: PublicSubscriptionConfig | null;
}) {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <SubscriptionConfirmationInner config={config} />
    </Suspense>
  );
}
