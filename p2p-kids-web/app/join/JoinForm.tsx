"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { PublicSubscriptionConfig } from "@/lib/publicConfig";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function JoinFormInner({
  config,
}: {
  config: PublicSubscriptionConfig | null;
}) {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatFee = formatCents(config?.complete ? config.flatFeeCents : 149);
  const monthlyPrice = formatCents(
    config?.complete ? config.monthlyPriceCents : 599,
  );
  const trialEnabled = config?.complete ? config.trialEnabled : false;
  const trialDays = config?.complete ? config.trialDays : 30;

  const handleJoin = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success || !body?.url) {
        setError(
          body?.error?.message ||
            "We could not start the checkout. Please try again.",
        );
        return;
      }
      // Redirect to Stripe-hosted Checkout (Apple Pay / Google Pay / card).
      window.location.href = body.url;
    } catch {
      setError("We could not start the checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Kids Club+</h2>

      {/* Price row (QA Task 20 F-1 — parents see the real cost before joining). */}
      <div className="price-row">
        <span className="price-amount">{monthlyPrice}</span>
        <span className="price-period">/month</span>
        {trialEnabled && (
          <span className="price-trial">{trialDays}-day free trial</span>
        )}
      </div>

      <div className="benefit">
        <div className="dot" />
        <div>
          <strong>Earn Swap Points on every sale</strong>
          <span>Active members earn SP when their items sell.</span>
        </div>
      </div>
      <div className="benefit">
        <div className="dot" />
        <div>
          <strong>Pay a flat {flatFee} fee</strong>
          <span>
            Instead of the free-user percentage fee, members pay one flat{" "}
            {flatFee} per checkout.
          </span>
        </div>
      </div>
      <div className="benefit">
        <div className="dot" />
        <div>
          <strong>Spend SP on purchases (up to 50%)</strong>
          <span>
            Use earned Swap Points to cover up to half of an item&apos;s price.
          </span>
        </div>
      </div>

      <label
        htmlFor="email"
        style={{ display: "block", marginTop: 20, fontWeight: 600 }}
      >
        Email for your account
      </label>
      <input
        id="email"
        className="input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          // QA Task 20 UX: clear the error as the user types so the form recovers.
          if (error) setError(null);
        }}
      />

      {/* Fixed-height error slot (QA Task 20 UX): reserving height means the CTA
          button never jumps when the validation error appears/disappears. */}
      <div className="error-slot" aria-live="polite">
        {error ? <div className="error">{error}</div> : null}
      </div>

      <div style={{ marginTop: 4 }}>
        <button className="btn" onClick={handleJoin} disabled={loading}>
          {loading ? "Opening secure checkout…" : "Join on the web"}
        </button>
      </div>

      <p className="note">
        You&apos;ll be taken to Stripe&apos;s secure checkout. Pay with a card,
        Apple Pay, or Google Pay. Your benefits unlock in the app right after
        you subscribe.
      </p>
    </div>
  );
}

export default function JoinForm({
  config,
}: {
  config: PublicSubscriptionConfig | null;
}) {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <JoinFormInner config={config} />
    </Suspense>
  );
}
