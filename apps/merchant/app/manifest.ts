import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tuma Merchant",
    short_name: "Tuma Merchant",
    description: "Accept Tuma payments and manage merchant settlements.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F9F6F0",
    theme_color: "#153A75",
    prefer_related_applications: false,
    icons: [
      { src: "/icons/merchant-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/merchant-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/merchant-icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
