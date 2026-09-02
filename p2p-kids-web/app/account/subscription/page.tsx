import { Suspense } from "react";
import SubscriptionConfirmation from "./SubscriptionConfirmation";
import { getPublicSubscriptionConfig } from "@/lib/publicConfig";

export const dynamic = "force-dynamic";

export default async function AccountSubscriptionPage() {
  const config = await getPublicSubscriptionConfig();

  return (
    <main className="container">
      <h1>Kids Club+ Membership</h1>
      <Suspense fallback={<div className="card">Loading…</div>}>
        <SubscriptionConfirmation config={config} />
      </Suspense>
    </main>
  );
}
