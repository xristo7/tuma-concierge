import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";
import { AuthProvider } from "../lib/auth-context";

export const metadata: Metadata = {
  title: "Tuma Driver",
  description: "Tuma Concierge — rider app",
  manifest: "/manifest.json",
  icons: {
    icon: "/brand/app-icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tuma Driver",
  },
};

export const viewport: Viewport = {
  themeColor: "#153A75",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-cream text-ink">
        <ServiceWorkerRegister />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
