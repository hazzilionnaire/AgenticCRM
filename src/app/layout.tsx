import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgenticCRM",
  description: "B2B account management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
