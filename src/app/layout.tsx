import type { Metadata } from "next";
import "./globals.css";
import { DemoBanner } from "@/platform/auth/demo-banner";

export const metadata: Metadata = {
  title: "Internal Tools",
  description: "Code-owned internal tools platform prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
