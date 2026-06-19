import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(appDir, "../.."),
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
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
