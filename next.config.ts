import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep AGENTS.md as written for this repo; `next dev` would otherwise append its own block.
  agentRules: false,
  experimental: {
    authInterrupts: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
