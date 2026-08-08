import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workspace rail owns the bottom-left corner, where the dev indicator
  // would otherwise sit on top of the account avatar.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
