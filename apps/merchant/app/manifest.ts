import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tuma Merchant",
    short_name: "Tuma Merchant",
    description: "Accept Tuma payments and manage merchant settlements.",
    start_url: "/",
    display: "standalone",
    background_color: "#F9F6F0",
    theme_color: "#153A75",
  };
}
