import type { Metadata, Viewport } from "next";
import { AppShell } from "../components/AppShell";
import { InstallPrompt } from "../components/InstallPrompt";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";
import { AuthProvider } from "../lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tuma Merchant",
  description: "Accept Tuma payments and manage settlements",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/merchant-icon.svg",
    apple: "/icons/merchant-icon.svg",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tuma Merchant" },
};
export const viewport: Viewport = { themeColor: "#153A75", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ServiceWorkerRegister/><AuthProvider><AppShell>{children}</AppShell></AuthProvider><InstallPrompt/></body></html>;
}
