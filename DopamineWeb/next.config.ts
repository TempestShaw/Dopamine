import type { NextConfig } from "next";

// Exported as plain static files so the desktop agents can serve the dashboard themselves
// (http://localhost:26535/) with no Node.js runtime.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
