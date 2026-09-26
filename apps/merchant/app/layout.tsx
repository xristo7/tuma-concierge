import type { Metadata, Viewport } from "next";
import { AppShell } from "../components/AppShell";
import { AuthProvider } from "../lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tuma Merchant",
  description: "Accept Tuma payments and manage settlements",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Tuma Merchant" },
};
export const viewport: Viewport = { themeColor: "#153A75", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider><AppShell>{children}</AppShell></AuthProvider></body></html>;
}
