import type { NextConfig } from "next";
import site from "./lib/site-config.json";

const nextConfig: NextConfig = {
  output: "export",
  basePath: site.basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
