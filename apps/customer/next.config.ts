import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tuma/shared"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
