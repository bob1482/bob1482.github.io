import type { NextConfig } from "next";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/piano",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins,
};

export default nextConfig;
