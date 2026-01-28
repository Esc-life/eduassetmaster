// Force load env variables from .env
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
