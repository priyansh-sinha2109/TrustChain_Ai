import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrustChain AI — The Last Check Before You Pay",
  description:
    "Pre-advance procurement verification assistant for Indian manufacturing MSMEs. Spot specification, delivery and advance-payment discrepancies before money leaves your business.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f7f6f2] text-[#18181b]">{children}</body>
    </html>
  );
}
