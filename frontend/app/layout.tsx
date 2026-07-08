import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Protein Network Explorer",
  description: "Explore protein complexes, PPI networks, and evidence-backed relationships.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
