import Link from "next/link";
import { getPublicSubscriptionConfig } from "@/lib/publicConfig";

export const dynamic = "force-dynamic";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function HomePage() {
  const config = await getPublicSubscriptionConfig();
  const flatFee = formatCents(config?.complete ? config.flatFeeCents : 149);
  const monthlyPrice = formatCents(
    config?.complete ? config.monthlyPriceCents : 599,
  );

  return (
    <main className="container">
      <h1>Pass It Up</h1>
      <p>
        The kid-to-kid marketplace for your neighborhood. Manage your Kids Club+
        membership here.
      </p>
      <div className="card">
        <h2>Kids Club+ membership</h2>
        <p>
          Join Kids Club+ to earn Swap Points on every sale and pay a flat{" "}
          {flatFee} safety &amp; platform fee instead of the free-user
          percentage fee. Membership is {monthlyPrice}/month.
        </p>
        <Link className="btn" href="/join">
          Join Kids Club+
        </Link>
        <p className="note">
          Already a member? Manage your subscription in the Pass It Up app, or
          contact support.
        </p>
      </div>
    </main>
  );
}
