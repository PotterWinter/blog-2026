import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the home Wi-Fi load dev assets (dev server only)
  allowedDevOrigins: ["192.168.1.35"],
  experimental: {
    // An image upload (5.4) is a server action: up to 4 MB (the browser shrinks bigger
    // photos first; Vercel takes 4.5 MB a request at most). Next's default is 1 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;