import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the home Wi-Fi load dev assets (dev server only)
  allowedDevOrigins: ["192.168.1.35"],
  // 75 is Next's one quality; a post's cover asks for 90 (PostHeader) — at 75, text in
  // a cover (a diagram) blurred at its edges on a big screen (owner, 5 Oct 69)
  images: { qualities: [75, 90] },
  experimental: {
    // An image upload (5.4) is a server action: up to 4 MB (the browser shrinks bigger
    // photos first; Vercel takes 4.5 MB a request at most). Next's default is 1 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;