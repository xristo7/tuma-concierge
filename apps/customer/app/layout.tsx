import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "../components/BottomNav";
import { BrandHeader } from "../components/BrandHeader";

export const metadata: Metadata = {
  title: "Tuma Customer",
  description: "Tuma Concierge — customer app (scaffold)",
  icons: {
    icon: "/brand/app-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-cream text-ink">
        <BrandHeader />
        <main className="mx-auto min-h-dvh max-w-lg pb-20">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
