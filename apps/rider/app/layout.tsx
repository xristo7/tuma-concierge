import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { AuthProvider } from "../lib/auth-context";

export const metadata: Metadata = {
  title: "Tuma Rider",
  description: "Tuma Concierge — rider app",
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
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
