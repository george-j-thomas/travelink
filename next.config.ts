import type { NextConfig } from "next";

// sharp (stored avatars) loads its native binary through a package export and
// libvips through the binary's RPATH, which file tracing doesn't follow. Vercel
// functions run on linux-x64 (glibc), so ship those builds with the routes that
// fetch bios (and so store avatars).
const sharpFiles = [
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/artists": sharpFiles,
    "/api/artists/fetch-next": sharpFiles,
    "/api/artists/*/refresh": sharpFiles,
  },
};

export default nextConfig;
