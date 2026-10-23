import type { NextConfig } from "next";

const config: NextConfig = {
  async headers() {
    return [
      // The setup link carries its key in the URL: never leak it through Referer.
      { source: "/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      // /setup is private: no framing (clickjacking) and nothing cached.
      {
        source: "/setup",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default config;
