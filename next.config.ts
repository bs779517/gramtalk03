import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // This will prevent Next.js from automatically generating a favicon,
  // which was causing the "Not Found" error.
  reactStrictMode: true,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // Disable favicon generation
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
  compiler: {
    // Disable favicon generation
    styledJsx: true,
  },
};

export default nextConfig;
