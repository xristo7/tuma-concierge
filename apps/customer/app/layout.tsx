import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "../components/BottomNav";

export const metadata: Metadata = {
  title: "Tuma Customer",
  description: "Tuma Concierge — customer app (scaffold)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <main className="mx-auto min-h-dvh max-w-lg pb-20">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
