import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the home Wi-Fi load dev assets (dev server only)
  allowedDevOrigins: ["192.168.1.35"],
};

export default nextConfig;