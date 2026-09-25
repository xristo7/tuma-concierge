import type { NextConfig } from "next";
import { securityHeaderRules } from "../../packages/shared/security-headers.mjs";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  async headers() {
    return securityHeaderRules({
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      dev: process.env.NODE_ENV === "development",
    });
  },
};

export default nextConfig;
