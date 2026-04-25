import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engineers Load Tracking System — AL-ITKAN",
  description: "AL-ITKAN For Commercial Agencies — Engineers Load Tracking System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
