import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecTrack.io — Cybersecurity Learning Tracker",
  description:
    "Single-user serverless cybersecurity learning roadmap, daily/weekly/monthly progress analytics, and study session tracker.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
