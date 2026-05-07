import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/join',
        destination: '/auth',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
