import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Turbopack to resolve files in the sibling shared/ directory
  // (e.g. shared/design/*.json design specs imported by the simulator).
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
