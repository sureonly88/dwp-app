import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: menghasilkan bundle minimal untuk deployment Docker.
  // Server.js + node_modules yang dipakai saja — tidak perlu npm install di production.
  output: "standalone",
};

export default nextConfig;
