import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@selfxyz/core", "@selfxyz/enterprise-sdk"],
};

export default nextConfig;
