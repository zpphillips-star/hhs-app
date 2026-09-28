import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/join',
        destination: '/auth',
        permanent: false,
      },
      {
        source: '/yikes',
        destination: 'https://youtu.be/dQw4w9WgXcQ?si=AJ63_T01_Emg6acz',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
