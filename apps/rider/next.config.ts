import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@tuma/shared"],
  images: {
    unoptimized: true,
  },
  webpack(config) {
    // @tuma/shared uses explicit ".js" extensions on relative imports (required by
    // its NodeNext consumer, apps/api) even though the files are ".ts" — teach
    // webpack to resolve those the way Node's ESM loader does.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
