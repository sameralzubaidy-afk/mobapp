import { Suspense } from "react";
import JoinForm from "./JoinForm";
import { getPublicSubscriptionConfig } from "@/lib/publicConfig";

// Config is read per request so admin_config edits (price/fee/trial) reflect
// immediately on this small marketing page.
export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const config = await getPublicSubscriptionConfig();

  return (
    <main className="container">
      <h1>Kids Club+ Membership</h1>
      <p>
        Complete your membership securely on the web. No charge in the app —
        your benefits unlock automatically after you subscribe.
      </p>
      <Suspense fallback={<div className="card">Loading…</div>}>
        <JoinForm config={config} />
      </Suspense>
    </main>
  );
}
