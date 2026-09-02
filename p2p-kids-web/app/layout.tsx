import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pass It Up — Kids Club+ Membership",
  description:
    "Manage your Pass It Up membership. Join Kids Club+ to earn Swap Points, pay a flat safety & platform fee, and spend SP on purchases.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
