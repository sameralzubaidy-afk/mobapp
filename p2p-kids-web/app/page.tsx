import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container">
      <h1>Pass It Up</h1>
      <p>
        The kid-to-kid marketplace for your neighborhood. Manage your Kids Club+ membership here.
      </p>
      <div className="card">
        <h2>Kids Club+ membership</h2>
        <p>
          Join Kids Club+ to earn Swap Points on every sale and pay a flat $1.49 safety &amp;
          platform fee instead of the free-user percentage fee.
        </p>
        <Link className="btn" href="/join">
          Join Kids Club+
        </Link>
        <p className="note">
          Already a member? Manage your subscription in the Pass It Up app, or contact support.
        </p>
      </div>
    </main>
  );
}
