import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Alt innhold er per bruker og leses ved forespørsel, så vi bruker
  // klassisk dynamisk rendering i stedet for Cache Components.
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
