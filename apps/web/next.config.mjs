/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @kalibra/shared is shipped as TypeScript source; let Next transpile it.
  transpilePackages: ["@kalibra/shared"],
};

export default nextConfig;
