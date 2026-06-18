import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@renovation-twin/ai",
    "@renovation-twin/db",
    "@renovation-twin/events",
    "@renovation-twin/fixtures",
    "@renovation-twin/geometry",
    "@renovation-twin/types"
  ]
};

export default nextConfig;
